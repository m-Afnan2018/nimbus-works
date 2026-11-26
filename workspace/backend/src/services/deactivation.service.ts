import Department from '../models/Department';
import Project from '../models/Project';
import Task from '../models/Task';
import { createNotifications } from '../utils/createNotification';

/**
 * Strips a deactivated user out of Departments/Projects and unassigns them
 * from Tasks, leaving a trace (unassignedNotices) on each affected task and
 * notifying the task reporter.
 */
export async function cascadeUserDeactivation(userId: string, actorId: string): Promise<void> {
  await Promise.all([
    Department.updateMany(
      { $or: [{ heads: userId }, { members: userId }, { collaborators: userId }] },
      { $pull: { heads: userId, members: userId, collaborators: userId } }
    ),
    Project.updateMany(
      { 'members.user': userId },
      { $pull: { members: { user: userId } } }
    ),
  ]);

  const affectedTasks = await Task.find({ assignees: userId }).select('_id reporter title');
  if (affectedTasks.length === 0) return;

  const taskIds = affectedTasks.map((t) => t._id);
  await Task.updateMany(
    { _id: { $in: taskIds } },
    {
      $pull: { assignees: userId },
      $push: { unassignedNotices: { user: userId, reason: 'user_deactivated', at: new Date() } },
    }
  );

  const notifications = affectedTasks
    .filter((t) => t.reporter && t.reporter.toString() !== actorId)
    .map((t) => ({
      recipient: t.reporter.toString(),
      sender: actorId,
      type: 'task_unassigned' as const,
      title: 'Task unassigned',
      message: `An assignee was removed from "${t.title}" because their account was deactivated.`,
      link: `/tasks/${t._id}`,
    }));

  if (notifications.length) await createNotifications(notifications);
}
