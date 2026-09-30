export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const wantAurora = url.searchParams.get('aurora') === '1';
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  if (wantAurora) {
    const engagements = await prisma.nexusAtEngagement.findMany({
      where: { operatorCompanyId: companyId, status: { not: 'CLOSED' } },
      select: { id: true },
      take: 40,
    });
    const engagementIds = engagements.map((e) => e.id);
    const members =
      engagementIds.length === 0
        ? []
        : await prisma.nexusAtEngagementMember.findMany({
            where: {
              engagementId: { in: engagementIds },
              companyId: { not: companyId },
              memberRole: { in: ['client', 'principal', 'affiliate'] },
            },
            include: { company: { select: { id: true, name: true, shortName: true } } },
            take: 80,
          });
    const seen = new Set<string>();
    const aurora = members
      .filter((m) => {
        if (seen.has(m.companyId)) return false;
        seen.add(m.companyId);
        return true;
      })
      .map((m) => ({
        id: m.company.id,
        name: m.company.shortName || m.company.name,
      }));
    return NextResponse.json({ aurora });
  }

  const clients = await prisma.radarClient.findMany({
    where: { providerCompanyId: companyId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { properties: true } },
      linkedCompany: { select: { id: true, name: true, shortName: true } },
    },
  });

  return NextResponse.json({
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      contactName: c.contactName,
      contactEmail: c.contactEmail,
      contactPhone: c.contactPhone,
      notes: c.notes,
      linkedCompanyId: c.linkedCompanyId,
      linkedCompanyName: c.linkedCompany
        ? c.linkedCompany.shortName || c.linkedCompany.name
        : null,
      propertyCount: c._count.properties,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const linkedCompanyId = String(body.linkedCompanyId || '').trim() || null;
  let name = String(body.name || '').trim();

  if (linkedCompanyId) {
    const linked = await prisma.company.findFirst({
      where: { id: linkedCompanyId },
      select: { id: true, name: true, shortName: true },
    });
    if (!linked) return NextResponse.json({ error: 'Empresa AURORA inválida.' }, { status: 400 });
    if (!name) name = String(linked.shortName || linked.name).trim();
    const existing = await prisma.radarClient.findFirst({
      where: { providerCompanyId: companyId, linkedCompanyId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ error: 'Este cliente AURORA já está na carteira.' }, { status: 409 });
    }
  }

  if (name.length < 2) return NextResponse.json({ error: 'Nome do cliente obrigatório.' }, { status: 400 });

  const client = await prisma.radarClient.create({
    data: {
      providerCompanyId: companyId,
      name: name.slice(0, 120),
      contactName: String(body.contactName || '').trim().slice(0, 120) || null,
      contactEmail: String(body.contactEmail || '').trim().slice(0, 160) || null,
      contactPhone: String(body.contactPhone || '').trim().slice(0, 40) || null,
      notes: String(body.notes || '').trim().slice(0, 2000) || null,
      linkedCompanyId,
    },
  });

  return NextResponse.json({
    ok: true,
    client: {
      id: client.id,
      name: client.name,
      contactName: client.contactName,
      contactEmail: client.contactEmail,
      contactPhone: client.contactPhone,
      linkedCompanyId: client.linkedCompanyId,
      propertyCount: 0,
      createdAt: client.createdAt.toISOString(),
    },
  });
}
