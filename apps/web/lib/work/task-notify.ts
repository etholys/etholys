import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notify';
import { sendAuthHtmlEmail } from '@/lib/send-auth-email';

export type WorkNotifyKey = 'comment' | 'assign' | 'status';

export function wantsWorkNotify(json: unknown, key: WorkNotifyKey) {
  if (!json || typeof json !== 'object') return true;
  const notify = (json as { notify?: Record<string, boolean> }).notify;
  if (!notify || notify[key] === undefined) return true;
  return notify[key] !== false;
}

export function wantsWorkEmail(json: unknown) {
  if (!json || typeof json !== 'object') return true;
  const notify = (json as { notify?: { email?: boolean } }).notify;
  if (!notify || notify.email === undefined) return true;
  return notify.email !== false;
}

export function taskRoleUserIds(task: {
  assigneeId?: string | null;
  responsibleId?: string | null;
  reviewerId?: string | null;
  creatorId?: string | null;
  collaboratorIds?: unknown;
}) {
  const extra = Array.isArray(task.collaboratorIds)
    ? task.collaboratorIds.map((id) => String(id))
    : [];
  return [task.assigneeId, task.responsibleId, task.reviewerId, task.creatorId, ...extra];
}

async function notifyEmail(opts: {
  userId: string;
  title: string;
  message: string;
  link: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { email: true, name: true },
  });
  if (!user?.email) return;
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.etholys.com';
  const href = `${base.replace(/\/$/, '')}${opts.link.startsWith('/') ? opts.link : `/${opts.link}`}`;
  const safeName = user.name || user.email;
  void sendAuthHtmlEmail({
    to: user.email,
    subject: opts.title,
    html: `<p>Hola ${safeName},</p><p>${opts.message}</p><p><a href="${href}">Abrir en eTask</a></p>`,
  });
}

export function notifyTaskWatchers(opts: {
  actorId: string;
  title: string;
  message: string;
  type: string;
  userIds: Array<string | null | undefined>;
  enabled: boolean;
  email?: boolean;
  link?: string;
}) {
  if (!opts.enabled) return;
  const link = opts.link || '/hub/work';
  const seen = new Set<string>();
  for (const id of opts.userIds) {
    if (!id || id === opts.actorId || seen.has(id)) continue;
    seen.add(id);
    createNotification({
      userId: id,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      link,
    });
    if (opts.email) {
      void notifyEmail({
        userId: id,
        title: opts.title,
        message: opts.message,
        link,
      });
    }
  }
}

export function notifyTaskAssigned(opts: {
  assigneeId: string | null | undefined;
  actorId: string;
  title: string;
  projectId?: string | null;
  prevAssigneeId?: string | null;
  email?: boolean;
  roleLabel?: string;
}) {
  if (!opts.assigneeId || opts.assigneeId === opts.actorId) return;
  if (opts.prevAssigneeId && opts.prevAssigneeId === opts.assigneeId) return;
  const link = opts.projectId ? `/projects/${opts.projectId}` : '/hub/work';
  const role = opts.roleLabel || 'asignada';
  createNotification({
    userId: opts.assigneeId,
    type: 'task_assigned',
    title: 'Nueva tarea asignada',
    message: `Se te ${role}: ${opts.title}`,
    link,
  });
  if (opts.email) {
    void notifyEmail({
      userId: opts.assigneeId,
      title: 'Nueva tarea asignada',
      message: `Se te ${role}: ${opts.title}`,
      link,
    });
  }
}
