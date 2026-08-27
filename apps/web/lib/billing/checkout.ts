import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  addDays,
  getSku,
  periodBounds,
  quoteSku,
  type BillingInterval,
  type BillingSku,
} from '@/lib/billing/catalog';
import { WORKSPACE_SYSTEM_KEYS, type WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

const ACTIVE_SUB = ['ACTIVE', 'TRIALING'] as const;

export async function ensureBillingAccount(companyId: string, billingEmail?: string | null) {
  return prisma.companyBillingAccount.upsert({
    where: { companyId },
    create: { companyId, billingEmail: billingEmail || null },
    update: billingEmail ? { billingEmail } : {},
  });
}

export async function ensureCatalogPlans(): Promise<void> {
  const { BILLING_CATALOG } = await import('@/lib/billing/catalog');
  const plans = BILLING_CATALOG.filter((s) => s.kind === 'plan' || (s.kind === 'license' && s.code === 'license.whitelabel'));
  for (const sku of plans) {
    await prisma.billingPlan.upsert({
      where: { code: sku.code },
      create: {
        code: sku.code,
        name: sku.name.en,
        kind: sku.kind,
        systems: sku.systems as unknown as Prisma.InputJsonValue,
        maxSeats: sku.maxSeats,
        priceCents: sku.priceCents ?? 0,
        currency: sku.currency,
        interval: sku.interval === 'YEAR' ? 'YEAR' : 'MONTH',
        isActive: true,
      },
      update: {
        name: sku.name.en,
        kind: sku.kind,
        systems: sku.systems as unknown as Prisma.InputJsonValue,
        maxSeats: sku.maxSeats,
        priceCents: sku.priceCents ?? 0,
        interval: sku.interval === 'YEAR' ? 'YEAR' : 'MONTH',
        isActive: true,
      },
    });
  }
}

export async function nextInvoiceNumber(companyId: string): Promise<string> {
  const year = new Date().getUTCFullYear();
  const count = await prisma.platformInvoice.count({ where: { companyId } });
  return `ETH-${year}-${String(count + 1).padStart(4, '0')}`;
}

export type InvoiceLineInput = {
  skuCode: string;
  description: string;
  quantity?: number;
  unitPriceCents: number;
};

export async function issuePlatformInvoice(opts: {
  companyId: string;
  kind: string;
  lines: InvoiceLineInput[];
  periodStart?: Date | null;
  periodEnd?: Date | null;
  notes?: string | null;
  currency?: string;
}): Promise<{ id: string; number: string; totalCents: number } | null> {
  const billable = opts.lines.filter((l) => l.unitPriceCents > 0);
  if (billable.length === 0) return null;

  const subtotal = billable.reduce((s, l) => s + l.unitPriceCents * (l.quantity ?? 1), 0);
  const number = await nextInvoiceNumber(opts.companyId);
  const now = new Date();
  const invoice = await prisma.platformInvoice.create({
    data: {
      companyId: opts.companyId,
      number,
      kind: opts.kind,
      status: 'ISSUED',
      currency: opts.currency ?? 'USD',
      subtotalCents: subtotal,
      taxCents: 0,
      totalCents: subtotal,
      periodStart: opts.periodStart ?? null,
      periodEnd: opts.periodEnd ?? null,
      dueDate: addDays(now, 15),
      notes: opts.notes ?? null,
      lines: {
        create: billable.map((l) => ({
          skuCode: l.skuCode,
          description: l.description,
          quantity: l.quantity ?? 1,
          unitPriceCents: l.unitPriceCents,
          amountCents: l.unitPriceCents * (l.quantity ?? 1),
        })),
      },
    },
  });
  return { id: invoice.id, number: invoice.number, totalCents: invoice.totalCents };
}

export async function findActiveSubscription(companyId: string) {
  return prisma.companySubscription.findFirst({
    where: { companyId, status: { in: [...ACTIVE_SUB] } },
    orderBy: { updatedAt: 'desc' },
    include: { plan: true },
  });
}

function unionSystems(a: WorkspaceSystemKey[], b: WorkspaceSystemKey[]): WorkspaceSystemKey[] {
  return [...WORKSPACE_SYSTEM_KEYS].filter((k) => a.includes(k) || b.includes(k));
}

async function grantSystemsToAdmins(companyId: string, systems: WorkspaceSystemKey[], actorUserId: string) {
  const admins = await prisma.companyUser.findMany({
    where: { companyId, role: 'ADMIN' },
    select: { userId: true },
  });
  for (const admin of admins) {
    const existing = await prisma.integratedWorkspaceAccess.findUnique({
      where: { companyId_userId: { companyId, userId: admin.userId } },
    });
    const current = Array.isArray(existing?.systems)
      ? (existing!.systems as string[]).filter((s): s is WorkspaceSystemKey =>
          (WORKSPACE_SYSTEM_KEYS as readonly string[]).includes(s),
        )
      : [];
    const next = unionSystems(current, systems);
    await prisma.integratedWorkspaceAccess.upsert({
      where: { companyId_userId: { companyId, userId: admin.userId } },
      create: {
        companyId,
        userId: admin.userId,
        systems: next as unknown as Prisma.InputJsonValue,
        enabled: true,
        grantedByUserId: actorUserId,
      },
      update: {
        systems: next as unknown as Prisma.InputJsonValue,
        enabled: true,
        grantedByUserId: actorUserId,
      },
    });
  }
}

async function upsertSubscription(opts: {
  companyId: string;
  systems: WorkspaceSystemKey[];
  interval: BillingInterval;
  maxSeats: number | null;
  planCode?: string | null;
  period: { start: Date; end: Date };
}) {
  const plan = opts.planCode
    ? await prisma.billingPlan.findUnique({ where: { code: opts.planCode } })
    : null;
  const existing = await findActiveSubscription(opts.companyId);
  const interval = opts.interval === 'YEAR' ? 'YEAR' : 'MONTH';
  if (existing) {
    const merged = unionSystems(
      Array.isArray(existing.licensedSystems)
        ? (existing.licensedSystems as string[]).filter((s): s is WorkspaceSystemKey =>
            (WORKSPACE_SYSTEM_KEYS as readonly string[]).includes(s),
          )
        : [],
      opts.systems,
    );
    return prisma.companySubscription.update({
      where: { id: existing.id },
      data: {
        status: 'ACTIVE',
        licensedSystems: merged as unknown as Prisma.InputJsonValue,
        interval,
        maxSeats: opts.maxSeats ?? existing.maxSeats,
        planId: plan?.id ?? existing.planId,
        currentPeriodStart: existing.currentPeriodStart ?? opts.period.start,
        currentPeriodEnd: existing.currentPeriodEnd ?? opts.period.end,
        cancelAtPeriodEnd: false,
      },
    });
  }

  const incomplete = await prisma.companySubscription.findFirst({
    where: { companyId: opts.companyId },
    orderBy: { updatedAt: 'desc' },
  });
  if (incomplete) {
    return prisma.companySubscription.update({
      where: { id: incomplete.id },
      data: {
        status: 'ACTIVE',
        licensedSystems: opts.systems as unknown as Prisma.InputJsonValue,
        interval,
        maxSeats: opts.maxSeats,
        planId: plan?.id ?? null,
        currentPeriodStart: opts.period.start,
        currentPeriodEnd: opts.period.end,
        cancelAtPeriodEnd: false,
      },
    });
  }

  return prisma.companySubscription.create({
    data: {
      companyId: opts.companyId,
      status: 'ACTIVE',
      licensedSystems: opts.systems as unknown as Prisma.InputJsonValue,
      interval,
      maxSeats: opts.maxSeats,
      planId: plan?.id ?? null,
      currentPeriodStart: opts.period.start,
      currentPeriodEnd: opts.period.end,
      cancelAtPeriodEnd: false,
    },
  });
}

export type ContractResult =
  | {
      ok: true;
      skuCode: string;
      invoice: { id: string; number: string; totalCents: number } | null;
      licensedSystems: WorkspaceSystemKey[];
    }
  | { ok: false; error: string };

function invoiceKind(sku: BillingSku): string {
  if (sku.kind === 'license') return 'LICENSE';
  if (sku.kind === 'addon') return 'ADDON';
  if (sku.kind === 'commission') return 'COMMISSION';
  return 'SUBSCRIPTION';
}

export async function contractSku(opts: {
  companyId: string;
  skuCode: string;
  actorUserId: string;
  interval?: BillingInterval;
}): Promise<ContractResult> {
  const sku = getSku(opts.skuCode);
  if (!sku) return { ok: false, error: 'SKU desconhecido.' };
  if (!sku.selfServe) {
    return { ok: false, error: 'Este produto requer contrato com a Etholys (não é self-serve).' };
  }

  await ensureCatalogPlans();
  await ensureBillingAccount(opts.companyId);

  const sub = await findActiveSubscription(opts.companyId);
  const currentSystems: WorkspaceSystemKey[] = sub
    ? Array.isArray(sub.licensedSystems)
      ? (sub.licensedSystems as string[]).filter((s): s is WorkspaceSystemKey =>
          (WORKSPACE_SYSTEM_KEYS as readonly string[]).includes(s),
        )
      : []
    : [];

  if (sku.requiresSystems.length > 0) {
    const missing = sku.requiresSystems.filter((s) => !currentSystems.includes(s));
    if (missing.length > 0) {
      return {
        ok: false,
        error: `Contrate primeiro: ${missing.join(', ')}.`,
      };
    }
  }

  const interval: BillingInterval =
    opts.interval ?? (sku.interval === 'YEAR' ? 'YEAR' : sku.interval === 'EVENT' ? 'EVENT' : 'MONTH');
  const quoted = quoteSku(sku, interval, { licensedSystems: currentSystems });
  if ('error' in quoted) return { ok: false, error: quoted.error };

  const now = new Date();
  const period = periodBounds(now, quoted.interval);

  if (sku.kind === 'commission') {
    await prisma.companyEntitlement.upsert({
      where: { companyId_skuCode: { companyId: opts.companyId, skuCode: sku.code } },
      create: {
        companyId: opts.companyId,
        skuCode: sku.code,
        kind: 'commission',
        status: 'ACTIVE',
        autoRenew: true,
        unitPriceCents: 0,
        currency: 'USD',
        metadata: { rateBps: sku.commissionBps },
      },
      update: {
        status: 'ACTIVE',
        metadata: { rateBps: sku.commissionBps },
      },
    });
    return { ok: true, skuCode: sku.code, invoice: null, licensedSystems: currentSystems };
  }

  if (sku.kind === 'addon' || sku.kind === 'license') {
    const systemsToGrant = quoted.systems.length ? quoted.systems : currentSystems;
    if (sku.kind === 'license') {
      await upsertSubscription({
        companyId: opts.companyId,
        systems: systemsToGrant,
        interval: 'YEAR',
        maxSeats: sku.maxSeats ?? sub?.maxSeats ?? null,
        planCode: sku.code === 'license.whitelabel' ? sku.code : sub?.plan?.code ?? null,
        period,
      });
    }
    await prisma.companyEntitlement.upsert({
      where: { companyId_skuCode: { companyId: opts.companyId, skuCode: sku.code } },
      create: {
        companyId: opts.companyId,
        skuCode: sku.code,
        kind: sku.kind,
        status: 'ACTIVE',
        autoRenew: sku.interval !== 'ONCE',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        unitPriceCents: quoted.priceCents,
        currency: quoted.currency,
        metadata: sku.kind === 'license' ? { systems: systemsToGrant } : undefined,
      },
      update: {
        status: 'ACTIVE',
        autoRenew: true,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        unitPriceCents: quoted.priceCents,
      },
    });
    if (systemsToGrant.length) {
      await grantSystemsToAdmins(opts.companyId, systemsToGrant, opts.actorUserId);
    }
    const invoice = await issuePlatformInvoice({
      companyId: opts.companyId,
      kind: invoiceKind(sku),
      lines: [
        {
          skuCode: sku.code,
          description: `${sku.name.en} (${quoted.interval})`,
          unitPriceCents: quoted.priceCents,
        },
      ],
      periodStart: period.start,
      periodEnd: period.end,
    });
    return { ok: true, skuCode: sku.code, invoice, licensedSystems: systemsToGrant };
  }

  // plan | system
  const nextSystems = unionSystems(currentSystems, quoted.systems.length ? quoted.systems : sku.systems);
  const subRow = await upsertSubscription({
    companyId: opts.companyId,
    systems: nextSystems,
    interval: quoted.interval,
    maxSeats: sku.maxSeats,
    planCode: sku.kind === 'plan' ? sku.code : sub?.plan?.code ?? null,
    period: sub?.currentPeriodEnd && sub.currentPeriodEnd > now ? { start: sub.currentPeriodStart ?? now, end: sub.currentPeriodEnd } : period,
  });
  await prisma.companyEntitlement.upsert({
    where: { companyId_skuCode: { companyId: opts.companyId, skuCode: sku.code } },
    create: {
      companyId: opts.companyId,
      skuCode: sku.code,
      kind: sku.kind,
      status: 'ACTIVE',
      autoRenew: true,
      currentPeriodStart: subRow.currentPeriodStart,
      currentPeriodEnd: subRow.currentPeriodEnd,
      unitPriceCents: quoted.priceCents,
      currency: quoted.currency,
    },
    update: {
      status: 'ACTIVE',
      autoRenew: true,
      unitPriceCents: quoted.priceCents,
    },
  });
  await grantSystemsToAdmins(opts.companyId, nextSystems, opts.actorUserId);
  const invoice = await issuePlatformInvoice({
    companyId: opts.companyId,
    kind: invoiceKind(sku),
    lines: [
      {
        skuCode: sku.code,
        description: `${sku.name.en} (${quoted.interval})`,
        unitPriceCents: quoted.priceCents,
      },
    ],
    periodStart: subRow.currentPeriodStart,
    periodEnd: subRow.currentPeriodEnd,
  });
  return { ok: true, skuCode: sku.code, invoice, licensedSystems: nextSystems };
}

export async function cancelEntitlement(companyId: string, skuCode: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const sku = getSku(skuCode);
  const row = await prisma.companyEntitlement.findUnique({
    where: { companyId_skuCode: { companyId, skuCode } },
  });
  if (!row) return { ok: false, error: 'Não há este produto contratado.' };
  await prisma.companyEntitlement.update({
    where: { id: row.id },
    data: { status: 'CANCELLED', autoRenew: false },
  });
  if (sku?.kind === 'plan' || sku?.kind === 'system') {
    const sub = await findActiveSubscription(companyId);
    if (sub) {
      await prisma.companySubscription.update({
        where: { id: sub.id },
        data: { cancelAtPeriodEnd: true },
      });
    }
  }
  return { ok: true };
}
