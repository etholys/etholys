import 'server-only';

import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notify';

export type UpcomingDeadline = {
  fundId: string;
  name: string;
  institution: string;
  deadline: string;
  daysLeft: number;
  matchScore: number | null;
  status: string;
};

export type RollingOpportunity = {
  fundId: string;
  name: string;
  institution: string;
  type: string;
};

export async function getRollingOpportunities(companyId: string): Promise<RollingOpportunity[]> {
  const funds = await prisma.fund.findMany({
    where: {
      companyId,
      isActive: true,
      status: 'open',
      deadline: null,
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: { id: true, name: true, institution: true, type: true },
  });

  return funds.map((f) => ({
    fundId: f.id,
    name: f.name,
    institution: f.institution,
    type: f.type,
  }));
}

export async function getUpcomingDeadlines(
  companyId: string,
  withinDays = 30,
): Promise<UpcomingDeadline[]> {
  const now = new Date();
  const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);

  const funds = await prisma.fund.findMany({
    where: {
      companyId,
      isActive: true,
      status: 'open',
      deadline: { gte: now, lte: until },
    },
    orderBy: { deadline: 'asc' },
    take: 25,
    select: {
      id: true,
      name: true,
      institution: true,
      deadline: true,
      matchScore: true,
      status: true,
    },
  });

  return funds.map((f) => {
    const deadline = f.deadline!;
    const daysLeft = Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
    return {
      fundId: f.id,
      name: f.name,
      institution: f.institution,
      deadline: deadline.toISOString(),
      daysLeft,
      matchScore: f.matchScore,
      status: f.status,
    };
  });
}

const ALERT_BUCKETS = [14, 7, 3, 1] as const;

function bucketLabel(daysLeft: number): string {
  if (daysLeft <= 1) return '1 dia';
  if (daysLeft <= 3) return '3 dias';
  if (daysLeft <= 7) return '7 dias';
  return '14 dias';
}

/** Cria notificações in-app para prazos próximos (sem duplicar na mesma semana). */
export async function syncDeadlineNotifications(
  companyId: string,
  userId: string,
): Promise<{ created: number; upcoming: number }> {
  const upcoming = await getUpcomingDeadlines(companyId, 30);
  let created = 0;

  for (const item of upcoming) {
    const bucket = ALERT_BUCKETS.find((b) => item.daysLeft <= b);
    if (!bucket) continue;

    const link = `/hub/fundhub/discover/${item.fundId}`;
    const title = `Prazo em ${bucketLabel(item.daysLeft)}`;
    const message = `${item.name} (${item.institution}) — ${item.daysLeft} dia(s) restante(s).`;

    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'opportunity_deadline',
        link,
        title,
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });
    if (existing) continue;

    await createNotification({
      userId,
      type: 'opportunity_deadline',
      title,
      message,
      link,
    });
    created += 1;
  }

  return { created, upcoming: upcoming.length };
}
