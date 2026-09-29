export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { buildPropertyProgress, progressPercent } from '@/lib/radar/property-progress';
import { propertySensorCount } from '@/lib/radar/bootstrap';

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
  const clientId = String(url.searchParams.get('clientId') || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const where = clientId
    ? { companyId, clientId }
    : { companyId, clientId: null as string | null };

  const properties = await prisma.radarProperty.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      units: { where: { isActive: true }, select: { id: true } },
      client: { select: { id: true, name: true } },
    },
  });

  const enriched = await Promise.all(
    properties.map(async (p) => {
      const unitIds = p.units.map((u) => u.id);
      const sensorCount = await propertySensorCount(companyId, p.id, unitIds);
      const progressInput = {
        moduleId: p.moduleId,
        crop: p.crop,
        areaHa: p.areaHa,
        layoutJson: p.layoutJson,
        lat: p.lat,
        lng: p.lng,
        unitCount: unitIds.length,
        sensorCount,
      };
      return {
        id: p.id,
        name: p.name,
        moduleId: p.moduleId,
        crop: p.crop,
        areaHa: p.areaHa,
        lat: p.lat,
        lng: p.lng,
        clientId: p.clientId,
        clientName: p.client?.name || null,
        unitCount: unitIds.length,
        sensorCount,
        steps: buildPropertyProgress(progressInput),
        progressPercent: progressPercent(progressInput),
        createdAt: p.createdAt.toISOString(),
      };
    })
  );

  return NextResponse.json({ properties: enriched });
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

  const name = String(body.name || '').trim();
  if (name.length < 2) return NextResponse.json({ error: 'Nome da propriedade obrigatório.' }, { status: 400 });

  const company = await prisma.company.findFirst({
    where: { id: companyId },
    select: { radarOrgRole: true },
  });
  const clientId = String(body.clientId || '').trim() || null;

  if (company?.radarOrgRole === 'provider') {
    if (!clientId) {
      return NextResponse.json({ error: 'Prestadora precisa de um cliente.' }, { status: 400 });
    }
    const client = await prisma.radarClient.findFirst({
      where: { id: clientId, providerCompanyId: companyId },
    });
    if (!client) return NextResponse.json({ error: 'Cliente inválido.' }, { status: 404 });
  } else if (clientId) {
    return NextResponse.json({ error: 'Produtor não usa clientes.' }, { status: 400 });
  }

  const areaHa = body.areaHa == null || body.areaHa === '' ? null : Number(body.areaHa);
  const property = await prisma.radarProperty.create({
    data: {
      companyId,
      clientId,
      name: name.slice(0, 120),
      moduleId: String(body.moduleId || '').trim() || null,
      crop: String(body.crop || '').trim().slice(0, 80) || null,
      areaHa: Number.isFinite(areaHa as number) && (areaHa as number) > 0 ? (areaHa as number) : null,
    },
  });

  return NextResponse.json({
    ok: true,
    property: {
      id: property.id,
      name: property.name,
      clientId: property.clientId,
      moduleId: property.moduleId,
      progressPercent: 0,
    },
  });
}
