export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncWindowOpenNotifications } from '@/lib/opportunity/deadline-alerts';
import {
  fundColumnDataFromMeta,
  parseFundHubMeta,
  writeFundHubMeta,
} from '@/lib/opportunity/pipeline';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { fundId?: string; watchOpen?: boolean };
  const fundId = String(body.fundId ?? '').trim();
  if (!fundId || typeof body.watchOpen !== 'boolean') {
    return NextResponse.json({ error: 'fundId e watchOpen obrigatórios' }, { status: 400 });
  }

  const fund = await prisma.fund.findFirst({
    where: { id: fundId, companyId: ctx.companyId, isActive: true },
    select: { id: true, notes: true, status: true, name: true, institution: true },
  });
  if (!fund) return NextResponse.json({ error: 'Fundo não encontrado' }, { status: 404 });

  const notes = writeFundHubMeta(fund.notes, { watchOpen: body.watchOpen });
  const cols = fundColumnDataFromMeta(parseFundHubMeta(notes));
  await prisma.fund.update({
    where: { id: fund.id },
    data: {
      notes,
      watchOpen: cols.watchOpen,
      pipelineStatus: cols.pipelineStatus,
      ownerUserId: cols.ownerUserId,
      fundHubMetaJson: cols.fundHubMetaJson,
      lastReviewedAt: new Date(),
    },
  });

  if (body.watchOpen && fund.status === 'open') {
    await syncWindowOpenNotifications(
      ctx.companyId,
      ctx.userId,
      [
        {
          id: fund.id,
          name: fund.name,
          institution: fund.institution,
          status: fund.status,
          notes,
          watchOpen: true,
          fundHubMetaJson: cols.fundHubMetaJson,
        },
      ],
      { watchJustEnabledIds: [fund.id] },
    );
  }

  return NextResponse.json({
    ok: true,
    fundId: fund.id,
    watchOpen: parseFundHubMeta(notes).watchOpen === true,
  });
}
