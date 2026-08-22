export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  engagementCompanyIds,
  isAtEngagementKind,
  listEngagementsForTenant,
  validateEngagementSiep,
} from '@/lib/nexus-at';
import { loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';

export async function GET() {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const engagements = await listEngagementsForTenant(tenant.companyIds);
  return NextResponse.json({ engagements });
}

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const title = String(body.title || '').trim();
  if (title.length < 2) {
    return NextResponse.json({ error: 'Título inválido.' }, { status: 400 });
  }

  const kindRaw = String(body.kind || 'CONTRACT').trim().toUpperCase();
  if (!isAtEngagementKind(kindRaw)) {
    return NextResponse.json({ error: 'Tipo inválido (CONTRACT | PROJECT | PROGRAM).' }, { status: 400 });
  }

  const operatorCompanyId = String(body.operatorCompanyId || '').trim() || tenant.companyIds[0] || '';
  if (!operatorCompanyId || !tenant.companyIds.includes(operatorCompanyId)) {
    return NextResponse.json({ error: 'Empresa operadora inválida ou sem permissão.' }, { status: 403 });
  }

  const clientIds = Array.isArray(body.clientCompanyIds)
    ? [...new Set((body.clientCompanyIds as unknown[]).map((x) => String(x || '').trim()).filter(Boolean))]
    : [];

  for (const cid of clientIds) {
    if (!tenant.companyIds.includes(cid)) {
      return NextResponse.json(
        { error: 'Só pode incluir empresas às quais o utilizador pertence (MVP).' },
        { status: 403 }
      );
    }
  }

  let networkId: string | null = body.networkId ? String(body.networkId).trim() : null;
  if (networkId) {
    const network = await loadNetworkForTenant(networkId, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede NEXUS não encontrada.' }, { status: 404 });
    const fromNetwork = memberCompanyIds(network).filter((id) => id !== operatorCompanyId);
    for (const cid of fromNetwork) {
      if (!clientIds.includes(cid) && tenant.companyIds.includes(cid)) clientIds.push(cid);
    }
  } else {
    networkId = null;
  }

  const siepProjectId = body.siepProjectId ? String(body.siepProjectId).trim() : null;
  const allowed = [...new Set([operatorCompanyId, ...clientIds])];
  const v = await validateEngagementSiep(siepProjectId, allowed);
  if (!v.ok) return NextResponse.json({ error: v.message }, { status: 400 });

  const description = body.description ? String(body.description).trim().slice(0, 8000) : null;
  const contractRef = body.contractRef ? String(body.contractRef).trim().slice(0, 120) : null;

  const parseDate = (raw: unknown) => {
    if (!raw) return null;
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const memberCreates = [
    { companyId: operatorCompanyId, memberRole: 'operator', sortOrder: 0 },
    ...clientIds
      .filter((id) => id !== operatorCompanyId)
      .map((companyId, idx) => ({
        companyId,
        memberRole: 'client',
        sortOrder: idx + 1,
      })),
  ];

  const engagement = await prisma.nexusAtEngagement.create({
    data: {
      title: title.slice(0, 200),
      kind: kindRaw,
      status: 'ACTIVE',
      operatorCompanyId,
      networkId,
      siepProjectId: siepProjectId || null,
      description,
      contractRef,
      startDate: parseDate(body.startDate),
      endDate: parseDate(body.endDate),
      members: { create: memberCreates },
    },
    include: {
      operatorCompany: { select: { id: true, name: true, shortName: true } },
      network: { select: { id: true, name: true } },
      siepProject: { select: { id: true, name: true, companyId: true } },
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

  return NextResponse.json(
    { ok: true, engagement, companyIds: engagementCompanyIds(engagement) },
    { status: 201 }
  );
}
