import { Types } from 'mongoose';
import WorkspaceTask from '../models/shared/WorkspaceTask';
import WorkspaceSOP from '../models/shared/WorkspaceSOP';

/**
 * Mirrors Workspace/backend/src/utils/sopTaskGenerator.ts — creates one Task
 * per SOP step for a project, wiring dependencies from step order numbers
 * to real Task _ids. Idempotent per project+SOP via a `sop:<id>` tag.
 */
export async function generateTasksFromSOP(
  sopId: string | Types.ObjectId,
  projectId: string | Types.ObjectId,
  reporterId: string | Types.ObjectId,
): Promise<void> {
  const sop = await WorkspaceSOP.findById(sopId);
  if (!sop || sop.status !== 'published') return;

  const tag = `sop:${sop._id}`;
  const existing = await WorkspaceTask.countDocuments({ project: projectId, tags: tag });
  if (existing > 0) return;

  const orderToTaskId = new Map<number, Types.ObjectId>();
  const created: { dependsOn: number[]; taskId: Types.ObjectId }[] = [];

  for (const step of sop.steps) {
    const task = await WorkspaceTask.create({
      title: step.title,
      description: step.description || '',
      project: projectId,
      department: step.department,
      reporter: reporterId,
      status: step.dependsOn.length > 0 ? 'backlog' : 'todo',
      priority: 'medium',
      assignees: [],
      isPersonal: false,
      estimatedHours: step.estimatedHours,
      tags: [tag],
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
      await WorkspaceTask.findByIdAndUpdate(t.taskId, { dependencies: depIds });
    }
  }
}
