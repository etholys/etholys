import 'server-only';

import { prisma } from '@/lib/prisma';
import { commissionAmountCents, getSku } from '@/lib/billing/catalog';
import { issuePlatformInvoice } from '@/lib/billing/checkout';

const WON_PROPOSAL = new Set(['approved', 'awarded', 'won']);

export async function getCommissionRateBps(companyId: string, skuCode: string): Promise<number | null> {
  const sku = getSku(skuCode);
  if (!sku || sku.kind !== 'commission') return null;
  const ent = await prisma.companyEntitlement.findUnique({
    where: { companyId_skuCode: { companyId, skuCode } },
  });
  if (!ent || ent.status !== 'ACTIVE') return null;
  const meta = ent.metadata as { rateBps?: number } | null;
  if (typeof meta?.rateBps === 'number' && meta.rateBps > 0) return meta.rateBps;
  return sku.commissionBps;
}

export async function accrueCommission(opts: {
  companyId: string;
  skuCode: string;
  sourceType: string;
  sourceId: string;
  baseAmountCents: number;
  currency?: string;
}): Promise<{ created: boolean; amountCents: number; status: string } | { error: string }> {
  const rateBps = await getCommissionRateBps(opts.companyId, opts.skuCode);
  if (rateBps == null) {
    return { error: 'Regra de comissão não está activa para esta empresa.' };
  }
  const amountCents = commissionAmountCents(opts.baseAmountCents, rateBps);
  const existing = await prisma.billingCommissionEvent.findUnique({
    where: {
      companyId_skuCode_sourceType_sourceId: {
        companyId: opts.companyId,
        skuCode: opts.skuCode,
        sourceType: opts.sourceType,
        sourceId: opts.sourceId,
      },
    },
  });
  if (existing) {
    return { created: false, amountCents: existing.amountCents, status: existing.status };
  }
  const row = await prisma.billingCommissionEvent.create({
    data: {
      companyId: opts.companyId,
      skuCode: opts.skuCode,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId,
      baseAmountCents: opts.baseAmountCents,
      currency: opts.currency ?? 'USD',
      rateBps,
      amountCents,
      status: 'ACCRUED',
    },
  });
  return { created: true, amountCents: row.amountCents, status: row.status };
}

/** FUNDHUB: propostas aprovadas/ganhas com montante no fundo. */
export async function scanFundhubSuccessFees(companyId: string): Promise<{ scanned: number; created: number }> {
  const rate = await getCommissionRateBps(companyId, 'commission.fundhub.success_fee');
  if (rate == null) return { scanned: 0, created: 0 };

  const proposals = await prisma.proposal.findMany({
    where: { companyId, status: { in: [...WON_PROPOSAL] } },
    select: {
      id: true,
      title: true,
      fund: { select: { amount: true, currency: true } },
    },
  });

  let created = 0;
  for (const p of proposals) {
    const amount = p.fund?.amount;
    if (typeof amount !== 'number' || amount <= 0) continue;
    const result = await accrueCommission({
      companyId,
      skuCode: 'commission.fundhub.success_fee',
      sourceType: 'PROPOSAL',
      sourceId: p.id,
      baseAmountCents: Math.round(amount * 100),
      currency: p.fund?.currency || 'USD',
    });
    if (!('error' in result) && result.created) created += 1;
  }
  return { scanned: proposals.length, created };
}

export async function invoiceAccruedCommissions(companyId: string): Promise<{
  invoice: { id: string; number: string; totalCents: number } | null;
  events: number;
}> {
  const events = await prisma.billingCommissionEvent.findMany({
    where: { companyId, status: 'ACCRUED' },
    orderBy: { createdAt: 'asc' },
  });
  if (events.length === 0) return { invoice: null, events: 0 };

  const lines = events.map((e) => {
    const sku = getSku(e.skuCode);
    return {
      skuCode: e.skuCode,
      description: `${sku?.name.en ?? e.skuCode} · ${e.sourceType} ${e.sourceId.slice(0, 8)} (${e.rateBps / 100}%)`,
      unitPriceCents: e.amountCents,
    };
  });

  const invoice = await issuePlatformInvoice({
    companyId,
    kind: 'COMMISSION',
    lines,
    notes: `${events.length} comissões acumuladas`,
  });
  if (!invoice) return { invoice: null, events: 0 };

  await prisma.billingCommissionEvent.updateMany({
    where: { id: { in: events.map((e) => e.id) } },
    data: { status: 'INVOICED', invoiceId: invoice.id },
  });

  return { invoice, events: events.length };
}
