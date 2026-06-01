export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getForgeDb } from '@/lib/forge/db';
import { parseGameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { getForgeEngine, validateAndPrepareSpec } from '@/lib/forge/engines';
import {
  canFacilitateSharedGame,
  serializeSharedGameRoom,
} from '@/lib/forge/shared-game-room';
import { loadActivityForForgeAccess, requireForgeTenant } from '@/lib/forge/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const activityId = req.nextUrl.searchParams.get('activityId')?.trim() ?? '';
    const liveSessionId = req.nextUrl.searchParams.get('liveSessionId')?.trim() || undefined;
    const playGroupId = req.nextUrl.searchParams.get('playGroupId')?.trim() || undefined;
    if (!activityId) return NextResponse.json({ error: 'activityId obrigatório' }, { status: 400 });

    const activity = await loadActivityForForgeAccess(activityId, tenant);
    if (!activity) return NextResponse.json({ error: 'Atividade não encontrada' }, { status: 404 });

    const room = await getForgeDb().forgeSharedGameRoom.findFirst({
      where: {
        activityId,
        status: 'open',
        ...(liveSessionId ? { liveSessionId } : {}),
        ...(playGroupId ? { playGroupId } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!room) {
      return NextResponse.json({
        room: null,
        canFacilitate: canFacilitateSharedGame(tenant, activity.module.course.companyId),
      });
    }

    return NextResponse.json({
      room: serializeSharedGameRoom(room),
      canFacilitate: canFacilitateSharedGame(tenant, activity.module.course.companyId, room.facilitatorUserId),
      isHost: room.facilitatorUserId === tenant.userId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      activityId?: string;
      liveSessionId?: string;
      playGroupId?: string;
    };
    const activityId = typeof body.activityId === 'string' ? body.activityId : '';
    if (!activityId) return NextResponse.json({ error: 'activityId obrigatório' }, { status: 400 });

    const activity = await loadActivityForForgeAccess(activityId, tenant);
    if (!activity || activity.type !== 'game' || !activity.gameSpec) {
      return NextResponse.json({ error: 'Atividade de jogo inválida' }, { status: 400 });
    }

    const course = activity.module.course;
    if (!canFacilitateSharedGame(tenant, course.companyId)) {
      return NextResponse.json({ error: 'Solo el facilitador puede iniciar la partida compartida' }, { status: 403 });
    }

    const liveSessionId =
      typeof body.liveSessionId === 'string' && body.liveSessionId ? body.liveSessionId : null;
    const playGroupId =
      typeof body.playGroupId === 'string' && body.playGroupId ? body.playGroupId : null;
    if (liveSessionId) {
      const ls = await getForgeDb().forgeLiveSession.findFirst({
        where: { id: liveSessionId, courseId: course.id },
      });
      if (!ls) return NextResponse.json({ error: 'Sesión en vivo inválida' }, { status: 400 });
    }
    let playGroup: { id: string; name: string; mode: string } | null = null;
    if (playGroupId) {
      playGroup = await getForgeDb().forgePlayGroup.findFirst({
        where: { id: playGroupId, courseId: course.id },
        select: { id: true, name: true, mode: true },
      });
      if (!playGroup) return NextResponse.json({ error: 'Grupo inválido' }, { status: 400 });
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

    const rosterWhere = {
      courseId: course.id,
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
    if (playGroup?.mode === 'live_team' && memberIds.length >= 1) {
      const { createTeamPlayInitialState } = await import('@/lib/forge/expedicion-board-multi');
      state = createTeamPlayInitialState(
        playGroup.name,
        playGroup.id,
        memberIds,
        spec
      ) as unknown as Record<string, unknown>;
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
      state = createMultiplayerInitialState(roster, spec) as unknown as Record<string, unknown>;
    } else {
      state = engine.createInitialState(spec) as Record<string, unknown>;
    }

    const room = await getForgeDb().forgeSharedGameRoom.create({
      data: {
        activityId,
        courseId: course.id,
        liveSessionId,
        playGroupId,
        facilitatorUserId: tenant.userId,
        state: state as Prisma.InputJsonValue,
        status: 'open',
        version: 1,
        lastEvents: [{ type: 'room_opened', message: 'Partida compartida iniciada.' }] as Prisma.InputJsonValue,
      },
    });

    return NextResponse.json(
      { room: serializeSharedGameRoom(room), spec },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
