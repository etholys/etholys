import { Prisma } from '@prisma/client';
import { getForgeDb } from '@/lib/forge/db';
import { parseGameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { getForgeEngine, validateAndPrepareSpec } from '@/lib/forge/engines';
import {
  isExpedicionV2Spec,
  withExpedicionV2RoomFlags,
} from '@/lib/forge/expedicion-v2/board-v2-mode';
import { PLAYER_PAWN_COLORS } from '@/lib/forge/board-spaces';
import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';

type BootstrapOpts = {
  courseId: string;
  activityId: string;
  facilitatorUserId: string;
  liveSessionId?: string | null;
  playGroupId?: string | null;
};

/** Cria (ou recria) uma sala compartilhada com roster de equipas/jogadores. */
export async function bootstrapSharedGameRoom(opts: BootstrapOpts) {
  const { courseId, activityId, facilitatorUserId, liveSessionId, playGroupId } = opts;

  const activity = await getForgeDb().forgeLearningActivity.findFirst({
    where: { id: activityId, module: { courseId } },
    include: { gameSpec: true, module: { include: { course: true } } },
  });
  if (!activity?.gameSpec) throw new Error('Atividade de jogo inválida');

  let playGroup: { id: string; name: string; mode: string } | null = null;
  if (playGroupId) {
    playGroup = await getForgeDb().forgePlayGroup.findFirst({
      where: { id: playGroupId, courseId },
      select: { id: true, name: true, mode: true },
    });
    if (!playGroup) throw new Error('Grupo inválido');
  }

  await getForgeDb().forgeSharedGameRoom.updateMany({
    where: {
      activityId,
      status: 'open',
      ...(playGroupId ? { playGroupId } : {}),
      ...(liveSessionId ? { liveSessionId } : {}),
    },
    data: { status: 'closed' },
  });

  const spec = validateAndPrepareSpec(parseGameSpecV1(activity.gameSpec.definition));
  const engine = getForgeEngine(spec.engine);
  const expedicionV2 = isExpedicionV2Spec(spec);
  const flagV2 = (s: Record<string, unknown>) =>
    expedicionV2 ? withExpedicionV2RoomFlags(s) : s;

  const rosterWhere = {
    courseId,
    status: 'active' as const,
    ...(playGroupId ? { playGroupId } : {}),
  };
  const enrollments = await getForgeDb().forgeEnrollment.findMany({
    where: rosterWhere,
    include: { user: { select: { id: true, name: true, email: true } } },
    take: 24,
  });

  let state: Record<string, unknown>;
  const memberIds = enrollments.map((e) => e.userId);

  if (playGroup?.mode === 'live_team') {
    const { createTeamPlayInitialState } = await import('@/lib/forge/expedicion-board-multi');
    const { createInitialV2State } = await import('@/lib/forge/expedicion-v2/player-state');
    const { V2_TEAM_KEY } = await import('@/lib/forge/expedicion-v2/room-v2-store');
    state = flagV2({
      ...(createTeamPlayInitialState(
        playGroup.name,
        playGroup.id,
        memberIds,
        spec
      ) as unknown as Record<string, unknown>),
      [V2_TEAM_KEY]: createInitialV2State(),
    });
  } else if (enrollments.length >= 2) {
    const { createMultiplayerInitialState, rosterFromEnrollments } = await import(
      '@/lib/forge/expedicion-board-multi'
    );
    const roster = rosterFromEnrollments(
      enrollments.map((e) => ({
        userId: e.userId,
        name: e.user.name,
        email: e.user.email,
      }))
    );
    state = flagV2(createMultiplayerInitialState(roster, spec) as unknown as Record<string, unknown>);
  } else if (playGroupId && playGroup) {
    const { createTeamPlayInitialState } = await import('@/lib/forge/expedicion-board-multi');
    const { createInitialV2State } = await import('@/lib/forge/expedicion-v2/player-state');
    const { V2_TEAM_KEY } = await import('@/lib/forge/expedicion-v2/room-v2-store');
    state = flagV2({
      ...(createTeamPlayInitialState(
        playGroup.name,
        playGroup.id,
        memberIds,
        spec
      ) as unknown as Record<string, unknown>),
      [V2_TEAM_KEY]: createInitialV2State(),
    });
  } else {
    const { createMultiplayerInitialState } = await import('@/lib/forge/expedicion-board-multi');
    const demoName = playGroup?.name ?? 'Equipo 1';
    const roster = [
      {
        userId: `demo:${facilitatorUserId}`,
        name: demoName,
        color: PLAYER_PAWN_COLORS[0],
        position: spec.board?.startSpace ?? 0,
        ecoCredits: 500,
        impactPoints: 0,
        insights: [] as string[],
      },
    ];
    state = flagV2(createMultiplayerInitialState(roster, spec) as unknown as Record<string, unknown>);
  }

  const room = await getForgeDb().forgeSharedGameRoom.create({
    data: {
      activityId,
      courseId,
      liveSessionId: liveSessionId ?? null,
      playGroupId: playGroupId ?? null,
      facilitatorUserId,
      state: state as Prisma.InputJsonValue,
      status: 'open',
      version: 1,
      lastEvents: [{ type: 'room_opened', message: 'Partida compartida iniciada.' }] as Prisma.InputJsonValue,
    },
  });

  return { room, spec: spec as GameSpecV1 };
}

/** Abre salas para todos os grupos live_team do curso que ainda não têm mesa aberta. */
export async function bootstrapAllTeamRooms(
  courseId: string,
  activityId: string,
  facilitatorUserId: string
) {
  const groups = await getForgeDb().forgePlayGroup.findMany({
    where: { courseId, mode: 'live_team' },
    select: { id: true },
    take: 48,
  });

  const openRooms = await getForgeDb().forgeSharedGameRoom.findMany({
    where: { courseId, activityId, status: 'open', playGroupId: { not: null } },
    select: { playGroupId: true },
  });
  const openSet = new Set(openRooms.map((r) => r.playGroupId).filter(Boolean));

  let created = 0;
  for (const g of groups) {
    if (openSet.has(g.id)) continue;
    await bootstrapSharedGameRoom({
      courseId,
      activityId,
      facilitatorUserId,
      playGroupId: g.id,
    });
    created += 1;
  }
  return { created, total: groups.length };
}
