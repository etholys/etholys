export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashSensorToken, ingestCompanyForSensor } from '@/lib/nexus-ops';
import { maybeNotifyWhatsappAlerts } from '@/lib/nexus-ops-command';

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

  const recordedAt = body.recordedAt ? new Date(String(body.recordedAt)) : new Date();
  const when = Number.isNaN(recordedAt.getTime()) ? new Date() : recordedAt;
  const batchRaw = Array.isArray(body.readings) ? body.readings : null;
  const batch = (batchRaw || [{ metric: body.metric, value: body.value, unit: body.unit }])
    .map((row) => {
      const item = row && typeof row === 'object' ? (row as Record<string, unknown>) : {};
      const metric = String(item.metric || body.metric || sensor.metric || '').trim() || sensor.metric;
      const value = Number(item.value);
      return { metric: metric.slice(0, 40), value, unit: String(item.unit || '').slice(0, 16) };
    })
    .filter((row) => row.metric && Number.isFinite(row.value));
  if (batch.length === 0) {
    return NextResponse.json({ error: 'value obrigatório.' }, { status: 400 });
  }

  const readings = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of batch) {
      created.push(
        await tx.nexusReading.create({
          data: {
            companyId: sensor.companyId,
            sensorId: sensor.id,
            unitId: sensor.unitId,
            metric: row.metric,
            value: row.value,
            unit: (row.unit || (row.metric === 'soil_moisture' ? '%' : 'u')).slice(0, 16),
            source: 'http',
            recordedAt: when,
          },
          select: { id: true, recordedAt: true, metric: true, value: true },
        }),
      );
    }
    await tx.nexusSensor.update({
      where: { id: sensor.id },
      data: { lastSeenAt: new Date() },
    });
    return created;
  });

  void maybeNotifyWhatsappAlerts(sensor.companyId).catch(() => undefined);

  return NextResponse.json({
    ok: true,
    reading: readings[0],
    readings,
    companyId: sensor.companyId,
  });
}
