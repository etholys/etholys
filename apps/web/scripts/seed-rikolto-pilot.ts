/**
 * Prepara empresa Rikolto para piloto institucional.
 *
 * Uso (apps/web):
 *   npx tsx --require dotenv/config scripts/seed-rikolto-pilot.ts
 *   npx tsx --require dotenv/config scripts/seed-rikolto-pilot.ts --admin-email tiago@...
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import {
  BILLING_CATALOG,
  addDays,
  periodBounds,
} from '../lib/billing/catalog';
import { WORKSPACE_SYSTEM_KEYS, type WorkspaceSystemKey } from '../lib/integrated-workspace-shared';

export const RIKOLTO_SHORT = 'RIKOLTO';
export const RIKOLTO_NAME = 'Rikolto';
/** Pacote institucional: ATLAS + FUNDHUB + FORGE — adequado a ONG internacional. */
export const RIKOLTO_PLAN = 'plan.institucional';
/** Sistemas do piloto (podem ser alargados depois). */
export const RIKOLTO_PILOT_SYSTEMS: WorkspaceSystemKey[] = [
  'ATLAS',
  'SIEP',
  'FUNDHUB',
  'FORGE',
  'NEXUS',
];

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
        systems: sku.systems as unknown as Prisma.InputJsonValue,
        maxSeats: sku.maxSeats,
        priceCents: sku.priceCents ?? 0,
        isActive: true,
      },
    });
  }
}

function inviteCode(): string {
  return randomBytes(4).toString('hex').toUpperCase();
}

