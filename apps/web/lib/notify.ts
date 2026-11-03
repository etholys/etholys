import { prisma } from '@/lib/prisma';
import { sendWebPushToUser } from '@/lib/web-push';

export async function createNotification(opts: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  companyId?: string | null;
  taskId?: string | null;
  /** When false, skip browser Web Push (still persists in-app). Default true. */
  push?: boolean;
}) {
  try {
    const row = await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        link: opts.link || null,
        companyId: opts.companyId || null,
        taskId: opts.taskId || null,
      },
    });

    if (opts.push !== false) {
      void sendWebPushToUser(opts.userId, {
        title: opts.title,
        body: opts.message,
        url: opts.link || '/hub',
        tag: opts.type,
      });
    }

    return row;
  } catch (e) {
    console.error('Error creating notification:', e);
    return null;
  }
}

export async function markNotificationsRead(opts: {
  userId: string;
  id?: string;
  markAll?: boolean;
}) {
  const now = new Date();
  if (opts.markAll) {
    await prisma.notification.updateMany({
      where: { userId: opts.userId, read: false },
      data: { read: true, readAt: now },
    });
    return;
  }
  if (opts.id) {
    await prisma.notification.updateMany({
      where: { id: opts.id, userId: opts.userId },
      data: { read: true, readAt: now },
    });
  }
}
