export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  companyAvailableTools,
  clampToolsToCompany,
  ensureWorkspaceAccessBootstrapForCompanyAdmin,
  isCompanyAdmin,
  normalizeSystemsInput,
  normalizeToolsInput,
  parseSystemsJson,
  parseToolsJson,
} from '@/lib/integrated-workspace';
import {
  assertSystemsAllowedForCompany,
  effectiveCompanyCatalog,
  getCompanyEntitlements,
} from '@/lib/billing/company-entitlements';

function grantPayload(row: {
  id: string;
  userId: string;
  systems: unknown;
  tools: unknown;
  enabled: boolean;
  email?: string | null;
  name?: string | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    name: row.name,
    systems: parseSystemsJson(row.systems),
    tools: parseToolsJson(row.tools),
    enabled: row.enabled,
  };
}

/** GET: acesso do utilizador actual +, se for admin, lista de grants na empresa. */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || '';
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  try {
    await ensureWorkspaceAccessBootstrapForCompanyAdmin(tenant.userId, companyId);
  } catch (e) {
    console.error('[workspace/access] bootstrap', e);
  }

  const admin = await isCompanyAdmin(tenant.userId, companyId);
  const entitlements = await getCompanyEntitlements(companyId);
  const companyLicensedSystems = effectiveCompanyCatalog(entitlements);
  const companyTools = companyAvailableTools({
    billingEnforced: entitlements.billingEnforced,
    addOnCodes: entitlements.addOnCodes,
  });

  const me = await prisma.integratedWorkspaceAccess.findUnique({
    where: { companyId_userId: { companyId, userId: tenant.userId } },
  });

  const mePayload = me
    ? {
        ...me,
        systems: parseSystemsJson(me.systems),
        tools: parseToolsJson(me.tools),
      }
    : null;

  if (!admin) {
    return NextResponse.json({
      canManage: false,
      companyLicensedSystems,
      companyTools,
      addOnCodes: entitlements.addOnCodes,
      billing: {
        enforced: entitlements.billingEnforced,
        status: entitlements.subscriptionStatus,
        planCode: entitlements.planCode,
        maxSeats: entitlements.maxSeats,
      },
      me: mePayload,
    });
  }

  const grants = await prisma.integratedWorkspaceAccess.findMany({
    where: { companyId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({
    canManage: true,
    companyLicensedSystems,
    companyTools,
    addOnCodes: entitlements.addOnCodes,
    billing: {
      enforced: entitlements.billingEnforced,
      status: entitlements.subscriptionStatus,
      planCode: entitlements.planCode,
      maxSeats: entitlements.maxSeats,
    },
    me: mePayload,
    grants: grants.map((g) =>
      grantPayload({
        id: g.id,
        userId: g.userId,
        systems: g.systems,
        tools: g.tools,
        enabled: g.enabled,
        email: g.user.email,
        name: g.user.name,
      }),
    ),
  });
}

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
  const targetUserId = String(body.userId || '').trim();
  if (!companyId || !targetUserId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador da empresa pode gerir acessos.' }, { status: 403 });
  }

  const targetInCompany = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId: targetUserId, companyId } },
  });
  if (!targetInCompany) {
    return NextResponse.json({ error: 'O utilizador não pertence a esta empresa.' }, { status: 400 });
  }

  const systemsRaw = normalizeSystemsInput(body.systems);
  const allowed = await assertSystemsAllowedForCompany(companyId, systemsRaw);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: 400 });
  }
  const systems = allowed.systems;

  const entitlements = await getCompanyEntitlements(companyId);
  const tools = clampToolsToCompany(normalizeToolsInput(body.tools), {
    billingEnforced: entitlements.billingEnforced,
    addOnCodes: entitlements.addOnCodes,
  });
  const enabled = body.enabled !== false;

  if (enabled && systems.length === 0 && tools.length === 0) {
    return NextResponse.json(
      { error: 'Selecione pelo menos um sistema ou uma Etholys Tool.' },
      { status: 400 },
    );
  }

  const record = await prisma.integratedWorkspaceAccess.upsert({
    where: { companyId_userId: { companyId, userId: targetUserId } },
    create: {
      companyId,
      userId: targetUserId,
      systems: systems as unknown as import('@prisma/client').Prisma.InputJsonValue,
      tools: tools as unknown as import('@prisma/client').Prisma.InputJsonValue,
      enabled,
      grantedByUserId: tenant.userId,
    },
    update: {
      systems: systems as unknown as import('@prisma/client').Prisma.InputJsonValue,
      tools: tools as unknown as import('@prisma/client').Prisma.InputJsonValue,
      enabled,
      grantedByUserId: tenant.userId,
    },
  });

  return NextResponse.json({
    ok: true,
    grant: {
      ...record,
      systems: parseSystemsJson(record.systems),
      tools: parseToolsJson(record.tools),
    },
  });
}

export async function DELETE(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || '';
  const targetUserId = req.nextUrl.searchParams.get('userId')?.trim() || '';
  if (!companyId || !targetUserId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador da empresa.' }, { status: 403 });
  }

  await prisma.integratedWorkspaceAccess.deleteMany({ where: { companyId, userId: targetUserId } });
  return NextResponse.json({ ok: true });
}
