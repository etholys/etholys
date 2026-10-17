export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashSensorToken, ingestCompanyForSensor } from '@/lib/nexus-ops';
import { MOISTURE_THRESHOLD } from '@/lib/radar/agriculture';
import {
  deviceBySku,
  normalizeDevEui,
  readingsFromDecoded,
  unitForMetric,
  type NormalizedReading,
} from '@/lib/radar/devices';
import {
  emptyRadarLayout,
  parseRadarLayout,
  type RadarDeviceBinding,
  type RadarSiteLayoutDoc,
  type RadarValveCommand,
} from '@/lib/radar/site-layout';

/**
 * Ponte LoRaWAN (LPS8N / ChirpStack / TTN).
 * POST Authorization: Bearer nxsens_…
 *   { devEui, decoded: { soil_moisture, ec, temperature, humidity, illuminance, flow, valve } }
 *   ou { devEui, readings: [{ metric, value }] }
 * GET  mesma auth — fila de comandos da válvula (SVC01-LS2) ainda por aplicar.
 * POST { action: 'ack', commandId } — gateway confirma o downlink.
 * POST { action: 'open'|'close', devEui } — enfileira comando (também usado pela UI via sessão noutro route).
 */

async function sensorFromRequest(req: NextRequest, body: Record<string, unknown>) {
  const header = req.headers.get('authorization') || '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const token = bearer || String(body.token || '').trim();
  if (!token.startsWith('nxsens_')) return null;
  const sensor = await prisma.nexusSensor.findFirst({
    where: { tokenHash: hashSensorToken(token) },
    select: { id: true, companyId: true, unitId: true, metric: true, tokenHash: true, isActive: true },
  });
  const auth = ingestCompanyForSensor(sensor, token);
  if (!auth.ok || !sensor) return null;
  return sensor;
}

async function companyLayouts(companyId: string) {
  const rows = await prisma.radarProperty.findMany({
    where: { companyId },
    select: { id: true, layoutJson: true },
  });
  return rows.map((row) => ({
    id: row.id,
    layout: parseRadarLayout(row.layoutJson) || emptyRadarLayout(),
  }));
}

