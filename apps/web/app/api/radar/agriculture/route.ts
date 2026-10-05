export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany, generateSensorToken } from '@/lib/nexus-ops';
import { ensureOpsRules, maybeNotifyWhatsappAlerts, requestAutomationCommand } from '@/lib/nexus-ops-command';
import { AGRICULTURE_MODULE } from '@/lib/nexus-sector-modules';
import { whatsappConfigured } from '@/lib/nexus-whatsapp';
import {
  DEFAULT_IRRIGATION_MM,
  buildAgricultureBoard,
  isAgricultureLineKind,
  isAgricultureRuleKind,
  isRadarParcel,
} from '@/lib/radar/agriculture';

const SENSOR_METRICS = new Set(AGRICULTURE_MODULE.metrics.map((m) => m.id));

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
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const [units, entries, readings, sensors, rules, whatsapp] = await Promise.all([
    prisma.nexusOpsUnit.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      take: 80,
    }),
    prisma.nexusFieldEntry.findMany({
      where: { companyId },
      orderBy: { occurredAt: 'desc' },
      take: 200,
      include: { unit: { select: { id: true, name: true } } },
    }),
    prisma.nexusReading.findMany({
      where: { companyId, metric: { in: [...SENSOR_METRICS] } },
      orderBy: { recordedAt: 'desc' },
      take: 200,
    }),
    prisma.nexusSensor.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true, name: true, metric: true, unitId: true, lastSeenAt: true },
    }),
    ensureOpsRules(companyId),
    prisma.nexusWhatsappLink.findFirst({
      where: { companyId },
      select: { phoneE164: true, alertsEnabled: true, lastInboundAt: true, lastOutboundAt: true, pendingCommandKind: true },
    }),
  ]);

  const parcelIds = new Set(units.filter(isRadarParcel).map((u) => u.id));
  const parcelEntries = entries.filter((e) => e.unitId && parcelIds.has(e.unitId));
  const board = buildAgricultureBoard({
    now: new Date(),
    units,
    entries: parcelEntries.map((e) => ({
      unitId: e.unitId,
      kind: e.kind,
      occurredAt: e.occurredAt,
      payloadJson: e.payloadJson,
    })),
    readings: readings
      .filter((r) => r.unitId && parcelIds.has(r.unitId))
      .map((r) => ({
        unitId: r.unitId,
        metric: r.metric,
        value: r.value,
        recordedAt: r.recordedAt,
        source: r.source,
      })),
  });

  const lines = parcelEntries.slice(0, 20)
    .map((e) => ({
      id: e.id,
      kind: e.kind,
      occurredAt: e.occurredAt.toISOString(),
      channel: e.channel,
      note: noteOf(e.payloadJson),
      unitName: e.unit?.name || null,
    }));

  const liveSensors = sensors
    .filter((s) => !s.unitId || parcelIds.has(s.unitId))
    .map((s) => {
      const last = readings.find((r) => r.sensorId === s.id || (r.unitId === s.unitId && r.metric === s.metric));
      return {
        ...s,
        lastValue: last?.value ?? null,
        lastRecordedAt: last?.recordedAt
          ? last.recordedAt.toISOString()
          : s.lastSeenAt
            ? new Date(s.lastSeenAt).toISOString()
            : null,
      };
    });

  const spaces = units.map((u) => ({
    id: u.id,
    name: u.name,
    kind: u.kind,
    sectorId: u.sectorId,
    crop: u.crop,
    areaHa: u.areaHa,
  }));

  return NextResponse.json({
    companyId,
    moduleId: 'agriculture',
    decision: board.decision,
    parcels: board.parcels,
    spaces,
    hasSpaces: spaces.length > 0,
    alerts: board.alerts.filter((a) => a.code !== 'no_parcels'),
    lines,
    sensors: liveSensors,
    rules: rules.filter((r) => isAgricultureRuleKind(r.kind)),
    whatsapp,
    whatsappConfigured: whatsappConfigured(),
  });
}

