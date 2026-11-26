import { Types } from "mongoose";
import Task from "../models/Task";
import Department from "../models/Department";
import { createNotifications } from "./createNotification";

/**
 * When a Task is marked done, find sibling Tasks that list it as a
 * dependency (created as "backlog" by the SOP generator) and flip any
 * whose dependencies are now ALL done to "todo", notifying the owning
 * department. Generic over Task.dependencies — not SOP-specific.
 */
export async function unlockDependentTasks(
    completedTaskId: Types.ObjectId,
    actorId: string,
): Promise<void> {
    const dependents = await Task.find({
        dependencies: completedTaskId,
        status: "backlog",
    });

    for (const dep of dependents) {
        const depTasks = await Task.find({ _id: { $in: dep.dependencies } }).select("status");
        const allDone = depTasks.length > 0 && depTasks.every((d) => d.status === "done");
        if (!allDone) continue;

        dep.status = "todo";
        await dep.save();

        if (!dep.department) continue;

        const department = await Department.findById(dep.department).select("heads members");
        if (!department) continue;

        const recipients = new Set<string>([
            ...department.heads.map((h) => h.toString()),
            ...department.members.map((m) => m.toString()),
        ]);
        recipients.delete(actorId);
        if (recipients.size === 0) continue;

        await createNotifications(
            [...recipients].map((recipient) => ({
                recipient,
                sender: actorId,
                type: "status_change" as const,
                title: "New step ready to start",
                message: `"${dep.title}" is now unblocked and ready for your department.`,
                link: dep.project ? `/projects/${dep.project}` : "/tasks",
            })),
        );
    }
}
