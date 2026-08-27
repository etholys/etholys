import 'server-only';

import { prisma } from '@/lib/prisma';
import { getSku, periodBounds, type BillingInterval } from '@/lib/billing/catalog';
import { findActiveSubscription, issuePlatformInvoice } from '@/lib/billing/checkout';

function asInterval(raw: string | null | undefined): BillingInterval {
  return raw === 'YEAR' ? 'YEAR' : 'MONTH';
}

export async function renewDueSubscriptions(now = new Date()): Promise<{
  subscriptions: number;
  entitlements: number;
  invoices: number;
}> {
  let subscriptions = 0;
  let entitlements = 0;
  let invoices = 0;

  const dueSubs = await prisma.companySubscription.findMany({
    where: {
      status: { in: ['ACTIVE', 'TRIALING'] },
      cancelAtPeriodEnd: false,
      currentPeriodEnd: { lte: now },
    },
  });

  for (const sub of dueSubs) {
    const interval = asInterval(sub.interval);
    const next = periodBounds(sub.currentPeriodEnd ?? now, interval);
    await prisma.companySubscription.update({
      where: { id: sub.id },
      data: {
        currentPeriodStart: next.start,
        currentPeriodEnd: next.end,
        status: 'ACTIVE',
      },
    });
    subscriptions += 1;

    const ents = await prisma.companyEntitlement.findMany({
      where: { companyId: sub.companyId, status: 'ACTIVE', autoRenew: true, kind: { in: ['plan', 'system'] } },
    });
    const lines = ents
      .filter((e) => (e.unitPriceCents ?? 0) > 0)
      .map((e) => {
        const sku = getSku(e.skuCode);
        return {
          skuCode: e.skuCode,
          description: `${sku?.name.en ?? e.skuCode} · renovação ${interval}`,
          unitPriceCents: e.unitPriceCents ?? 0,
        };
      });
    const invoice = await issuePlatformInvoice({
      companyId: sub.companyId,
      kind: 'SUBSCRIPTION',
      lines,
      periodStart: next.start,
      periodEnd: next.end,
      notes: 'Renovação automática',
    });
    if (invoice) invoices += 1;
  }

  const dueAddons = await prisma.companyEntitlement.findMany({
    where: {
      status: 'ACTIVE',
      autoRenew: true,
      kind: { in: ['addon', 'license'] },
      currentPeriodEnd: { lte: now },
    },
  });

  for (const ent of dueAddons) {
    const sku = getSku(ent.skuCode);
    const interval = asInterval(sku?.interval === 'YEAR' ? 'YEAR' : ent.kind === 'license' ? 'YEAR' : 'MONTH');
    const next = periodBounds(ent.currentPeriodEnd ?? now, interval);
    await prisma.companyEntitlement.update({
      where: { id: ent.id },
      data: {
        currentPeriodStart: next.start,
        currentPeriodEnd: next.end,
      },
    });
    entitlements += 1;
    const invoice = await issuePlatformInvoice({
      companyId: ent.companyId,
      kind: ent.kind === 'license' ? 'LICENSE' : 'ADDON',
      lines: [
        {
          skuCode: ent.skuCode,
          description: `${sku?.name.en ?? ent.skuCode} · renovação ${interval}`,
          unitPriceCents: ent.unitPriceCents ?? 0,
        },
      ],
      periodStart: next.start,
      periodEnd: next.end,
      notes: 'Renovação automática',
    });
    if (invoice) invoices += 1;
  }

  return { subscriptions, entitlements, invoices };
}

export async function markInvoicePaid(invoiceId: string, companyId: string) {
  const inv = await prisma.platformInvoice.findFirst({ where: { id: invoiceId, companyId } });
  if (!inv) return { ok: false as const, error: 'Fatura não encontrada.' };
  if (inv.status === 'VOID') return { ok: false as const, error: 'Fatura anulada.' };
  await prisma.platformInvoice.update({
    where: { id: inv.id },
    data: { status: 'PAID', paidAt: new Date() },
  });
  await prisma.billingCommissionEvent.updateMany({
    where: { invoiceId: inv.id, status: 'INVOICED' },
    data: { status: 'PAID' },
  });
  return { ok: true as const };
}

export { findActiveSubscription };