async function main() {
  const args = process.argv.slice(2);
  const emailIdx = args.indexOf('--admin-email');
  const adminEmail = (emailIdx >= 0 ? args[emailIdx + 1] : process.env.RIKOLTO_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase();
  const daysIdx = args.indexOf('--days');
  const trialDays = daysIdx >= 0 ? Number(args[daysIdx + 1]) : 90;

  const prisma = new PrismaClient();
  try {
    console.log('=== Sync billing catalog ===');
    await syncCatalogPlans(prisma);

    console.log('=== Upsert company Rikolto ===');
    let company = await prisma.company.findFirst({ where: { shortName: RIKOLTO_SHORT } });
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: RIKOLTO_NAME,
          shortName: RIKOLTO_SHORT,
          description:
            'Piloto institucional Etholys — agricultura sostenible, proyectos y captación de fondos.',
          color: '#0D9488',
          currency: 'USD',
          isActive: true,
        },
      });
      console.log('Created', company.id);
    } else {
      company = await prisma.company.update({
        where: { id: company.id },
        data: { name: RIKOLTO_NAME, isActive: true },
      });
      console.log('Updated', company.id);
    }

    await prisma.companyBillingAccount.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, billingEmail: adminEmail || null },
      update: adminEmail ? { billingEmail: adminEmail } : {},
    });

    const plan = await prisma.billingPlan.findUnique({ where: { code: RIKOLTO_PLAN } });
    if (!plan) throw new Error(`Plan ${RIKOLTO_PLAN} missing`);

    const systems = RIKOLTO_PILOT_SYSTEMS;
    const now = new Date();
    const trialEndsAt = addDays(now, trialDays);
    const period = periodBounds(now, 'MONTH');

    const existingSub = await prisma.companySubscription.findFirst({
      where: { companyId: company.id, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { updatedAt: 'desc' },
    });

    const sub = existingSub
      ? await prisma.companySubscription.update({
          where: { id: existingSub.id },
          data: {
            status: 'TRIALING',
            planId: plan.id,
            licensedSystems: systems as unknown as Prisma.InputJsonValue,
            maxSeats: Math.max(plan.maxSeats ?? 30, 50),
            interval: 'MONTH',
            currentPeriodStart: now,
            currentPeriodEnd: period.end,
            trialEndsAt,
            cancelAtPeriodEnd: false,
          },
        })
      : await prisma.companySubscription.create({
          data: {
            companyId: company.id,
            planId: plan.id,
            status: 'TRIALING',
            licensedSystems: systems as unknown as Prisma.InputJsonValue,
            maxSeats: Math.max(plan.maxSeats ?? 30, 50),
            interval: 'MONTH',
            currentPeriodStart: now,
            currentPeriodEnd: period.end,
            trialEndsAt,
            cancelAtPeriodEnd: false,
          },
        });

    await prisma.companyEntitlement.upsert({
      where: { companyId_skuCode: { companyId: company.id, skuCode: RIKOLTO_PLAN } },
      create: {
        companyId: company.id,
        skuCode: RIKOLTO_PLAN,
        kind: 'plan',
        status: 'ACTIVE',
        autoRenew: false,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        unitPriceCents: 0,
        currency: 'USD',
        metadata: { trial: true, pilot: 'rikolto' },
      },
      update: {
        status: 'ACTIVE',
        currentPeriodEnd: trialEndsAt,
        metadata: { trial: true, pilot: 'rikolto' },
      },
    });

    console.log('Subscription', sub.id, 'TRIALING until', trialEndsAt.toISOString().slice(0, 10));
    console.log('Systems:', systems.join(', '));

    let inviteOut: { code: string; email: string } | null = null;
    if (adminEmail) {
      let user = await prisma.user.findUnique({ where: { email: adminEmail } });
      if (user) {
        await prisma.companyUser.upsert({
          where: { userId_companyId: { userId: user.id, companyId: company.id } },
          create: {
            userId: user.id,
            companyId: company.id,
            role: 'ADMIN',
            inviteKind: 'employee',
            jobTitle: 'Administrador piloto',
          },
          update: { role: 'ADMIN' },
        });
        await prisma.integratedWorkspaceAccess.upsert({
          where: { companyId_userId: { companyId: company.id, userId: user.id } },
          create: {
            companyId: company.id,
            userId: user.id,
            systems: systems as unknown as Prisma.InputJsonValue,
            enabled: true,
            grantedByUserId: user.id,
          },
          update: {
            systems: systems as unknown as Prisma.InputJsonValue,
            enabled: true,
          },
        });
        console.log('Linked existing user as ADMIN:', adminEmail);
      } else {
        const pending = await prisma.invitation.findFirst({
          where: { companyId: company.id, email: adminEmail, status: 'pending' },
        });
        if (pending) {
          inviteOut = { code: pending.code, email: adminEmail };
          console.log('Pending invite already exists:', pending.code);
        } else {
          const inviter =
            (await prisma.user.findFirst({
              where: { email: { in: ['etholys@gmail.com'] } },
              select: { id: true },
            })) ||
            (await prisma.user.findFirst({ select: { id: true } }));
          if (!inviter) throw new Error('No inviter user in DB');
          const code = inviteCode();
          await prisma.invitation.create({
            data: {
              companyId: company.id,
              email: adminEmail,
              role: 'ADMIN',
              invitedBy: inviter.id,
              expiresAt: addDays(now, 14),
              inviteKind: 'employee',
              jobTitle: 'Administrador piloto Rikolto',
              systems: systems as unknown as Prisma.InputJsonValue,
              code,
              status: 'pending',
              accessMode: 'company',
            },
          });
          inviteOut = { code, email: adminEmail };
          console.log('Created ADMIN invite:', code, '→', adminEmail);
        }
      }
    } else {
      console.log('No --admin-email: company ready; invite admins from /hub/admin');
    }

    console.log('\n=== Rikolto pilot ready ===');
    console.log('Company:', company.name, `(${company.id})`);
    console.log('Login:', process.env.NEXTAUTH_URL || 'https://app.etholys.com');
    if (inviteOut) {
      console.log('Invite code:', inviteOut.code);
      console.log(
        'Activate URL:',
        `${(process.env.NEXTAUTH_URL || 'https://app.etholys.com').replace(/\/$/, '')}/login?invite=${inviteOut.code}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
