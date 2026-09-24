export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashSensorToken, ingestCompanyForSensor } from '@/lib/nexus-ops';

/**
 * Ingest HTTP sem sessão — Authorization: Bearer nxsens_… ou body.token.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const header = req.headers.get('authorization') || '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const token = bearer || String(body.token || '').trim();
  if (!token.startsWith('nxsens_')) {
    return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  }

  const tokenHash = hashSensorToken(token);
  const sensor = await prisma.nexusSensor.findFirst({
    where: { tokenHash },
    select: { id: true, companyId: true, unitId: true, metric: true, tokenHash: true, isActive: true },
  });
  const auth = ingestCompanyForSensor(sensor, token);
  if (!auth.ok || !sensor) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

  const value = Number(body.value);
  if (!Number.isFinite(value)) {
    return NextResponse.json({ error: 'value obrigatório.' }, { status: 400 });
  }
  const metric = String(body.metric || sensor.metric || '').trim() || sensor.metric;
  const recordedAt = body.recordedAt ? new Date(String(body.recordedAt)) : new Date();

  const [reading] = await prisma.$transaction([
    prisma.nexusReading.create({
      data: {
        companyId: sensor.companyId,
        sensorId: sensor.id,
        unitId: sensor.unitId,
        metric: metric.slice(0, 40),
        value,
        unit: String(body.unit || (metric === 'soil_moisture' ? '%' : 'u')).slice(0, 16),
        source: 'http',
        recordedAt: Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt,
      },
      select: { id: true, recordedAt: true, metric: true, value: true },
    }),
    prisma.nexusSensor.update({
      where: { id: sensor.id },
      data: { lastSeenAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true, reading, companyId: sensor.companyId });
}
