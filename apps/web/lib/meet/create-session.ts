import 'server-only';

import { prisma } from '@/lib/prisma';
import { buildMeetRoomUrl } from '@/lib/meet/room';
import { meetRoomSlug, isMeetMirror, type MeetMirror } from '@/lib/meet/types';
import {
  expandMeetOccurrences,
  isMeetRecurrenceFrequency,
  type MeetRecurrenceFrequency,
} from '@/lib/meet/recurrence';

export type CreateMeetSessionInput = {
  companyId: string;
  createdById?: string;
  title: string;
  description?: string;
  mirror?: MeetMirror;
  scheduledAt?: Date | null;
  endsAt?: Date | null;
  projectId?: string | null;
  forgeLiveSessionId?: string | null;
  /** E-mails a pré-registar como convidados */
  inviteEmails?: string[];
  /** Sala permanente (link estável, sem data obrigatória) */
  isPermanent?: boolean;
  /** Recorrência da série (só com scheduledAt) */
  recurrence?: MeetRecurrenceFrequency;
  recurrenceUntil?: Date | null;
};

function meetClientReady(): boolean {
  return typeof (prisma as { meetSession?: { create?: unknown } }).meetSession?.create === 'function';
}

export function assertMeetPrismaReady() {
  if (!meetClientReady()) {
    throw new Error(
      'MeetSession ausente no Prisma Client. Rode: npx prisma generate && aplique prisma/migrations/manual_etholys_meet.sql',
    );
  }
}

async function attachParticipants(
  sessionId: string,
  createdById: string | undefined,
  inviteEmails: string[],
) {
  const emails = inviteEmails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'));
  if (emails.length > 0) {
    await prisma.meetParticipant.createMany({
      data: emails.map((email) => ({
        sessionId,
        email,
        role: 'guest',
      })),
    });
  }
  if (createdById) {
    await prisma.meetParticipant.create({
      data: {
        sessionId,
        userId: createdById,
        role: 'host',
      },
    });
  }
}

async function finalizeRoom(sessionId: string, masterMeetingUrl?: string | null) {
  const roomSlug = meetRoomSlug(sessionId);
  const meetingUrl = masterMeetingUrl || buildMeetRoomUrl(sessionId);
  return prisma.meetSession.update({
    where: { id: sessionId },
    data: { roomSlug, meetingUrl },
  });
}

export async function createMeetSession(input: CreateMeetSessionInput) {
  assertMeetPrismaReady();

  const mirror = input.mirror && isMeetMirror(input.mirror) ? input.mirror : 'loose';
  const title = input.title.trim().slice(0, 200);
  if (!title) throw new Error('title required');

  if (input.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, companyId: input.companyId, isActive: true },
      select: { id: true },
    });
    if (!project) throw new Error('projectId inválido');
  }

  const isPermanent = Boolean(input.isPermanent);
  const recurrence: MeetRecurrenceFrequency =
    !isPermanent && input.recurrence && isMeetRecurrenceFrequency(input.recurrence)
      ? input.recurrence
      : 'none';

  let scheduledAt: Date | null =
    input.scheduledAt === undefined ? (isPermanent ? null : new Date()) : input.scheduledAt;
  let endsAt: Date | null = input.endsAt ?? null;

  if (isPermanent) {
    scheduledAt = null;
    endsAt = null;
  }

  if (recurrence !== 'none') {
    if (!scheduledAt || !Number.isFinite(scheduledAt.getTime())) {
      throw new Error('scheduledAt requerido para recorrência');
    }
    if (!endsAt || endsAt <= scheduledAt) {
      endsAt = new Date(scheduledAt.getTime() + 60 * 60_000);
    }
  }

  const tmpSlug = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const created = await prisma.meetSession.create({
    data: {
      companyId: input.companyId,
      createdById: input.createdById || null,
      title,
      description: input.description?.trim() || null,
      mirror,
      status: 'scheduled',
      scheduledAt,
      endsAt,
      projectId: input.projectId || null,
      forgeLiveSessionId: input.forgeLiveSessionId || null,
      roomSlug: tmpSlug,
      isPermanent,
      recurrence,
      recurrenceUntil: recurrence !== 'none' ? input.recurrenceUntil ?? null : null,
    },
  });

  const master = await finalizeRoom(created.id);
  await prisma.meetSession.update({
    where: { id: master.id },
    data: { seriesId: master.id },
  });
  await attachParticipants(master.id, input.createdById, input.inviteEmails ?? []);

  if (recurrence === 'none' || !scheduledAt || !endsAt) {
    return prisma.meetSession.findUniqueOrThrow({ where: { id: master.id } });
  }

  const slots = expandMeetOccurrences({
    startsAt: scheduledAt,
    endsAt,
    frequency: recurrence,
    until: input.recurrenceUntil,
  });

  // Primeira ocorrência já é o mestre; criar filhos para o resto
  for (const slot of slots.slice(1)) {
    const childTmp = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const child = await prisma.meetSession.create({
      data: {
        companyId: input.companyId,
        createdById: input.createdById || null,
        title,
        description: input.description?.trim() || null,
        mirror,
        status: 'scheduled',
        scheduledAt: slot.startsAt,
        endsAt: slot.endsAt,
        projectId: input.projectId || null,
        forgeLiveSessionId: input.forgeLiveSessionId || null,
        roomSlug: childTmp,
        isPermanent: false,
        recurrence: 'none',
        recurrenceUntil: null,
        seriesId: master.id,
        seriesParentId: master.id,
      },
    });
    // Mesmo link externo da série; roomSlug único só para DB
    await finalizeRoom(child.id, master.meetingUrl);
  }

  return prisma.meetSession.findUniqueOrThrow({ where: { id: master.id } });
}

