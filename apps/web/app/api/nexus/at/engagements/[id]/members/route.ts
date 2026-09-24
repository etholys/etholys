export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadEngagementForTenant, userIsOperator } from '@/lib/nexus-at';

import { emptyContextSetup } from '@/lib/company-context-setup';
import { normalizeSectorIdList } from '@/lib/nexus-economic-sectors';
import { isAttendedMemberRole } from '@/lib/nexus-at-shared';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Engagement não encontrado.' }, { status: 404 });
  if (!userIsOperator(engagement, tenant.companyIds)) {
    return NextResponse.json({ error: 'Só o operador pode adicionar empresas.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  let companyId = String(body.companyId || '').trim();
  const sectorIds = normalizeSectorIdList({
    sectorIds: body.sectorIds,
    sectorId: body.sectorId,
  });
  if (sectorIds.length === 0) {
    return NextResponse.json(
      {
        error:
          'Temática / setor do empreendimento é obrigatória ao adicionar a empresa (podes marcar várias, ex. horta + aves).',
      },
      { status: 400 }
    );
  }

  const sectorContext = {
    ...emptyContextSetup(),
    sectorIds,
    sectorId: sectorIds[0],
  };

  // Criar ficha de cliente no momento (empresa diferente, mesmo serviço/contrato).
  if (!companyId && body.name) {
    const name = String(body.name).trim().slice(0, 200);
    if (name.length < 2) {
      return NextResponse.json({ error: 'Nome da empresa inválido.' }, { status: 400 });
    }
    const shortRaw = String(body.shortName || '').trim().slice(0, 40);
    const shortName =
      shortRaw ||
      name
        .split(/\s+/)
        .slice(0, 3)
        .map((w) => w[0]?.toUpperCase() || '')
        .join('')
        .slice(0, 12) ||
      name.slice(0, 12);
    const created = await prisma.company.create({
      data: {
        name,
        shortName,
        color: '#6366F1',
        contextSetupJson: sectorContext,
      },
      select: { id: true },
    });
    companyId = created.id;
  }

  if (!companyId) {
    return NextResponse.json({ error: 'Empresa obrigatória.' }, { status: 400 });
  }

  const company = await prisma.company.findFirst({
    where: { id: companyId, isActive: true },
    select: { id: true, contextSetupJson: true },
  });
  if (!company) {
    return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
  }

  if (engagement.members.some((m) => m.companyId === companyId)) {
    return NextResponse.json({ error: 'Empresa já está no serviço.' }, { status: 409 });
  }

  const prev =
    company.contextSetupJson && typeof company.contextSetupJson === 'object'
      ? (company.contextSetupJson as Record<string, unknown>)
      : {};
  await prisma.company.update({
    where: { id: companyId },
    data: {
      contextSetupJson: {
        ...emptyContextSetup(),
        ...prev,
        v: 1,
        sectorIds,
        sectorId: sectorIds[0],
      },
    },
  });

  const roleRaw = String(body.memberRole || 'client').trim().toLowerCase();
  let memberRole = 'client';
  if (companyId === engagement.operatorCompanyId) memberRole = 'operator';
  else if (roleRaw === 'principal' || roleRaw === 'affiliate' || roleRaw === 'client') memberRole = roleRaw;
  else if (isAttendedMemberRole(roleRaw)) memberRole = roleRaw;

  const maxSort = engagement.members.reduce((acc, m) => Math.max(acc, m.sortOrder), 0);
  const member = await prisma.nexusAtEngagementMember.create({
    data: {
      engagementId: engagement.id,
      companyId,
      memberRole,
      notes: body.notes ? String(body.notes).trim().slice(0, 500) : null,
      sortOrder: maxSort + 1,
    },
    include: { company: { select: { id: true, name: true, shortName: true } } },
  });

  await prisma.nexusAtEngagement.update({
    where: { id: engagement.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json(
    { ok: true, member, sectorId: sectorIds[0], sectorIds },
    { status: 201 }
  );
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Engagement não encontrado.' }, { status: 404 });
  if (!userIsOperator(engagement, tenant.companyIds)) {
    return NextResponse.json({ error: 'Só o operador pode remover empresas.' }, { status: 403 });
  }

  const companyId = String(req.nextUrl.searchParams.get('companyId') || '').trim();
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  if (companyId === engagement.operatorCompanyId) {
    return NextResponse.json({ error: 'Não pode remover a empresa operadora.' }, { status: 400 });
  }

  await prisma.nexusAtEngagementMember.deleteMany({
    where: { engagementId: engagement.id, companyId },
  });

  return NextResponse.json({ ok: true });
}
