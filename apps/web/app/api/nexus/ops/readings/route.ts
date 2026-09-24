export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany, deriveOpsAlerts } from '@/lib/nexus-ops';

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
  const readings = await prisma.nexusReading.findMany({
    where: { companyId },
    orderBy: { recordedAt: 'desc' },
    take: 80,
      include: {
      sensor: { select: { id: true, name: true, metric: true } },
      opsUnit: { select: { id: true, name: true } },
    },
  });
  const alerts = await deriveOpsAlerts(companyId);
  return NextResponse.json({ readings, alerts });
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
  const metric = String(body.metric || '').trim();
  const value = Number(body.value);
  if (!companyId || !metric || !Number.isFinite(value)) {
    return NextResponse.json({ error: 'companyId, metric e value obrigatórios.' }, { status: 400 });
  }
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const recordedAt = body.recordedAt ? new Date(String(body.recordedAt)) : new Date();
  const reading = await prisma.nexusReading.create({
    data: {
      companyId,
      sensorId: String(body.sensorId || '').trim() || null,
      unitId: String(body.unitId || '').trim() || null,
      metric: metric.slice(0, 40),
      value,
      unit: String(body.unit || 'u').slice(0, 16),
      source: 'manual',
      recordedAt: Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt,
    },
  });
  return NextResponse.json({ ok: true, reading });
}
