export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { requireForgeTenant } from '@/lib/forge/tenant';
import { getForgeDb } from '@/lib/forge/db';
import { ensureLearnerJourney } from '@/lib/forge/learner-journey';
import {
  mergeV2IntoMapState,
  v2FromJourneyMapState,
} from '@/lib/forge/expedicion-v2/player-state';
import { normalizeV2State } from '@/lib/forge/expedicion-v2/normalize-v2';
import { applyV2Action, V2ActionError } from '@/lib/forge/expedicion-v2/apply-v2-action';
import {
  mergeV2IntoRoomState,
  v2FromRoomState,
} from '@/lib/forge/expedicion-v2/room-v2-store';
import { canPlayerAct, parseMulti } from '@/lib/forge/expedicion-board-multi';
import {
  canFacilitateSharedGame,
  serializeSharedGameRoom,
} from '@/lib/forge/shared-game-room';
import { loadSharedGameRoomForForgeAccess } from '@/lib/forge/tenant';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { creditPeerConsultancy } from '@/lib/forge/expedicion-v2/peer-consultancy';
import { CONSULTANCY_OPTIONS } from '@/lib/forge/expedicion-v2/consultancy';
import {
  applyFacilitatorBatchV2,
  isBatchFacilitatorAction,
} from '@/lib/forge/expedicion-v2/facilitator-batch';

type Ctx = { params: Promise<{ id: string }> };

const FACILITATOR_ACTIONS = new Set([
  'approve_micro_caso',
  'reject_micro_caso',
  'award_feria_pitch',
  'reject_feria_pitch',
  'reset_v2',
  'force_post_quiz',
  'open_pre_quiz',
  'open_post_quiz',
  'return_to_lobby',
  'start_playing',
  'open_pre_quiz_all',
  'open_post_quiz_all',
  'return_to_lobby_all',
  'reset_v2_all',
  'start_playing_all',
  'bootstrap_team_rooms',
]);

async function authorizeCourse(courseId: string, userId: string, companyIds: string[]) {
  return getForgeDb().forgeCourse.findFirst({
    where: {
      id: courseId,
      OR: [{ companyId: { in: companyIds } }, { enrollments: { some: { userId } } }],
    },
  });
}

