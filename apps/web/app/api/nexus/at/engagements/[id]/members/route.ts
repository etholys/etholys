export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadEngagementForTenant, userIsOperator } from '@/lib/nexus-at';

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

  const companyId = String(body.companyId || '').trim();
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json(
      { error: 'Empresa inválida ou sem permissão (MVP: tem de pertencer ao utilizador).' },
      { status: 403 }
    );
  }

  if (engagement.members.some((m) => m.companyId === companyId)) {
    return NextResponse.json({ error: 'Empresa já está no engagement.' }, { status: 409 });
  }

  const memberRole =
    companyId === engagement.operatorCompanyId ? 'operator' : String(body.memberRole || 'client').trim() || 'client';

  const maxSort = engagement.members.reduce((acc, m) => Math.max(acc, m.sortOrder), 0);
  const member = await prisma.nexusAtEngagementMember.create({
    data: {
      engagementId: engagement.id,
      companyId,
      memberRole: memberRole === 'operator' ? 'operator' : 'client',
      notes: body.notes ? String(body.notes).trim().slice(0, 500) : null,
      sortOrder: maxSort + 1,
    },
    include: { company: { select: { id: true, name: true, shortName: true } } },
  });

  await prisma.nexusAtEngagement.update({
    where: { id: engagement.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, member }, { status: 201 });
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
