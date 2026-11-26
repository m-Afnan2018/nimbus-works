import { Types } from "mongoose";
import Task from "../models/Task";
import SOP from "../models/SOP";
import Department from "../models/Department";

/**
 * Creates one Task per SOP step for a project, wiring Task.dependencies
 * from step.dependsOn (step order numbers) to the real Task _ids created
 * in the same run. Each call creates a new, independently-trackable "run" —
 * the same SOP can be started multiple times on the same project (e.g. a
 * "Posting" SOP run once per post) — tagged with a fresh `sopRunId` and the
 * caller-supplied `runTitle` so runs can be told apart and deleted individually.
 * `assignments` maps a step's `order` to the user ids to assign that task to.
 */
export async function generateTasksFromSOP(
    sopId: string | Types.ObjectId,
    projectId: string | Types.ObjectId,
    reporterId: string | Types.ObjectId,
    runTitle: string,
    assignments?: Record<number, string[]>,
): Promise<{ runId: string }> {
    const sop = await SOP.findById(sopId);
    if (!sop || sop.status !== "published") throw new Error("SOP not found or not published.");

    const tag = `sop:${sop._id}`;
    const runId = new Types.ObjectId().toString();

    const departmentIds = [...new Set(sop.steps.map((s) => s.department.toString()))];
    const departments = await Department.find({ _id: { $in: departmentIds } });
    const departmentById = new Map(departments.map((d) => [d._id.toString(), d]));

    const orderToTaskId = new Map<number, Types.ObjectId>();
    const created: { dependsOn: number[]; taskId: Types.ObjectId }[] = [];

    for (const step of sop.steps) {
        const dept = departmentById.get(step.department.toString());
        const template = step.taskTemplateId
            ? dept?.taskTemplates.find((t) => t._id.equals(step.taskTemplateId!))
            : undefined;
        const type = step.typeId && template
            ? template.types.find((t) => t._id.equals(step.typeId!))
            : undefined;

        const checklist = type?.checklist ?? template?.checklist ?? [];
        const priority = type?.priority ?? template?.priority ?? "medium";

        const task = await Task.create({
            title: step.title,
            description: step.description || "",
            project: projectId,
            department: step.department,
            reporter: reporterId,
            status: step.dependsOn.length > 0 ? "backlog" : "todo",
            priority,
            assignees: assignments?.[step.order] ?? [],
            isPersonal: false,
            estimatedHours: step.estimatedHours,
            checklist: checklist.map((title) => ({ title, completed: false })),
            tags: [tag],
            sopRunId: runId,
            sopRunTitle: runTitle,
            order: step.order,
            totalElapsedSeconds: 0,
        });
        orderToTaskId.set(step.order, task._id as Types.ObjectId);
        created.push({ dependsOn: step.dependsOn, taskId: task._id as Types.ObjectId });
    }

    for (const t of created) {
        if (t.dependsOn.length === 0) continue;
        const depIds = t.dependsOn
            .map((o) => orderToTaskId.get(o))
            .filter((id): id is Types.ObjectId => Boolean(id));
        if (depIds.length > 0) {
            await Task.findByIdAndUpdate(t.taskId, { dependencies: depIds });
        }
    }

    return { runId };
}

/** Deletes every task belonging to one SOP run on a project. */
export async function deleteSOPRun(
    projectId: string | Types.ObjectId,
    runId: string,
): Promise<number> {
    const result = await Task.deleteMany({ project: projectId, sopRunId: runId });
    return result.deletedCount ?? 0;
}
