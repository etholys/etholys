export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import {
  countCompanySeats,
  effectiveCompanyCatalog,
  getCompanyEntitlements,
} from '@/lib/billing/company-entitlements';
import { cancelEntitlement, contractSku, findActiveSubscription } from '@/lib/billing/checkout';
import { prisma } from '@/lib/prisma';
import type { BillingInterval } from '@/lib/billing/catalog';

async function requireCompanyAdmin(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };
  const companyId =
    req.nextUrl.searchParams.get('companyId')?.trim() ||
    '';
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return { error: NextResponse.json({ error: 'Empresa inválida' }, { status: 400 }) };
  }
  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return { error: NextResponse.json({ error: 'Apenas administrador da empresa.' }, { status: 403 }) };
  }
  return { tenant, companyId };
}

/** Estado de subscrição / licenças da empresa (admin). */
export async function GET(req: NextRequest) {
  const gate = await requireCompanyAdmin(req);
  if ('error' in gate) return gate.error;
  const { companyId } = gate;

  const ent = await getCompanyEntitlements(companyId);
  const catalog = effectiveCompanyCatalog(ent);
  const seatsUsed = await countCompanySeats(companyId);
  const sub = await findActiveSubscription(companyId);

  let entitlements: unknown[] = [];
  let invoices: unknown[] = [];
  let commissions: unknown[] = [];
  try {
    entitlements = await prisma.companyEntitlement.findMany({
      where: { companyId, status: { in: ['ACTIVE', 'CANCELLED'] } },
      orderBy: { updatedAt: 'desc' },
    });
    invoices = await prisma.platformInvoice.findMany({
      where: { companyId },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });
    commissions = await prisma.billingCommissionEvent.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  } catch (e) {
    console.error('[billing] snapshot extras', e);
  }

  return NextResponse.json({
    companyId,
    billingEnforced: ent.billingEnforced,
    subscriptionStatus: ent.subscriptionStatus,
    planCode: ent.planCode,
    maxSeats: ent.maxSeats,
    seatsUsed,
    interval: ent.interval,
    currentPeriodEnd: ent.currentPeriodEnd ?? sub?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: ent.cancelAtPeriodEnd,
    licensedSystems: ent.licensedSystems ?? catalog,
    catalog,
    addOnCodes: ent.addOnCodes,
    commissionCodes: ent.commissionCodes,
    licenseCodes: ent.licenseCodes,
    entitlements,
    invoices,
    commissions,
    paymentReady: true,
    stripeConnected: false,
  });
}

/** Contratar pacote / sistema / add-on / licença / regra de comissão. */
export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const skuCode = String(body.skuCode || '').trim();
  const action = String(body.action || 'contract').trim();
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }
  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador da empresa.' }, { status: 403 });
  }

  if (action === 'cancel') {
    if (!skuCode) return NextResponse.json({ error: 'skuCode obrigatório' }, { status: 400 });
    const result = await cancelEntitlement(companyId, skuCode);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (!skuCode) return NextResponse.json({ error: 'skuCode obrigatório' }, { status: 400 });
  const intervalRaw = String(body.interval || '').toUpperCase();
  const interval: BillingInterval | undefined =
    intervalRaw === 'YEAR' || intervalRaw === 'MONTH' ? intervalRaw : undefined;

  const result = await contractSku({
    companyId,
    skuCode,
    actorUserId: tenant.userId,
    interval,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result);
}
