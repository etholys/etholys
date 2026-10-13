import { createNotification } from '@/lib/notify';

export function wantsWorkNotify(json: unknown, key: 'comment' | 'assign' | 'status') {
  if (!json || typeof json !== 'object') return true;
  const notify = (json as { notify?: Record<string, boolean> }).notify;
  if (!notify || notify[key] === undefined) return true;
  return notify[key] !== false;
}

export function notifyTaskWatchers(opts: {
  actorId: string;
  title: string;
  message: string;
  type: string;
  userIds: Array<string | null | undefined>;
  enabled: boolean;
}) {
  if (!opts.enabled) return;
  const seen = new Set<string>();
  for (const id of opts.userIds) {
    if (!id || id === opts.actorId || seen.has(id)) continue;
    seen.add(id);
    createNotification({
      userId: id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link: '/hub/work',
    });
  }
}

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
