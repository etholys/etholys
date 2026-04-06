import { prisma } from '@/lib/prisma';

export async function createNotification(opts: {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string;
}) {
  try {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        link: opts.link || null,
      },
    });
  } catch (e) {
    console.error('Error creating notification:', e);
  }
}
