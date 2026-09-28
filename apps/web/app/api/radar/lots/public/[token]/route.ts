export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { publicLotSnapshot } from '@/lib/radar/trace';

type Ctx = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const publicToken = String(token || '').trim();
  if (publicToken.length < 12) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });
  }

  const lot = await prisma.radarLot.findFirst({
    where: { publicToken },
    include: {
      events: { orderBy: { occurredAt: 'asc' } },
    },
  });
  if (!lot) return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 });

  return NextResponse.json({
    lot: publicLotSnapshot({
      code: lot.code,
      crop: lot.crop,
      qty: lot.qty,
      unitLabel: lot.unitLabel,
      currentStage: lot.currentStage,
      status: lot.status,
      createdAt: lot.createdAt,
      events: lot.events.map((e) => ({
        stage: e.stage,
        occurredAt: e.occurredAt,
        payloadJson: e.payloadJson,
        channel: e.channel,
      })),
    }),
  });
}
