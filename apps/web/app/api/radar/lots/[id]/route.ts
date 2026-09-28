export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import {
  TRACE_STAGE_LABEL,
  isTraceStage,
  nextStage,
  sharePath,
} from '@/lib/radar/trace';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const companyId = String(new URL(req.url).searchParams.get('companyId') || '').trim();
  const engagementId = String(new URL(req.url).searchParams.get('engagementId') || '').trim() || null;
  if (!companyId || !id) return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }

  const lot = await prisma.radarLot.findFirst({
    where: { id, companyId },
    include: {
      unit: { select: { id: true, name: true } },
      events: { orderBy: { occurredAt: 'asc' } },
    },
  });
  if (!lot) return NextResponse.json({ error: 'Lote não encontrado.' }, { status: 404 });

  const stage = isTraceStage(lot.currentStage) ? lot.currentStage : 'harvest';
  return NextResponse.json({
    lot: {
      id: lot.id,
      code: lot.code,
      crop: lot.crop,
      qty: lot.qty,
      unitLabel: lot.unitLabel || 'kg',
      status: lot.status,
      currentStage: stage,
      nextStage: nextStage(stage),
      unitId: lot.unitId,
      unitName: lot.unit?.name || null,
      createdAt: lot.createdAt.toISOString(),
      sharePath: sharePath(lot.publicToken),
      events: lot.events.map((e) => {
        const st = isTraceStage(e.stage) ? e.stage : 'harvest';
        const payload = (e.payloadJson || {}) as Record<string, unknown>;
        return {
          id: e.id,
          stage: st,
          stageLabel: TRACE_STAGE_LABEL[st],
          occurredAt: e.occurredAt.toISOString(),
          channel: e.channel,
          note: String(payload.note || ''),
          destination: payload.destination ? String(payload.destination) : null,
          buyer: payload.buyer ? String(payload.buyer) : null,
          carrier: payload.carrier ? String(payload.carrier) : null,
        };
      }),
    },
  });
}
