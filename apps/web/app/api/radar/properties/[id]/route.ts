export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany, generateSensorToken } from '@/lib/nexus-ops';
import {
  buildPropertyProgress,
  clampCoord,
  nextIncompleteStep,
  normalizeModuleId,
  progressPercent,
} from '@/lib/radar/property-progress';
import { propertySensorCount } from '@/lib/radar/bootstrap';
import { RADAR_SPACE_KINDS } from '@/lib/radar/space';
import {
  emptyRadarLayout,
  mergeLayoutWithSpaces,
  parseRadarLayout,
  sanitizeLayoutPatch,
  cropsFromLayout,
  withCrops,
} from '@/lib/radar/site-layout';
import { isRadarParcel } from '@/lib/radar/agriculture';
import { AGRICULTURE_MODULE } from '@/lib/nexus-sector-modules';

const SENSOR_METRICS = new Set(AGRICULTURE_MODULE.metrics.map((m) => m.id));

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const property = await prisma.radarProperty.findFirst({
    where: { id, companyId },
    include: {
      client: { select: { id: true, name: true } },
      units: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!property) return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 404 });

  const unitIds = property.units.map((u) => u.id);
  const sensors = await prisma.nexusSensor.findMany({
    where: {
      companyId,
      isActive: true,
      OR: unitIds.length ? [{ unitId: { in: unitIds } }, { unitId: null }] : [{ unitId: null }],
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, name: true, metric: true, unitId: true, lastSeenAt: true },
  });

  const readingOr = [
    ...(sensors.length ? [{ sensorId: { in: sensors.map((s) => s.id) } }] : []),
    ...(unitIds.length ? [{ unitId: { in: unitIds } }] : []),
  ];
  const readings = readingOr.length
    ? await prisma.nexusReading.findMany({
        where: { companyId, OR: readingOr },
        orderBy: { recordedAt: 'desc' },
        take: 200,
        select: { sensorId: true, unitId: true, metric: true, value: true, recordedAt: true },
      })
    : [];

  const liveSensors = sensors.map((s) => {
    const last =
      readings.find((r) => r.sensorId === s.id) ||
      readings.find((r) => r.unitId === s.unitId && r.metric === s.metric);
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

  const moistureByUnit = new Map<string, number>();
  for (const r of readings) {
    if (r.metric !== 'soil_moisture' || !r.unitId || moistureByUnit.has(r.unitId)) continue;
    moistureByUnit.set(r.unitId, r.value);
  }

  const sensorCount = await propertySensorCount(companyId, property.id, unitIds);
  const progressInput = {
    moduleId: property.moduleId,
    crop: property.crop,
    areaHa: property.areaHa,
    layoutJson: property.layoutJson,
    lat: property.lat,
    lng: property.lng,
    unitCount: unitIds.length,
    sensorCount,
  };

  const spaceIds = property.units.filter(isRadarParcel).map((u) => u.id);
  const saved = parseRadarLayout(property.layoutJson) || emptyRadarLayout();
  const layout = mergeLayoutWithSpaces(
    saved,
    spaceIds,
    sensors.map((s) => ({ id: s.id, spaceId: s.unitId }))
  );

  return NextResponse.json({
    property: {
      id: property.id,
      name: property.name,
      moduleId: property.moduleId,
      crop: property.crop,
      areaHa: property.areaHa,
      lat: property.lat,
      lng: property.lng,
      clientId: property.clientId,
      clientName: property.client?.name || null,
      units: property.units.map((u) => ({
        id: u.id,
        name: u.name,
        kind: u.kind,
        crop: u.crop,
        areaHa: u.areaHa,
        sectorId: u.sectorId,
        moisture: moistureByUnit.get(u.id) ?? null,
      })),
      sensors: liveSensors,
      layout,
      crops: cropsFromLayout(parseRadarLayout(property.layoutJson)),
      steps: buildPropertyProgress(progressInput),
      nextStep: nextIncompleteStep(progressInput),
      progressPercent: progressPercent(progressInput),
    },
  });
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
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

  const property = await prisma.radarProperty.findFirst({ where: { id, companyId } });
  if (!property) return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 404 });

  const action = String(body.action || 'update').trim();

  if (action === 'characterize') {
    const moduleId = normalizeModuleId(body.moduleId);
    if (!moduleId) return NextResponse.json({ error: 'Módulo inválido.' }, { status: 400 });
    const name = String(body.name || property.name).trim();
    const areaHa = body.areaHa == null || body.areaHa === '' ? null : Number(body.areaHa);
    const crop = String(body.crop || '').trim().slice(0, 80) || null;

    const updated = await prisma.radarProperty.update({
      where: { id },
      data: {
        name: name.slice(0, 120) || property.name,
        moduleId,
        crop,
        areaHa: Number.isFinite(areaHa as number) && (areaHa as number) > 0 ? (areaHa as number) : null,
      },
    });

    await prisma.businessDossier.upsert({
      where: { companyId },
      create: { companyId, pulsoModule: moduleId },
      update: { pulsoModule: moduleId },
    });

    // Ensure at least one measurement space under this property
    const unitCount = await prisma.nexusOpsUnit.count({
      where: { propertyId: id, isActive: true },
    });
    if (unitCount === 0) {
      const kind = RADAR_SPACE_KINDS[moduleId].unitKind;
      await prisma.nexusOpsUnit.create({
        data: {
          companyId,
          propertyId: id,
          sectorId: moduleId,
          kind,
          name: crop || updated.name,
          crop,
          areaHa: updated.areaHa,
        },
      });
    }

    // Seed crop catalog from characterize crop
    if (crop) {
      const layout = parseRadarLayout(property.layoutJson) || emptyRadarLayout();
      const crops = cropsFromLayout(layout);
      if (!crops.some((c) => c.name.toLowerCase() === crop.toLowerCase())) {
        crops.push({
          id: `crop_${Date.now().toString(36)}`,
          name: crop,
          variety: null,
          season: null,
        });
        await prisma.radarProperty.update({
          where: { id },
          data: { layoutJson: withCrops(layout, crops) as object },
        });
      }
    }

    return NextResponse.json({ ok: true, propertyId: id });
  }

  if (action === 'geolocate') {
    const coords = clampCoord(Number(body.lat), Number(body.lng));
    if (!coords) return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 });
    await prisma.radarProperty.update({
      where: { id },
      data: { lat: coords.lat, lng: coords.lng },
    });
    return NextResponse.json({ ok: true, ...coords });
  }

  if (action === 'layout') {
    const units = await prisma.nexusOpsUnit.findMany({
      where: { propertyId: id, companyId, isActive: true },
      select: { id: true, kind: true },
    });
    const sensors = await prisma.nexusSensor.findMany({
      where: { companyId, isActive: true, unitId: { in: units.map((u) => u.id) } },
      select: { id: true },
    });
    const allowedSpaces = new Set(units.filter(isRadarParcel).map((u) => u.id));
    const allowedSensors = new Set(sensors.map((s) => s.id));
    const patch = sanitizeLayoutPatch(body.layout ?? body, allowedSpaces, allowedSensors);
    if (!patch || patch.spaces.length === 0) {
      return NextResponse.json({ error: 'Layout inválido.' }, { status: 400 });
    }
    await prisma.radarProperty.update({
      where: { id },
      data: { layoutJson: patch as object },
    });
    return NextResponse.json({ ok: true, layout: patch });
  }

  if (action === 'sensor') {
    const name = String(body.name || '').trim();
    const metric = String(body.metric || 'soil_moisture').trim();
    if (name.length < 2) return NextResponse.json({ error: 'Nome do sensor obrigatório.' }, { status: 400 });
    if (!SENSOR_METRICS.has(metric)) return NextResponse.json({ error: 'Métrica inválida.' }, { status: 400 });
    let unitId = String(body.unitId || '').trim() || null;
    if (unitId) {
      const unit = await prisma.nexusOpsUnit.findFirst({
        where: { id: unitId, propertyId: id, companyId, isActive: true },
      });
      if (!unit) return NextResponse.json({ error: 'Espaço inválido.' }, { status: 400 });
    } else {
      const first = await prisma.nexusOpsUnit.findFirst({
        where: { propertyId: id, companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      unitId = first?.id || null;
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

  // generic rename / crop catalog
  if (action === 'crop_add') {
    const cropName = String(body.name || '').trim();
    if (cropName.length < 2) return NextResponse.json({ error: 'Nome do cultivo obrigatório.' }, { status: 400 });
    const layout = parseRadarLayout(property.layoutJson) || emptyRadarLayout();
    const crops = cropsFromLayout(layout);
    const id = `crop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    crops.push({
      id,
      name: cropName.slice(0, 80),
      variety: String(body.variety || '').trim().slice(0, 80) || null,
      season: String(body.season || '').trim().slice(0, 80) || null,
    });
    const next = withCrops(layout, crops);
    await prisma.radarProperty.update({
      where: { id },
      data: {
        layoutJson: next as object,
        crop: property.crop || cropName.slice(0, 80),
      },
    });
    return NextResponse.json({ ok: true, crops, crop: crops[crops.length - 1] });
  }

  if (action === 'crop_remove') {
    const cropId = String(body.cropId || '').trim();
    if (!cropId) return NextResponse.json({ error: 'cropId obrigatório.' }, { status: 400 });
    const layout = parseRadarLayout(property.layoutJson) || emptyRadarLayout();
    const crops = cropsFromLayout(layout).filter((c) => c.id !== cropId);
    const next = withCrops(layout, crops);
    await prisma.radarProperty.update({
      where: { id },
      data: { layoutJson: next as object },
    });
    return NextResponse.json({ ok: true, crops });
  }

  if (action === 'parcel') {
    const name = String(body.name || '').trim();
    if (name.length < 2) return NextResponse.json({ error: 'Nome da parcela obrigatório.' }, { status: 400 });
    const moduleId = normalizeModuleId(property.moduleId) || normalizeModuleId(body.moduleId) || 'agriculture';
    const kind = RADAR_SPACE_KINDS[moduleId].unitKind;
    const crop = String(body.crop || '').trim().slice(0, 80) || null;
    const areaHa = body.areaHa == null || body.areaHa === '' ? null : Number(body.areaHa);
    const unit = await prisma.nexusOpsUnit.create({
      data: {
        companyId,
        propertyId: id,
        sectorId: moduleId,
        kind,
        name: name.slice(0, 120),
        crop,
        areaHa: Number.isFinite(areaHa as number) && (areaHa as number) > 0 ? (areaHa as number) : null,
      },
    });

    // Ensure crop catalog entry exists when crop assigned
    const layout = parseRadarLayout(property.layoutJson) || emptyRadarLayout();
    let crops = cropsFromLayout(layout);
    if (crop && !crops.some((c) => c.name.toLowerCase() === crop.toLowerCase())) {
      crops = [
        ...crops,
        {
          id: `crop_${Date.now().toString(36)}`,
          name: crop,
          variety: null,
          season: null,
        },
      ];
    }
    const units = await prisma.nexusOpsUnit.findMany({
      where: { propertyId: id, companyId, isActive: true },
      select: { id: true, kind: true },
    });
    const spaceIds = units.filter(isRadarParcel).map((u) => u.id);
    const merged = withCrops(mergeLayoutWithSpaces(layout, spaceIds, []), crops);
    await prisma.radarProperty.update({
      where: { id },
      data: { layoutJson: merged as object, crop: property.crop || crop },
    });

    return NextResponse.json({
      ok: true,
      unit: {
        id: unit.id,
        name: unit.name,
        kind: unit.kind,
        crop: unit.crop,
        areaHa: unit.areaHa,
      },
      crops,
      layout: merged,
    });
  }

  if (action === 'parcel_update') {
    const unitId = String(body.unitId || '').trim();
    if (!unitId) return NextResponse.json({ error: 'unitId obrigatório.' }, { status: 400 });
    const unit = await prisma.nexusOpsUnit.findFirst({
      where: { id: unitId, propertyId: id, companyId, isActive: true },
    });
    if (!unit) return NextResponse.json({ error: 'Parcela inválida.' }, { status: 404 });
    const data: { name?: string; crop?: string | null; areaHa?: number | null } = {};
    if (body.name != null) {
      const n = String(body.name).trim();
      if (n.length >= 2) data.name = n.slice(0, 120);
    }
    if (body.crop !== undefined) {
      data.crop = String(body.crop || '').trim().slice(0, 80) || null;
    }
    if (body.areaHa !== undefined) {
      const areaHa = body.areaHa == null || body.areaHa === '' ? null : Number(body.areaHa);
      data.areaHa = Number.isFinite(areaHa as number) && (areaHa as number) > 0 ? (areaHa as number) : null;
    }
    const updated = await prisma.nexusOpsUnit.update({ where: { id: unitId }, data });
    return NextResponse.json({
      ok: true,
      unit: {
        id: updated.id,
        name: updated.name,
        kind: updated.kind,
        crop: updated.crop,
        areaHa: updated.areaHa,
      },
    });
  }

  // generic rename
  const data: { name?: string } = {};
  if (body.name != null) {
    const name = String(body.name).trim();
    if (name.length >= 2) data.name = name.slice(0, 120);
  }
  if (Object.keys(data).length) {
    await prisma.radarProperty.update({ where: { id }, data });
  }
  return NextResponse.json({ ok: true });
}