function findDevice(layouts: Array<{ id: string; layout: RadarSiteLayoutDoc }>, devEui: string | null, sensorId: string | null) {
  for (const row of layouts) {
    const device = (row.layout.devices || []).find((d) => {
      if (sensorId && d.sensorId === sensorId) return true;
      if (devEui && d.devEui && d.devEui === devEui) return true;
      return false;
    });
    if (device) return { propertyId: row.id, layout: row.layout, device };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const sensor = await sensorFromRequest(req, {});
  if (!sensor) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });
  const layouts = await companyLayouts(sensor.companyId);
  const commands: Array<RadarValveCommand & { propertyId: string }> = [];
  for (const row of layouts) {
    for (const cmd of row.layout.commands || []) {
      if (cmd.status === 'pending') commands.push({ ...cmd, propertyId: row.id });
    }
  }
  return NextResponse.json({ ok: true, commands });
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  const caller = await sensorFromRequest(req, body);
  if (!caller) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 });

  const layouts = await companyLayouts(caller.companyId);
  const devEui = normalizeDevEui(body.devEui || body.dev_eui || (body.end_device_ids as { dev_eui?: string } | undefined)?.dev_eui);
  const action = String(body.action || '').trim();

  if (action === 'ack') {
    const commandId = String(body.commandId || '').trim();
    if (!commandId) return NextResponse.json({ error: 'commandId obrigatório.' }, { status: 400 });
    for (const row of layouts) {
      const commands = row.layout.commands || [];
      if (!commands.some((c) => c.id === commandId)) continue;
      const next: RadarSiteLayoutDoc = {
        ...row.layout,
        commands: commands.map((c) => (c.id === commandId ? { ...c, status: 'acked' as const } : c)),
      };
      await prisma.radarProperty.update({ where: { id: row.id }, data: { layoutJson: next as object } });
      return NextResponse.json({ ok: true, commandId });
    }
    return NextResponse.json({ error: 'Comando não encontrado.' }, { status: 404 });
  }

  const hit =
    findDevice(layouts, devEui, caller.metric === 'gateway' ? null : caller.id) ||
    (caller.metric !== 'gateway' ? { propertyId: '', layout: emptyRadarLayout(), device: null as RadarDeviceBinding | null } : null);
  if (!hit && caller.metric === 'gateway') {
    return NextResponse.json({ error: 'devEui não registado nesta exploração.' }, { status: 404 });
  }

  const targetSensorId = hit?.device?.sensorId || caller.id;
  const target = await prisma.nexusSensor.findFirst({
    where: { id: targetSensorId, companyId: caller.companyId, isActive: true },
    select: { id: true, unitId: true, metric: true },
  });
  if (!target) return NextResponse.json({ error: 'Sensor inválido.' }, { status: 404 });

  if (action === 'open' || action === 'close') {
    if (!hit?.propertyId) return NextResponse.json({ error: 'Válvula sem propriedade.' }, { status: 400 });
    const profile = deviceBySku(hit.device?.sku);
    if (profile && profile.role !== 'actuator') {
      return NextResponse.json({ error: 'Este equipamento não é uma válvula.' }, { status: 400 });
    }
    return NextResponse.json(await enqueueValve(hit.propertyId, hit.layout, target, action));
  }

  const decoded =
    body.decoded ||
    body.object ||
    (body.uplink_message as { decoded_payload?: unknown } | undefined)?.decoded_payload ||
    null;
  let readings: NormalizedReading[] = readingsFromDecoded(decoded);
  if (Array.isArray(body.readings)) {
    for (const row of body.readings) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      const metric = String(item.metric || '').trim();
      const value = Number(item.value);
      if (!metric || !Number.isFinite(value)) continue;
      readings.push({ metric: metric.slice(0, 40), value, unit: String(item.unit || unitForMetric(metric)).slice(0, 16) });
    }
  }
  if (readings.length === 0 && Number.isFinite(Number(body.value))) {
    readings = [{ metric: target.metric, value: Number(body.value), unit: unitForMetric(target.metric) }];
  }
  if (readings.length === 0) {
    return NextResponse.json({ error: 'Sem leituras no payload.' }, { status: 400 });
  }

  const when = new Date();
  const created = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const row of readings) {
      rows.push(
        await tx.nexusReading.create({
          data: {
            companyId: caller.companyId,
            sensorId: target.id,
            unitId: target.unitId,
            metric: row.metric.slice(0, 40),
            value: row.value,
            unit: (row.unit || unitForMetric(row.metric)).slice(0, 16),
            source: 'lorawan',
            recordedAt: when,
          },
          select: { id: true, metric: true, value: true },
        }),
      );
    }
    await tx.nexusSensor.update({ where: { id: target.id }, data: { lastSeenAt: when } });
    if (caller.id !== target.id) {
      await tx.nexusSensor.update({ where: { id: caller.id }, data: { lastSeenAt: when } });
    }
    return rows;
  });

  let command: RadarValveCommand | null = null;
  const moisture = readings.find((r) => r.metric === 'soil_moisture');
  if (moisture && moisture.value < MOISTURE_THRESHOLD && target.unitId && hit?.propertyId) {
    const valve = (hit.layout.devices || []).find((d) => d.unitId === target.unitId && deviceBySku(d.sku)?.role === 'actuator');
    const pending = (hit.layout.commands || []).some((c) => c.sensorId === valve?.sensorId && c.status === 'pending');
    if (valve && !pending) {
      const valveSensor = await prisma.nexusSensor.findFirst({
        where: { id: valve.sensorId, companyId: caller.companyId },
        select: { id: true, unitId: true },
      });
      if (valveSensor) {
        const queued = await enqueueValve(hit.propertyId, hit.layout, valveSensor, 'open');
        command = queued.command;
      }
    }
  }

  return NextResponse.json({ ok: true, readings: created, command });
}

async function enqueueValve(
  propertyId: string,
  layout: RadarSiteLayoutDoc,
  sensor: { id: string; unitId: string | null },
  action: 'open' | 'close',
) {
  const device = (layout.devices || []).find((d) => d.sensorId === sensor.id);
  const command: RadarValveCommand = {
    id: `cmd_${Date.now().toString(36)}`,
    sensorId: sensor.id,
    devEui: device?.devEui || null,
    unitId: sensor.unitId,
    action,
    status: 'pending',
    at: new Date().toISOString(),
  };
  const next: RadarSiteLayoutDoc = {
    ...layout,
    commands: [...(layout.commands || []), command].slice(-40),
  };
  await prisma.radarProperty.update({ where: { id: propertyId }, data: { layoutJson: next as object } });
  return { ok: true as const, command };
}
