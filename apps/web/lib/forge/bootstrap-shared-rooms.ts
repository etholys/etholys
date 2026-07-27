import { Prisma } from '@prisma/client';
import { getForgeDb } from '@/lib/forge/db';
import { parseGameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { validateAndPrepareSpec } from '@/lib/forge/engines';
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
  /** Só reinicia tabuleiro se true; por omissão reutiliza sala aberta (não apaga mapa/ledger). */
  forceRestart?: boolean;
};

/** Cria (ou reutiliza) uma sala compartilhada com roster de equipas/jogadores.
 *  Por omissão NÃO apaga uma sala aberta existente (preserva mapa/ledger V2).
 *  Passar `forceRestart: true` só quando o facilitador pedir reinício explícito.
 */
export async function bootstrapSharedGameRoom(opts: BootstrapOpts) {
  const { courseId, activityId, facilitatorUserId, liveSessionId, playGroupId, forceRestart } =
    opts;

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

  const existingOpen = await getForgeDb().forgeSharedGameRoom.findFirst({
    where: {
      activityId,
      status: 'open',
      ...(playGroupId ? { playGroupId } : { playGroupId: null }),
      ...(liveSessionId ? { liveSessionId } : {}),
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (existingOpen && !forceRestart) {
    const spec = validateAndPrepareSpec(parseGameSpecV1(activity.gameSpec.definition));
    return { room: existingOpen, spec: spec as GameSpecV1 };
  }

  const { V2_TEAM_KEY } = await import('@/lib/forge/expedicion-v2/room-v2-store');
  const preservedV2 =
    existingOpen != null
      ? (existingOpen.state as Record<string, unknown> | null)?.[V2_TEAM_KEY]
      : undefined;

  await getForgeDb().forgeSharedGameRoom.updateMany({
    where: {
      activityId,
      status: 'open',
      ...(playGroupId ? { playGroupId } : { playGroupId: null }),
      ...(liveSessionId ? { liveSessionId } : {}),
    },
    data: { status: 'closed' },
  });

  const spec = validateAndPrepareSpec(parseGameSpecV1(activity.gameSpec.definition));
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
  const { createInitialV2State } = await import('@/lib/forge/expedicion-v2/player-state');
  const v2Initial = preservedV2 ?? createInitialV2State();

  if (playGroup?.mode === 'live_team') {
    const { createTeamPlayInitialState } = await import('@/lib/forge/expedicion-board-multi');
    state = flagV2({
      ...(createTeamPlayInitialState(
        playGroup.name,
        playGroup.id,
        memberIds,
        spec
      ) as unknown as Record<string, unknown>),
      [V2_TEAM_KEY]: v2Initial,
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
    state = flagV2({
      ...(createMultiplayerInitialState(roster, spec) as unknown as Record<string, unknown>),
      ...(expedicionV2 ? { [V2_TEAM_KEY]: v2Initial } : {}),
    });
  } else if (playGroupId && playGroup) {
    const { createTeamPlayInitialState } = await import('@/lib/forge/expedicion-board-multi');
    state = flagV2({
      ...(createTeamPlayInitialState(
        playGroup.name,
        playGroup.id,
        memberIds,
        spec
      ) as unknown as Record<string, unknown>),
      [V2_TEAM_KEY]: v2Initial,
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
    state = flagV2({
      ...(createMultiplayerInitialState(roster, spec) as unknown as Record<string, unknown>),
      ...(expedicionV2 ? { [V2_TEAM_KEY]: v2Initial } : {}),
    });
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
      lastEvents: [
        {
          type: 'room_opened',
          message: forceRestart
            ? 'Tablero reiniciado (mapa y finanzas preservados).'
            : 'Partida compartida iniciada.',
        },
      ] as Prisma.InputJsonValue,
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
