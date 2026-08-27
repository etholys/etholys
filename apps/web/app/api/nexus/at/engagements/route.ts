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

  // Novas fichas de empresa-cliente (mesmo contrato, trabalhos separados) — sem membership do operador.
  const newClientsRaw = Array.isArray(body.newClients) ? (body.newClients as unknown[]) : [];
  for (const raw of newClientsRaw) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const name = String(row.name || '').trim().slice(0, 200);
    if (name.length < 2) continue;
    const shortRaw = String(row.shortName || '').trim().slice(0, 40);
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
      data: { name, shortName, color: '#6366F1' },
      select: { id: true },
    });
    if (!clientIds.includes(created.id)) clientIds.push(created.id);
  }

  if (clientIds.length > 0) {
    const existing = await prisma.company.findMany({
      where: { id: { in: clientIds }, isActive: true },
      select: { id: true },
    });
    const ok = new Set(existing.map((c) => c.id));
    const missing = clientIds.filter((id) => !ok.has(id));
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Uma ou mais empresas-cliente são inválidas.' }, { status: 400 });
    }
  }

  // Contratante / quem paga (incubadora, instituição) — pode ser diferente das atendidas.
  let sponsorCompanyId: string | null = body.sponsorCompanyId ? String(body.sponsorCompanyId).trim() : null;
  if (!sponsorCompanyId && body.newSponsor && typeof body.newSponsor === 'object') {
    const row = body.newSponsor as Record<string, unknown>;
    const name = String(row.name || '').trim().slice(0, 200);
    if (name.length >= 2) {
      const shortRaw = String(row.shortName || '').trim().slice(0, 40);
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
        data: { name, shortName, color: '#0F766E' },
        select: { id: true },
      });
      sponsorCompanyId = created.id;
    }
  }
  if (sponsorCompanyId) {
    const sponsor = await prisma.company.findFirst({
      where: { id: sponsorCompanyId, isActive: true },
      select: { id: true },
    });
    if (!sponsor) {
      return NextResponse.json({ error: 'Cliente contratante inválido.' }, { status: 400 });
    }
    if (sponsorCompanyId === operatorCompanyId) {
      sponsorCompanyId = null; // operador não é contratante
    }
  }

  let networkId: string | null = body.networkId ? String(body.networkId).trim() : null;
  if (networkId) {
    const network = await loadNetworkForTenant(networkId, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede NEXUS não encontrada.' }, { status: 404 });
    const fromNetwork = memberCompanyIds(network).filter((id) => id !== operatorCompanyId);
    for (const cid of fromNetwork) {
      if (!clientIds.includes(cid)) clientIds.push(cid);
    }
  } else {
    networkId = null;
  }

  const siepProjectId = body.siepProjectId ? String(body.siepProjectId).trim() : null;
  const allowed = [
    ...new Set([operatorCompanyId, ...(sponsorCompanyId ? [sponsorCompanyId] : []), ...clientIds]),
  ];
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
      .filter((id) => id !== operatorCompanyId && id !== sponsorCompanyId)
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
      sponsorCompanyId,
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

  return NextResponse.json(
    { ok: true, engagement, companyIds: engagementCompanyIds(engagement) },
    { status: 201 }
  );
}