function noteOf(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const row = payload as { note?: unknown; product?: unknown; mm?: unknown };
  const note = String(row.note || '').trim();
  if (note) return note;
  if (row.product) return String(row.product);
  if (row.mm != null) return `${row.mm} mm`;
  return '';
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
  const tenant = auth.tenant;
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const action = String(body.action || '').trim();
  if (action === 'parcel' || action === 'open') return createParcel(companyId, body);
  if (action === 'line') return createLine(companyId, engagementId, tenant.userId, body);
  if (action === 'sensor') return createSensor(companyId, body);
  if (action === 'rule') return setRule(companyId, body);
  if (action === 'command') return askCommand(companyId, body);
  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}

async function createParcel(companyId: string, body: Record<string, unknown>) {
  const name = String(body.name || '').trim() || 'Parcela 1';
  if (name.length < 2) return NextResponse.json({ error: 'Nome da parcela obrigatório.' }, { status: 400 });
  const areaHa = body.areaHa == null || body.areaHa === '' ? null : Number(body.areaHa);
  const moduleId = String(body.moduleId || 'agriculture').trim();
  const sectorId = ['agriculture', 'agroindustry', 'livestock', 'carbon'].includes(moduleId)
    ? moduleId
    : 'agriculture';
  const kind =
    sectorId === 'livestock' ? 'herd' : sectorId === 'agroindustry' ? 'lot' : sectorId === 'carbon' ? 'generic' : 'parcel';
  const propertyId = String(body.propertyId || '').trim() || null;
  if (propertyId) {
    const prop = await prisma.radarProperty.findFirst({ where: { id: propertyId, companyId } });
    if (!prop) return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 400 });
  }
  const unit = await prisma.nexusOpsUnit.create({
    data: {
      companyId,
      propertyId,
      sectorId,
      kind,
      name: name.slice(0, 120),
      areaHa: Number.isFinite(areaHa as number) && (areaHa as number) > 0 ? (areaHa as number) : null,
      crop: String(body.crop || '').trim().slice(0, 80) || null,
    },
  });
  return NextResponse.json({ ok: true, unit, moduleId: sectorId });
}

async function createLine(companyId: string, engagementId: string | null, userId: string, body: Record<string, unknown>) {
  const kind = String(body.kind || '').trim();
  const unitId = String(body.unitId || '').trim();
  if (!isAgricultureLineKind(kind) || !unitId) {
    return NextResponse.json({ error: 'Parcela e tipo de linha obrigatórios.' }, { status: 400 });
  }
  const unit = await prisma.nexusOpsUnit.findFirst({
    where: {
      id: unitId,
      companyId,
      isActive: true,
      kind: kind === 'scout' ? { in: ['parcel', 'lot', 'herd', 'generic'] } : 'parcel',
    },
  });
  if (!unit) {
    return NextResponse.json(
      { error: kind === 'scout' ? 'Espaço inválido.' : 'Parcela inválida.' },
      { status: 400 },
    );
  }

  const note = String(body.note || '').trim().slice(0, 2000);
  const mm =
    body.mm == null || body.mm === ''
      ? kind === 'irrigation'
        ? DEFAULT_IRRIGATION_MM
        : null
      : Number(body.mm);
  const moisture = body.moisture == null || body.moisture === '' ? null : Number(body.moisture);
  const phiDays = body.phiDays == null || body.phiDays === '' ? null : Number(body.phiDays);
  const product = String(body.product || '').trim().slice(0, 80);

  if (kind === 'irrigation' && !(Number.isFinite(mm as number) && (mm as number) > 0)) {
    return NextResponse.json({ error: 'Irrigação pede milímetros.' }, { status: 400 });
  }
  if (kind === 'input' && product.length < 2) {
    return NextResponse.json({ error: 'Insumo pede o produto.' }, { status: 400 });
  }

  const occurredAt = new Date();
  const payload: Record<string, unknown> = { note };
  if (kind === 'irrigation' && mm != null) payload.mm = mm;
  if (kind === 'input') {
    payload.product = product;
    payload.phiDays = Number.isFinite(phiDays as number) && (phiDays as number) > 0 ? phiDays : 7;
  }
  if (moisture != null && Number.isFinite(moisture)) payload.moisture = moisture;

  const entry = await prisma.nexusFieldEntry.create({
    data: {
      companyId,
      unitId,
      kind,
      occurredAt,
      payloadJson: payload as object,
      authorUserId: userId,
      channel: 'app',
      engagementId,
    },
  });

  if (kind === 'irrigation' && mm != null && Number.isFinite(mm)) {
    await prisma.nexusReading.create({
      data: {
        companyId,
        unitId,
        metric: 'irrigation_mm',
        value: mm,
        unit: 'mm',
        source: 'manual',
        recordedAt: occurredAt,
      },
    });
  }
  if (moisture != null && Number.isFinite(moisture)) {
    await prisma.nexusReading.create({
      data: {
        companyId,
        unitId,
        metric: 'soil_moisture',
        value: moisture,
        unit: '%',
        source: 'manual',
        recordedAt: occurredAt,
      },
    });
  }

  void maybeNotifyWhatsappAlerts(companyId).catch(() => undefined);
  return NextResponse.json({ ok: true, entryId: entry.id });
}

