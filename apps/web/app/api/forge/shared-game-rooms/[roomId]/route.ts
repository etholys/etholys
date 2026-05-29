export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import {
  applySharedGameAction,
  canFacilitateSharedGame,
  serializeSharedGameRoom,
} from '@/lib/forge/shared-game-room';
import { loadSharedGameRoomForForgeAccess, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ roomId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { roomId } = await ctx.params;
    const room = await loadSharedGameRoomForForgeAccess(roomId, tenant);
    if (!room) return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 });

    return NextResponse.json({ room: serializeSharedGameRoom(room) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { roomId } = await ctx.params;
    const room = await loadSharedGameRoomForForgeAccess(roomId, tenant);
    if (!room?.activity.gameSpec) {
      return NextResponse.json({ error: 'Sala não encontrada' }, { status: 404 });
    }
    if (room.status !== 'open') {
      return NextResponse.json({ error: 'La partida ya está cerrada' }, { status: 400 });
    }

    const body = (await req.json()) as {
      action?: { type: string; payload?: Record<string, unknown> };
      expectedVersion?: number;
      close?: boolean;
    };

    if (body.close === true) {
      if (!canFacilitateSharedGame(tenant, room.activity.module.course.companyId, room.facilitatorUserId)) {
        return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
      }
      const closed = await getForgeDb().forgeSharedGameRoom.update({
        where: { id: roomId },
        data: { status: 'closed', version: { increment: 1 } },
      });
      return NextResponse.json({ room: serializeSharedGameRoom(closed) });
    }

    if (!body.action?.type) {
      return NextResponse.json({ error: 'action.type obrigatório' }, { status: 400 });
    }

    if (room.facilitatorUserId !== tenant.userId) {
      if (!canFacilitateSharedGame(tenant, room.activity.module.course.companyId, room.facilitatorUserId)) {
        return NextResponse.json(
          { error: 'Solo el facilitador mueve el tablero en vivo' },
          { status: 403 }
        );
      }
    }

    if (
      typeof body.expectedVersion === 'number' &&
      body.expectedVersion !== room.version
    ) {
      return NextResponse.json(
        { error: 'Conflicto de versión — actualiza el tablero', room: serializeSharedGameRoom(room) },
        { status: 409 }
      );
    }

    const prev = (room.state ?? {}) as Record<string, unknown>;
    const { state, events, done } = applySharedGameAction(
      room.activity.gameSpec.definition,
      prev,
      body.action
    );

    const updated = await getForgeDb().forgeSharedGameRoom.update({
      where: { id: roomId },
      data: {
        state,
        lastEvents: events,
        version: { increment: 1 },
        status: done ? 'closed' : 'open',
      },
    });

    return NextResponse.json({
      room: serializeSharedGameRoom(updated),
      events,
      done,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
