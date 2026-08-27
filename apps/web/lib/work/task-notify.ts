import { createNotification } from '@/lib/notify';

export function notifyTaskAssigned(opts: {
  assigneeId: string | null | undefined;
  actorId: string;
  title: string;
  projectId?: string | null;
  prevAssigneeId?: string | null;
}) {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  if (opts.prevAssigneeId && opts.prevAssigneeId === opts.assigneeId) return;
  createNotification({
    userId: opts.assigneeId,
    type: 'task_assigned',
    title: 'Nueva tarea asignada',
    message: `Se te asignó: ${opts.title}`,
    link: opts.projectId ? `/projects/${opts.projectId}` : '/hub/work',
  });
}