async function createSensor(companyId: string, body: Record<string, unknown>) {
  const name = String(body.name || '').trim();
  const metric = String(body.metric || 'soil_moisture').trim();
  if (name.length < 2) return NextResponse.json({ error: 'Nome do sensor obrigatório.' }, { status: 400 });
  if (!SENSOR_METRICS.has(metric)) return NextResponse.json({ error: 'Métrica inválida.' }, { status: 400 });
  const unitId = String(body.unitId || '').trim() || null;
  if (unitId) {
    const unit = await prisma.nexusOpsUnit.findFirst({
      where: { id: unitId, companyId, isActive: true, kind: 'parcel' },
    });
    if (!unit) return NextResponse.json({ error: 'Parcela inválida.' }, { status: 400 });
  }
  const { token, hash } = generateSensorToken();
  const sensor = await prisma.nexusSensor.create({
    data: {
      companyId,
      unitId,
      name: name.slice(0, 80),
      metric,
      tokenHash: hash,
    },
  });
  return NextResponse.json({
    ok: true,
    sensor: { id: sensor.id, name: sensor.name, metric: sensor.metric, unitId: sensor.unitId },
    token,
    ingestPath: '/api/nexus/ingest/readings',
  });
}

async function setRule(companyId: string, body: Record<string, unknown>) {
  const kind = String(body.kind || '').trim();
  if (!isAgricultureRuleKind(kind)) {
    return NextResponse.json({ error: 'Automação inválida para agricultura.' }, { status: 400 });
  }
  await ensureOpsRules(companyId);
  const enabled = Boolean(body.enabled);
  const rule = await prisma.nexusOpsRule.update({
    where: { companyId_kind: { companyId, kind } },
    data: {
      enabled,
      lastCommandAt: enabled && kind !== 'whatsapp_alerts' ? new Date() : undefined,
    },
  });
  let command: { sent: boolean; reason?: string } | null = null;
  if (enabled && kind !== 'whatsapp_alerts') {
    command = await requestAutomationCommand(companyId, kind);
  }
  return NextResponse.json({ ok: true, rule, command });
}

async function askCommand(companyId: string, body: Record<string, unknown>) {
  const kind = String(body.kind || 'irrigation').trim();
  if (!isAgricultureRuleKind(kind) || kind === 'whatsapp_alerts') {
    return NextResponse.json({ error: 'Comando inválido.' }, { status: 400 });
  }
  const command = await requestAutomationCommand(companyId, kind);
  return NextResponse.json({ ok: true, command });
}
