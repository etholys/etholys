export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { isRadarParcel } from '@/lib/radar/agriculture';
import {
  emptyRadarLayout,
  mergeLayoutWithSpaces,
  parseRadarLayout,
  sanitizeLayoutPatch,
} from '@/lib/radar/site-layout';

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
  const propertyId = String(url.searchParams.get('propertyId') || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  if (propertyId) {
    const property = await prisma.radarProperty.findFirst({
      where: { id: propertyId, companyId },
      include: {
        units: { where: { isActive: true }, select: { id: true, kind: true, name: true } },
      },
    });
    if (!property) return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 404 });
    const unitIds = property.units.map((u) => u.id);
    const sensors = await prisma.nexusSensor.findMany({
      where: { companyId, isActive: true, ...(unitIds.length ? { unitId: { in: unitIds } } : { id: '__none__' }) },
      select: { id: true, unitId: true, name: true },
      take: 40,
    });
    const spaceIds = property.units.filter(isRadarParcel).map((u) => u.id);
    const saved = parseRadarLayout(property.layoutJson) || emptyRadarLayout();
    const layout = mergeLayoutWithSpaces(
      saved,
      spaceIds,
      sensors.map((s) => ({ id: s.id, spaceId: s.unitId }))
    );
    return NextResponse.json({
      companyId,
      propertyId,
      layout,
      persisted: Boolean(property.layoutJson),
      updatedAt: property.updatedAt.toISOString(),
    });
  }

  const [units, sensors, row] = await Promise.all([
    prisma.nexusOpsUnit.findMany({
      where: { companyId, isActive: true },
      select: { id: true, kind: true, name: true },
      orderBy: { createdAt: 'asc' },
      take: 80,
    }),
    prisma.nexusSensor.findMany({
      where: { companyId, isActive: true },
      select: { id: true, unitId: true, name: true },
      take: 40,
    }),
    prisma.radarSiteLayout.findUnique({ where: { companyId } }),
  ]);

  const spaceIds = units.filter(isRadarParcel).map((u) => u.id);
  const sensorRefs = sensors.map((s) => ({ id: s.id, spaceId: s.unitId }));
  const saved = parseRadarLayout(row?.layoutJson) || emptyRadarLayout();
  const layout = mergeLayoutWithSpaces(saved, spaceIds, sensorRefs);

  return NextResponse.json({
    companyId,
    layout,
    persisted: Boolean(row),
    updatedAt: row?.updatedAt?.toISOString() || null,
  });
}

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const propertyId = String(body.propertyId || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  if (propertyId) {
    const property = await prisma.radarProperty.findFirst({
      where: { id: propertyId, companyId },
      include: { units: { where: { isActive: true }, select: { id: true, kind: true } } },
    });
    if (!property) return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 404 });
    const unitIds = property.units.map((u) => u.id);
    const sensors = await prisma.nexusSensor.findMany({
      where: { companyId, isActive: true, unitId: { in: unitIds } },
      select: { id: true },
      take: 40,
    });
    const allowedSpaces = new Set(property.units.filter(isRadarParcel).map((u) => u.id));
    const allowedSensors = new Set(sensors.map((s) => s.id));
    const patch = sanitizeLayoutPatch(body.layout ?? body, allowedSpaces, allowedSensors);
    if (!patch || patch.spaces.length === 0) {
      return NextResponse.json({ error: 'Layout inválido.' }, { status: 400 });
    }
    // Preserve crop catalog if client omitted it
    const existing = parseRadarLayout(property.layoutJson);
    if ((!patch.crops || patch.crops.length === 0) && existing?.crops?.length) {
      patch.crops = existing.crops;
    }
    const row = await prisma.radarProperty.update({
      where: { id: propertyId },
      data: { layoutJson: patch as object },
    });
    return NextResponse.json({
      ok: true,
      propertyId,
      layout: patch,
      updatedAt: row.updatedAt.toISOString(),
    });
  }

  const [units, sensors] = await Promise.all([
    prisma.nexusOpsUnit.findMany({
      where: { companyId, isActive: true },
      select: { id: true, kind: true },
      take: 80,
    }),
    prisma.nexusSensor.findMany({
      where: { companyId, isActive: true },
      select: { id: true },
      take: 40,
    }),
  ]);

  const allowedSpaces = new Set(units.filter(isRadarParcel).map((u) => u.id));
  const allowedSensors = new Set(sensors.map((s) => s.id));
  const patch = sanitizeLayoutPatch(body.layout ?? body, allowedSpaces, allowedSensors);
  if (!patch || patch.spaces.length === 0) {
    return NextResponse.json({ error: 'Layout inválido.' }, { status: 400 });
  }

  const row = await prisma.radarSiteLayout.upsert({
    where: { companyId },
    create: { companyId, layoutJson: patch as object },
    update: { layoutJson: patch as object },
  });

  return NextResponse.json({
    ok: true,
    layout: patch,
    updatedAt: row.updatedAt.toISOString(),
  });
}
