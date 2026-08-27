/**
 * Sincroniza catálogo de planos na BD e activa trial na sandbox.
 *
 * Uso (apps/web):
 *   npx tsx --require dotenv/config scripts/seed-billing.ts
 *   npx tsx --require dotenv/config scripts/seed-billing.ts --catalog-only
 *   npx tsx --require dotenv/config scripts/seed-billing.ts --trial --short-name SANDBOX --plan plan.gubernamental
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  BILLING_CATALOG,
  addDays,
  listSkusByKind,
  periodBounds,
} from '../lib/billing/catalog';
import { WORKSPACE_SYSTEM_KEYS, type WorkspaceSystemKey } from '../lib/integrated-workspace-shared';
import { SANDBOX_SHORT_NAME } from '../lib/sandbox/seed-internal-sandbox';

async function syncCatalogPlans(prisma: PrismaClient) {
  const plans = BILLING_CATALOG.filter(
    (s) => s.kind === 'plan' || (s.kind === 'license' && s.code === 'license.whitelabel'),
  );
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

async function startTrial(
  prisma: PrismaClient,
  opts: { companyId: string; planCode: string; trialDays: number },
) {
  const planRow = await prisma.billingPlan.findUnique({ where: { code: opts.planCode } });
  if (!planRow) throw new Error(`Plano ${opts.planCode} não encontrado — corra sync primeiro.`);

  const systems = Array.isArray(planRow.systems)
    ? (planRow.systems as string[]).filter((s): s is WorkspaceSystemKey =>
        (WORKSPACE_SYSTEM_KEYS as readonly string[]).includes(s),
      )
    : [];

  await prisma.companyBillingAccount.upsert({
    where: { companyId: opts.companyId },
    create: { companyId: opts.companyId },
    update: {},
  });

  const now = new Date();
  const trialEndsAt = addDays(now, opts.trialDays);
  const period = periodBounds(now, 'MONTH');

  const existing = await prisma.companySubscription.findFirst({
    where: { companyId: opts.companyId, status: { in: ['ACTIVE', 'TRIALING'] } },
    orderBy: { updatedAt: 'desc' },
  });

  const sub = existing
    ? await prisma.companySubscription.update({
        where: { id: existing.id },
        data: {
          status: 'TRIALING',
          planId: planRow.id,
          licensedSystems: systems as unknown as Prisma.InputJsonValue,
          maxSeats: planRow.maxSeats,
          interval: 'MONTH',
          currentPeriodStart: now,
          currentPeriodEnd: period.end,
          trialEndsAt,
          cancelAtPeriodEnd: false,
        },
      })
    : await prisma.companySubscription.create({
        data: {
          companyId: opts.companyId,
          planId: planRow.id,
          status: 'TRIALING',
          licensedSystems: systems as unknown as Prisma.InputJsonValue,
          maxSeats: planRow.maxSeats,
          interval: 'MONTH',
          currentPeriodStart: now,
          currentPeriodEnd: period.end,
          trialEndsAt,
          cancelAtPeriodEnd: false,
        },
      });

  await prisma.companyEntitlement.upsert({
    where: { companyId_skuCode: { companyId: opts.companyId, skuCode: opts.planCode } },
    create: {
      companyId: opts.companyId,
      skuCode: opts.planCode,
      kind: 'plan',
      status: 'ACTIVE',
      autoRenew: false,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      unitPriceCents: 0,
      currency: 'USD',
      metadata: { trial: true },
    },
    update: {
      status: 'ACTIVE',
      autoRenew: false,
      currentPeriodStart: now,
      currentPeriodEnd: trialEndsAt,
      metadata: { trial: true },
    },
  });

  const admins = await prisma.companyUser.findMany({
    where: { companyId: opts.companyId, role: 'ADMIN' },
    select: { userId: true },
  });
  for (const admin of admins) {
    await prisma.integratedWorkspaceAccess.upsert({
      where: { companyId_userId: { companyId: opts.companyId, userId: admin.userId } },
      create: {
        companyId: opts.companyId,
        userId: admin.userId,
        systems: systems as unknown as Prisma.InputJsonValue,
        enabled: true,
        grantedByUserId: admin.userId,
      },
      update: {
        systems: systems as unknown as Prisma.InputJsonValue,
        enabled: true,
      },
    });
  }

  return { sub, systems, trialEndsAt };
}

async function main() {
  const args = process.argv.slice(2);
  const catalogOnly = args.includes('--catalog-only');
  const doTrial = args.includes('--trial') || !catalogOnly;
  const shortIdx = args.indexOf('--short-name');
  const shortName = shortIdx >= 0 ? args[shortIdx + 1] : SANDBOX_SHORT_NAME;
  const planIdx = args.indexOf('--plan');
  const planCode = planIdx >= 0 ? args[planIdx + 1] : 'plan.gubernamental';
  const daysIdx = args.indexOf('--days');
  const trialDays = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 90;

  const prisma = new PrismaClient();
  try {
    console.log('=== Sincronizar BillingPlan (catálogo) ===');
    await syncCatalogPlans(prisma);
    const plans = await prisma.billingPlan.findMany({ orderBy: { code: 'asc' } });
    console.log(`Planos na BD: ${plans.length}`);
    for (const p of plans) {
      console.log(`  • ${p.code} — ${p.name} (${p.maxSeats ?? '∞'} lugares)`);
    }

    console.log('\n=== Catálogo em código ===');
    console.log(`  Pacotes: ${listSkusByKind('plan').length}`);
    console.log(`  Sistemas: ${listSkusByKind('system').length}`);
    console.log(`  Add-ons: ${listSkusByKind('addon').length}`);
    console.log(`  Total SKUs: ${BILLING_CATALOG.length}`);

    if (!doTrial) {
      console.log('\n(catalog-only — trial ignorado)');
      return;
    }

    console.log(`\n=== Trial ${planCode} → empresa ${shortName} (${trialDays} dias) ===`);
    const company = await prisma.company.findFirst({ where: { shortName } });
    if (!company) {
      console.error(`Empresa shortName=${shortName} não encontrada. Corra seed:sandbox primeiro.`);
      process.exit(1);
    }

    const { sub, systems, trialEndsAt } = await startTrial(prisma, {
      companyId: company.id,
      planCode,
      trialDays,
    });

    console.log('Subscrição:', sub.id);
    console.log('Sistemas:', systems.join(', '));
    console.log('Trial até:', trialEndsAt.toISOString().slice(0, 10));
    console.log('\nOK — billing enforced activo para', company.name);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
