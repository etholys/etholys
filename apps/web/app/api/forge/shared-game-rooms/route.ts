export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
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
    if (!activityId) return NextResponse.json({ error: 'activityId obrigatório' }, { status: 400 });

    const activity = await loadActivityForForgeAccess(activityId, tenant);
    if (!activity) return NextResponse.json({ error: 'Atividade não encontrada' }, { status: 404 });

    const room = await getForgeDb().forgeSharedGameRoom.findFirst({
      where: { activityId, status: 'open' },
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

    const body = (await req.json()) as { activityId?: string; liveSessionId?: string };
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
    if (liveSessionId) {
      const ls = await getForgeDb().forgeLiveSession.findFirst({
        where: { id: liveSessionId, courseId: course.id },
      });
      if (!ls) return NextResponse.json({ error: 'Sesión en vivo inválida' }, { status: 400 });
    }

    await getForgeDb().forgeSharedGameRoom.updateMany({
      where: { activityId, status: 'open' },
      data: { status: 'closed' },
    });

    const spec = validateAndPrepareSpec(parseGameSpecV1(activity.gameSpec.definition));
    const engine = getForgeEngine(spec.engine);
    const state = engine.createInitialState(spec);

    const room = await getForgeDb().forgeSharedGameRoom.create({
      data: {
        activityId,
        courseId: course.id,
        liveSessionId,
        facilitatorUserId: tenant.userId,
        state,
        status: 'open',
        version: 1,
        lastEvents: [{ type: 'room_opened', message: 'Partida compartida iniciada.' }],
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
