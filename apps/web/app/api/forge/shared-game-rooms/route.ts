export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { bootstrapSharedGameRoom } from '@/lib/forge/bootstrap-shared-rooms';
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
    if (playGroupId) {
      const pg = await getForgeDb().forgePlayGroup.findFirst({
        where: { id: playGroupId, courseId: course.id },
      });
      if (!pg) return NextResponse.json({ error: 'Grupo inválido' }, { status: 400 });
    }

    const { room, spec } = await bootstrapSharedGameRoom({
      courseId: course.id,
      activityId,
      facilitatorUserId: tenant.userId,
      liveSessionId,
      playGroupId,
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
