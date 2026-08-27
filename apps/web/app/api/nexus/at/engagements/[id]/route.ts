export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  clientCompanyIds,
  engagementCompanyIds,
  enrichAtCase,
  isAtEngagementStatus,
  listAtCasesForEngagement,
  loadEngagementForTenant,
  userIsOperator,
  validateEngagementSiep,
} from '@/lib/nexus-at';
import { normalizeEconomicSectorId, parseCompanySectorId } from '@/lib/nexus-economic-sectors';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });

  const clients = clientCompanyIds(engagement);
  const projectId = _req.nextUrl.searchParams.get('projectId') || undefined;
  const companyId = _req.nextUrl.searchParams.get('companyId') || undefined;
  const openOnly = _req.nextUrl.searchParams.get('openOnly') === '1';

  const clientRows =
    clients.length > 0
      ? await prisma.company.findMany({
          where: { id: { in: clients }, isActive: true },
          select: { id: true, contextSetupJson: true },
        })
      : [];
  const sectorByCompany = new Map(
    clientRows.map((c) => [c.id, parseCompanySectorId(c.contextSetupJson)])
  );

  const casesRaw = await listAtCasesForEngagement(
    engagement.id,
    clients.length ? clients : engagementCompanyIds(engagement),
    { projectId, companyId, openOnly }
  );
  const cases = casesRaw.map((c) => enrichAtCase(c));

  const openCount = cases.filter((c) => c.isOpen).length;

  return NextResponse.json({
    engagement: {
      ...engagement,
      members: engagement.members.map((m) => ({
        ...m,
        sectorId: m.memberRole === 'client' ? sectorByCompany.get(m.companyId) || null : null,
      })),
    },
    cases,
    isOperator: userIsOperator(engagement, tenant.companyIds),
    companyIds: engagementCompanyIds(engagement),
    openCount,
    companySectors: Object.fromEntries(sectorByCompany),
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await ctx.params;
  const engagement = await loadEngagementForTenant(id, tenant.companyIds);
  if (!engagement) return NextResponse.json({ error: 'Serviço não encontrado.' }, { status: 404 });
  if (!userIsOperator(engagement, tenant.companyIds)) {
    return NextResponse.json({ error: 'Só o operador pode editar o serviço.' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.title != null) {
    const title = String(body.title).trim();
    if (title.length < 2) return NextResponse.json({ error: 'Título inválido.' }, { status: 400 });
    data.title = title.slice(0, 200);
  }
  if (body.status != null) {
    const status = String(body.status).trim().toUpperCase();
    if (!isAtEngagementStatus(status)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    }
    data.status = status;
  }
  if (body.description !== undefined) {
    data.description = body.description ? String(body.description).trim().slice(0, 8000) : null;
  }
  if (body.contractRef !== undefined) {
    data.contractRef = body.contractRef ? String(body.contractRef).trim().slice(0, 120) : null;
  }
  if (body.siepProjectId !== undefined) {
    const siepProjectId = body.siepProjectId ? String(body.siepProjectId).trim() : null;
    const v = await validateEngagementSiep(
      siepProjectId,
      engagementCompanyIds({
        operatorCompanyId: engagement.operatorCompanyId,
        sponsorCompanyId: (engagement as { sponsorCompanyId?: string | null }).sponsorCompanyId,
        members: engagement.members,
      })
    );
    if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });
    data.siepProjectId = siepProjectId;
  }

  if (body.sponsorCompanyId !== undefined) {
    const sponsorCompanyId = body.sponsorCompanyId ? String(body.sponsorCompanyId).trim() : null;
    if (sponsorCompanyId) {
      const sponsor = await prisma.company.findFirst({
        where: { id: sponsorCompanyId, isActive: true },
        select: { id: true },
      });
      if (!sponsor) return NextResponse.json({ error: 'Cliente contratante inválido.' }, { status: 400 });
      if (sponsorCompanyId === engagement.operatorCompanyId) {
        return NextResponse.json({ error: 'O contratante não pode ser o operador.' }, { status: 400 });
      }
    }
    data.sponsorCompanyId = sponsorCompanyId;
  }
  if (body.primarySectorId !== undefined) {
    const raw = body.primarySectorId ? String(body.primarySectorId).trim() : '';
    const primarySectorId = raw ? normalizeEconomicSectorId(raw) : null;
    if (raw && !primarySectorId) {
      return NextResponse.json({ error: 'Setor económico inválido.' }, { status: 400 });
    }
    data.primarySectorId = primarySectorId;
  }

  const parseDate = (raw: unknown) => {
    if (raw === null || raw === '') return null;
    if (raw === undefined) return undefined;
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d;
  };
  if (body.startDate !== undefined) data.startDate = parseDate(body.startDate);
  if (body.endDate !== undefined) data.endDate = parseDate(body.endDate);

  const updated = await prisma.nexusAtEngagement.update({
    where: { id: engagement.id },
    data,
    include: {
      operatorCompany: { select: { id: true, name: true, shortName: true } },
      sponsorCompany: { select: { id: true, name: true, shortName: true } },
      network: { select: { id: true, name: true } },
      siepProject: { select: { id: true, name: true, companyId: true, code: true } },
      members: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { company: { select: { id: true, name: true, shortName: true } } },
      },
      projects: {
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { siepProject: { select: { id: true, name: true, companyId: true } } },
      },
    },
  });

  return NextResponse.json({ ok: true, engagement: updated });
}