/** Sessões `live` que já passaram do fim (ou >4h) — limpa o hub «En curso». */
const STALE_LIVE_MAX_MS = 4 * 60 * 60 * 1000;
const STALE_AFTER_END_GRACE_MS = 15 * 60 * 1000;

export async function reconcileStaleLiveMeetSessions(companyId: string): Promise<number> {
  assertMeetPrismaReady();
  const now = Date.now();
  const live = await prisma.meetSession.findMany({
    where: { companyId, status: 'live', isPermanent: false },
    select: { id: true, endsAt: true, startedAt: true, scheduledAt: true },
    take: 200,
  });
  const staleIds = live
    .filter((session) => {
      if (session.endsAt && now > session.endsAt.getTime() + STALE_AFTER_END_GRACE_MS) {
        return true;
      }
      const start = session.startedAt ?? session.scheduledAt;
      return Boolean(start && now > start.getTime() + STALE_LIVE_MAX_MS);
    })
    .map((session) => session.id);

  if (staleIds.length === 0) return 0;

  await prisma.meetSession.updateMany({
    where: { companyId, id: { in: staleIds }, status: 'live' },
    data: { status: 'ended', endedAt: new Date() },
  });
  return staleIds.length;
}

export async function listMeetSessions(
  companyId: string,
  opts?: { limit?: number; projectId?: string },
) {
  assertMeetPrismaReady();
  await reconcileStaleLiveMeetSessions(companyId).catch(() => 0);
  const limit = Math.min(250, Math.max(1, opts?.limit ?? 120));
  return prisma.meetSession.findMany({
    where: {
      companyId,
      ...(opts?.projectId ? { projectId: opts.projectId } : {}),
      status: { not: 'cancelled' },
    },
    orderBy: [{ scheduledAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      participants: {
        orderBy: { invitedAt: 'asc' },
        select: {
          id: true,
          userId: true,
          email: true,
          displayName: true,
          role: true,
          joinedAt: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
      _count: { select: { participants: true, actionItems: true } },
    },
  });
}

export async function getMeetSessionForCompany(sessionId: string, companyId: string) {
  assertMeetPrismaReady();
  return prisma.meetSession.findFirst({
    where: { id: sessionId, companyId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      participants: {
        orderBy: { invitedAt: 'asc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      actionItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
}

/** Id da sala real a abrir no Hub (mestre da série se for ocorrência). */
export function meetJoinSessionId(session: {
  id: string;
  seriesParentId?: string | null;
}): string {
  return session.seriesParentId || session.id;
}

export type MeetDeleteScope = 'this' | 'following' | 'series';
export type MeetEditScope = MeetDeleteScope;

/** Propaga edições a uma ocorrência, às seguintes, ou a toda a série. */
export async function updateMeetSessionScoped(input: {
  sessionId: string;
  companyId: string;
  scope?: MeetEditScope;
  title?: string;
  description?: string | null;
  scheduledAt?: Date | null;
  endsAt?: Date | null;
}) {
  assertMeetPrismaReady();
  const existing = await prisma.meetSession.findFirst({
    where: { id: input.sessionId, companyId: input.companyId },
  });
  if (!existing) return null;

  const scope = input.scope || 'this';
  const seriesId = existing.seriesId || existing.id;
  const inSeries = Boolean(
    existing.seriesId ||
      existing.seriesParentId ||
      (existing.recurrence && existing.recurrence !== 'none'),
  );

  const oldStart = existing.scheduledAt?.getTime() ?? null;
  const oldEnd = existing.endsAt?.getTime() ?? null;
  const newStart =
    input.scheduledAt === undefined ? undefined : (input.scheduledAt?.getTime() ?? null);
  const newEnd = input.endsAt === undefined ? undefined : (input.endsAt?.getTime() ?? null);
  const startDelta = oldStart != null && newStart != null ? newStart - oldStart : 0;
  const durationMs =
    newStart != null && newEnd != null
      ? Math.max(15 * 60_000, newEnd - newStart)
      : oldStart != null && oldEnd != null
        ? Math.max(15 * 60_000, oldEnd - oldStart)
        : 60 * 60_000;

  const baseData: {
    title?: string;
    description?: string | null;
    scheduledAt?: Date | null;
    endsAt?: Date | null;
  } = {};
  if (input.title !== undefined) baseData.title = input.title;
  if (input.description !== undefined) baseData.description = input.description;

  const include = {
    createdBy: { select: { id: true, name: true, email: true } },
    participants: {
      orderBy: { invitedAt: 'asc' as const },
      include: { user: { select: { id: true, name: true, email: true } } },
    },
  };

  if (!inSeries || scope === 'this') {
    if (input.scheduledAt !== undefined) baseData.scheduledAt = input.scheduledAt;
    if (input.endsAt !== undefined) baseData.endsAt = input.endsAt;
    return prisma.meetSession.update({
      where: { id: existing.id },
      data: baseData,
      include,
    });
  }

  const targets = await prisma.meetSession.findMany({
    where:
      scope === 'following'
        ? {
            companyId: input.companyId,
            OR: [
              { id: existing.id },
              {
                seriesId,
                scheduledAt: { gte: existing.scheduledAt ?? existing.createdAt },
              },
            ],
          }
        : {
            companyId: input.companyId,
            OR: [{ id: seriesId }, { seriesId }],
          },
    select: { id: true, scheduledAt: true },
  });

  await prisma.$transaction(
    targets.map((row) => {
      const data: typeof baseData = { ...baseData };
      if (input.scheduledAt !== undefined || input.endsAt !== undefined) {
        if (row.id === existing.id) {
          if (input.scheduledAt !== undefined) data.scheduledAt = input.scheduledAt;
          if (input.endsAt !== undefined) data.endsAt = input.endsAt;
        } else if (row.scheduledAt && (startDelta !== 0 || input.endsAt !== undefined)) {
          const shiftedStart = new Date(row.scheduledAt.getTime() + startDelta);
          data.scheduledAt = shiftedStart;
          data.endsAt = new Date(shiftedStart.getTime() + durationMs);
        }
      }
      return prisma.meetSession.update({ where: { id: row.id }, data });
    }),
  );

  return prisma.meetSession.findFirst({
    where: { id: existing.id, companyId: input.companyId },
    include,
  });
}

export async function deleteMeetSessionScoped(input: {
  sessionId: string;
  companyId: string;
  scope?: MeetDeleteScope;
}) {
  assertMeetPrismaReady();
  const existing = await prisma.meetSession.findFirst({
    where: { id: input.sessionId, companyId: input.companyId },
  });
  if (!existing) return { deleted: 0 };

  const scope = input.scope || 'this';
  const seriesId = existing.seriesId || existing.id;

  if (scope === 'series' || existing.isPermanent) {
    const result = await prisma.meetSession.deleteMany({
      where: {
        companyId: input.companyId,
        OR: [{ id: seriesId }, { seriesId }],
      },
    });
    return { deleted: result.count };
  }

  if (scope === 'following') {
    const from = existing.scheduledAt ?? existing.createdAt;
    const result = await prisma.meetSession.deleteMany({
      where: {
        companyId: input.companyId,
        OR: [
          { id: existing.id },
          {
            seriesId,
            scheduledAt: { gte: from },
          },
        ],
      },
    });
    return { deleted: result.count };
  }

  await prisma.meetSession.delete({ where: { id: existing.id } });
  return { deleted: 1 };
}
