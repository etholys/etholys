import 'server-only';

import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notify';
import {
  fundColumnDataFromMeta,
  parseFundHubMeta,
  writeFundHubMeta,
} from '@/lib/opportunity/pipeline';
import { decideWatchReopenNotify } from '@/lib/opportunity/watch-reopen';

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

export type WatchedProgram = {
  fundId: string;
  name: string;
  institution: string;
  status: string;
  watchOpen: true;
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

/** R2 — usa coluna watchOpen (com fallback notes) em vez de só regex. */
export async function getWatchedPrograms(companyId: string): Promise<WatchedProgram[]> {
  const funds = await prisma.fund.findMany({
    where: {
      companyId,
      isActive: true,
      OR: [{ watchOpen: true }, { notes: { contains: '"watchOpen":true' } }],
    },
    orderBy: { updatedAt: 'desc' },
    take: 80,
    select: { id: true, name: true, institution: true, status: true, notes: true, watchOpen: true },
  });
  return funds
    .filter((f) => f.watchOpen === true || /"watchOpen":true/.test(f.notes ?? ''))
    .map((f) => ({
      fundId: f.id,
      name: f.name,
      institution: f.institution,
      status: f.status,
      watchOpen: true as const,
    }));
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

type WatchSyncFund = {
  id: string;
  name: string;
  institution: string;
  status: string;
  notes?: string | null;
  watchOpen?: boolean | null;
  fundHubMetaJson?: unknown;
};

/**
 * F5/R2 — programas com relógio: notifica só em reabertura (closed→open)
 * ou ao ligar o watch com janela já aberta. Persiste lastSeenStatus.
 */
export async function syncWindowOpenNotifications(
  companyId: string,
  userId: string,
  funds?: WatchSyncFund[],
  opts?: { watchJustEnabledIds?: string[] },
): Promise<{ created: number; checked: number }> {
  const justEnabled = new Set(opts?.watchJustEnabledIds ?? []);
  const rows: WatchSyncFund[] =
    funds ??
    (
      await prisma.fund.findMany({
        where: {
          companyId,
          isActive: true,
          OR: [{ watchOpen: true }, { notes: { contains: '"watchOpen":true' } }],
        },
        select: {
          id: true,
          name: true,
          institution: true,
          status: true,
          notes: true,
          watchOpen: true,
          fundHubMetaJson: true,
        },
        take: 80,
      })
    );

  let created = 0;
  let checked = 0;

  for (const item of rows) {
    const meta = parseFundHubMeta(item.notes);
    const fromJson =
      item.fundHubMetaJson && typeof item.fundHubMetaJson === 'object' && !Array.isArray(item.fundHubMetaJson)
        ? (item.fundHubMetaJson as { lastSeenStatus?: string; watchOpen?: boolean })
        : {};
    const watchOpen =
      item.watchOpen === true || meta.watchOpen === true || fromJson.watchOpen === true;
    if (!watchOpen) continue;
    checked += 1;

    const lastSeen = meta.lastSeenStatus ?? fromJson.lastSeenStatus ?? null;
    const decision = decideWatchReopenNotify({
      watchOpen: true,
      currentStatus: item.status,
      lastSeenStatus: lastSeen,
      watchJustEnabled: justEnabled.has(item.id),
    });

    if (decision.nextLastSeenStatus !== lastSeen) {
      const notes = writeFundHubMeta(item.notes, { lastSeenStatus: decision.nextLastSeenStatus });
      const cols = fundColumnDataFromMeta(parseFundHubMeta(notes));
      await prisma.fund
        .update({
          where: { id: item.id },
          data: {
            notes,
            fundHubMetaJson: cols.fundHubMetaJson,
          },
        })
        .catch(() => {});
    }

    if (!decision.shouldNotify) continue;

    const link = `/hub/fundhub/discover/${item.id}`;
    const existing = await prisma.notification.findFirst({
      where: {
        userId,
        type: 'opportunity_window_open',
        link,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    if (existing) continue;

    await createNotification({
      userId,
      type: 'opportunity_window_open',
      title: 'Janela aberta',
      message: `${item.name} (${item.institution}) voltou a ter janela aberta.`,
      link,
    });
    created += 1;
  }
  return { created, checked };
}

/**
 * Actualiza status de um fundo com relógio e dispara notificação se reabriu.
 */
export async function applyWatchedStatusChange(opts: {
  companyId: string;
  userId: string;
  fundId: string;
  nextStatus: string;
}): Promise<{ notified: boolean; status: string }> {
  const fund = await prisma.fund.findFirst({
    where: { id: opts.fundId, companyId: opts.companyId, isActive: true },
    select: {
      id: true,
      name: true,
      institution: true,
      status: true,
      notes: true,
      watchOpen: true,
      fundHubMetaJson: true,
    },
  });
  if (!fund) throw new Error('Fundo não encontrado');

  const meta = parseFundHubMeta(fund.notes);
  const watchOpen = fund.watchOpen === true || meta.watchOpen === true;
  const previousStatus = fund.status;
  const notes = writeFundHubMeta(fund.notes, {
    lastSeenStatus: previousStatus,
  });
  const cols = fundColumnDataFromMeta(parseFundHubMeta(notes));

  await prisma.fund.update({
    where: { id: fund.id },
    data: {
      status: opts.nextStatus.slice(0, 40),
      notes,
      fundHubMetaJson: cols.fundHubMetaJson,
      lastReviewedAt: new Date(),
    },
  });

  if (!watchOpen) return { notified: false, status: opts.nextStatus };

  const result = await syncWindowOpenNotifications(
    opts.companyId,
    opts.userId,
    [
      {
        id: fund.id,
        name: fund.name,
        institution: fund.institution,
        status: opts.nextStatus,
        notes,
        watchOpen: true,
        fundHubMetaJson: cols.fundHubMetaJson,
      },
    ],
  );
  return { notified: result.created > 0, status: opts.nextStatus };
}
