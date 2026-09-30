export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { successFeeAllowed, successFeeBlockReason } from '@/lib/fundhub/success-fee-policy';
import { getCommissionRateBps, scanFundhubSuccessFees } from '@/lib/billing/commissions';

/** Lista eventos de success fee + política da empresa. */
export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const company = await prisma.company.findUnique({
    where: { id: ctx.companyId },
    select: { entityType: true, description: true },
  });
  const allowed = successFeeAllowed(company?.entityType, company?.description);
  const rateBps = await getCommissionRateBps(ctx.companyId, 'commission.fundhub.success_fee');

  const events = await prisma.billingCommissionEvent.findMany({
    where: { companyId: ctx.companyId, skuCode: 'commission.fundhub.success_fee' },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });

  return NextResponse.json({
    allowed,
    blockedReason: allowed
      ? null
      : successFeeBlockReason(company?.entityType, company?.description),
    rateBps,
    entitlementActive: rateBps != null,
    events: events.map((e) => ({
      id: e.id,
      sourceType: e.sourceType,
      sourceId: e.sourceId,
      baseAmountCents: e.baseAmountCents,
      amountCents: e.amountCents,
      currency: e.currency,
      rateBps: e.rateBps,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}

/** Dispara scan de fees (admin implícito via resolve company). */
export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const result = await scanFundhubSuccessFees(ctx.companyId);
  return NextResponse.json({ ok: true, ...result });
}
