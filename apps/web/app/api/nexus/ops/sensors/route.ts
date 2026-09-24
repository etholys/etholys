export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany, generateSensorToken } from '@/lib/nexus-ops';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const sensors = await prisma.nexusSensor.findMany({
    where: { companyId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: { unit: { select: { id: true, name: true } } },
  });
  return NextResponse.json({
    sensors: sensors.map(({ tokenHash: _t, ...s }) => s),
  });
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
  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const name = String(body.name || '').trim();
  const metric = String(body.metric || 'soil_moisture').trim() || 'soil_moisture';
  if (!companyId || name.length < 2) {
    return NextResponse.json({ error: 'Empresa e nome obrigatórios.' }, { status: 400 });
  }
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const unitId = String(body.unitId || '').trim() || null;
  if (unitId) {
    const unit = await prisma.nexusOpsUnit.findFirst({ where: { id: unitId, companyId, isActive: true } });
    if (!unit) return NextResponse.json({ error: 'Unidade inválida.' }, { status: 400 });
  }
  const { token, hash } = generateSensorToken();
  const sensor = await prisma.nexusSensor.create({
    data: {
      companyId,
      unitId,
      name: name.slice(0, 80),
      metric: metric.slice(0, 40),
      tokenHash: hash,
    },
    include: { unit: { select: { id: true, name: true } } },
  });
  const { tokenHash: _hidden, ...safe } = sensor;
  return NextResponse.json({
    ok: true,
    sensor: safe,
    token,
    ingestPath: '/api/nexus/ingest/readings',
  });
}