async function resolveTeamRoom(roomId: string, courseId: string, tenant: Awaited<ReturnType<typeof requireForgeTenant>>) {
  if (!tenant) return null;
  const room = await loadSharedGameRoomForForgeAccess(roomId, tenant);
  if (!room || room.courseId !== courseId) return null;
  const multi = parseMulti((room.state ?? {}) as Record<string, unknown>);
  if (!multi?.teamPlay) return null;
  return room;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { id: courseId } = await ctx.params;
    const course = await authorizeCourse(courseId, tenant.userId, tenant.companyIds);
    if (!course) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

    const roomId = req.nextUrl.searchParams.get('roomId')?.trim();
    const observeUserId = req.nextUrl.searchParams.get('observeUserId')?.trim();
    if (observeUserId) {
      const access = await getForgeCourseAccess(
        tenant.userId,
        course.companyId,
        course.id,
        course.createdById
      );
      if (!access.canFacilitate) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
      }
      const journey = await getForgeDb().forgeLearnerJourney.findFirst({
        where: { courseId, userId: observeUserId },
      });
      if (!journey) {
        return NextResponse.json({ error: 'Jugador no encontrado' }, { status: 404 });
      }
      const mapState = (journey.mapState ?? {}) as Record<string, unknown>;
      const v2 = v2FromJourneyMapState(mapState);
      const liveConfig = (course.liveConfig ?? {}) as Record<string, unknown>;
      return NextResponse.json({
        v2,
        teamMode: false,
        observeUserId,
        sessionFormat: liveConfig.sessionFormat ?? 'online',
        videoEnabled: liveConfig.videoEnabled !== false,
      });
    }
    if (roomId) {
      const room = await resolveTeamRoom(roomId, courseId, tenant);
      if (room) {
        const prev = (room.state ?? {}) as Record<string, unknown>;
        let v2 = v2FromRoomState(prev);
        const { v2: normalized, changed } = normalizeV2State(v2);
        v2 = normalized;
        if (changed) {
          await getForgeDb().forgeSharedGameRoom.update({
            where: { id: room.id },
            data: {
              state: mergeV2IntoRoomState(prev, v2) as Prisma.InputJsonValue,
            },
          });
        }
        const liveConfig = (course.liveConfig ?? {}) as Record<string, unknown>;
        return NextResponse.json({
          v2,
          teamMode: true,
          roomId: room.id,
          sessionFormat: liveConfig.sessionFormat ?? 'online',
          videoEnabled: liveConfig.videoEnabled !== false,
        });
      }
    }

    const journey = await ensureLearnerJourney(courseId, tenant.userId);
    let mapState = (journey.mapState ?? {}) as Record<string, unknown>;
    if (!mapState.v2) {
      const { createInitialV2State, mergeV2IntoMapState } = await import(
        '@/lib/forge/expedicion-v2/player-state'
      );
      mapState = mergeV2IntoMapState(mapState, createInitialV2State());
      await getForgeDb().forgeLearnerJourney.update({
        where: { id: journey.id },
        data: { mapState: mapState as object },
      });
    }
    let v2 = v2FromJourneyMapState(mapState);
    const { v2: normalized, changed } = normalizeV2State(v2);
    v2 = normalized;
    if (changed) {
      mapState = mergeV2IntoMapState(mapState, v2);
      await getForgeDb().forgeLearnerJourney.update({
        where: { id: journey.id },
        data: { mapState: mapState as object },
      });
    }
    const liveConfig = (course.liveConfig ?? {}) as Record<string, unknown>;
    return NextResponse.json({
      v2,
      teamMode: false,
      sessionFormat: liveConfig.sessionFormat ?? 'online',
      videoEnabled: liveConfig.videoEnabled !== false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { id: courseId } = await ctx.params;
    const course = await authorizeCourse(courseId, tenant.userId, tenant.companyIds);
    if (!course) return NextResponse.json({ error: 'Curso no encontrado' }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;
    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    const action = String(body.action ?? '');

    if (FACILITATOR_ACTIONS.has(action)) {
      const access = await getForgeCourseAccess(
        tenant.userId,
        course.companyId,
        course.id,
        course.createdById
      );
      if (!access.canFacilitate) {
        return NextResponse.json({ error: 'Solo el facilitador puede usar esta acción' }, { status: 403 });
      }
    }

    if (action === 'bootstrap_team_rooms') {
      const activityId = typeof body.activityId === 'string' ? body.activityId.trim() : '';
      if (!activityId) {
        return NextResponse.json({ error: 'activityId obrigatório' }, { status: 400 });
      }
      const { bootstrapAllTeamRooms } = await import('@/lib/forge/bootstrap-shared-rooms');
      const result = await bootstrapAllTeamRooms(courseId, activityId, tenant.userId);
      return NextResponse.json({ ok: true, ...result });
    }

    if (isBatchFacilitatorAction(action)) {
      const { updated } = await applyFacilitatorBatchV2(courseId, action);
      return NextResponse.json({ ok: true, updated });
    }

    if (roomId) {
      const room = await resolveTeamRoom(roomId, courseId, tenant);
      if (!room) {
        return NextResponse.json({ error: 'Sala de equipo no encontrada' }, { status: 404 });
      }
      const prev = (room.state ?? {}) as Record<string, unknown>;
      const multi = parseMulti(prev);
      const isFac = canFacilitateSharedGame(
        tenant,
        room.activity.module.course.companyId,
        room.facilitatorUserId
      );
      if (multi && !canPlayerAct(multi, tenant.userId, isFac, false)) {
        return NextResponse.json({ error: 'No eres miembro de esta mesa' }, { status: 403 });
      }

      let v2 = v2FromRoomState(prev);
      try {
        v2 = applyV2Action(v2, body);
      } catch (e) {
        if (e instanceof V2ActionError) {
          return NextResponse.json({ error: e.message }, { status: e.status });
        }
        throw e;
      }

      const updated = await getForgeDb().forgeSharedGameRoom.update({
        where: { id: roomId },
        data: {
          state: mergeV2IntoRoomState(prev, v2) as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });

      return NextResponse.json({
        v2,
        teamMode: true,
        room: serializeSharedGameRoom(updated),
      });
    }

    const journey = await ensureLearnerJourney(courseId, tenant.userId);
    const mapState = (journey.mapState ?? {}) as Record<string, unknown>;
    let v2 = v2FromJourneyMapState(mapState);

    try {
      v2 = applyV2Action(v2, body);
    } catch (e) {
      if (e instanceof V2ActionError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      throw e;
    }

    await getForgeDb().forgeLearnerJourney.update({
      where: { id: journey.id },
      data: { mapState: mergeV2IntoMapState(mapState, v2) as object },
    });

    if (action === 'consultancy' && body.optionId === 'companero') {
      const peerUserId = typeof body.peerUserId === 'string' ? body.peerUserId : '';
      const opt = CONSULTANCY_OPTIONS.find((o) => o.id === 'companero');
      if (peerUserId && opt) {
        const payer = await getForgeDb().user.findUnique({
          where: { id: tenant.userId },
          select: { name: true, email: true },
        });
        const payerName = payer?.name ?? payer?.email?.split('@')[0];
        await creditPeerConsultancy(courseId, peerUserId, opt.cost, payerName ?? undefined);
      }
    }

    return NextResponse.json({ v2, teamMode: false });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
