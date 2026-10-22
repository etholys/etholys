export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { isFieldEntryKind } from '@/lib/nexus-ops-token';
import { cadernoKindsForModule, noteFromPayload } from '@/lib/radar/caderno';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

function propertyFilter(clientId: string | null) {
  if (!clientId || clientId === RADAR_SCOPE_OWN) return { clientId: null as string | null };
  if (clientId === 'all' || clientId === 'todos') return {};
  return { clientId };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const propertyId = String(url.searchParams.get('propertyId') || '').trim() || null;
  const unitId = String(url.searchParams.get('unitId') || '').trim() || null;
  const clientId = String(url.searchParams.get('clientId') || '').trim() || null;
  const take = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 60) || 60));

  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const properties = await prisma.radarProperty.findMany({
    where: { companyId, ...propertyFilter(clientId) },
    orderBy: { createdAt: 'desc' },
    take: 80,
    select: {
      id: true,
      name: true,
      moduleId: true,
      units: {
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
        select: { id: true, name: true, kind: true, crop: true, propertyId: true },
      },
    },
  });

  const selected =
    (propertyId && properties.find((p) => p.id === propertyId)) || properties[0] || null;
  const moduleId = selected?.moduleId || 'agriculture';
  const unitIds = selected ? selected.units.map((u) => u.id) : properties.flatMap((p) => p.units.map((u) => u.id));

  const whereEntry =
    unitId
      ? { companyId, unitId }
      : selected && unitIds.length > 0
        ? { companyId, OR: [{ unitId: { in: unitIds } }, { unitId: null }] }
        : selected
          ? { companyId, unitId: null }
          : { companyId };

  const entries = await prisma.nexusFieldEntry.findMany({
    where: whereEntry,
    orderBy: { occurredAt: 'desc' },
    take,
    include: {
      unit: { select: { id: true, name: true, propertyId: true } },
      author: { select: { id: true, name: true } },
    },
  });

  // When a property is selected, drop orphan null-unit rows from other contexts only if we have units.
  const filtered =
    selected && unitIds.length > 0
      ? entries.filter((e) => !e.unitId || unitIds.includes(e.unitId))
      : entries;

  return NextResponse.json({
    companyId,
    propertyId: selected?.id || null,
    moduleId,
    kinds: cadernoKindsForModule(moduleId),
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      moduleId: p.moduleId,
      units: p.units,
    })),
    units: selected?.units || [],
    entries: filtered.map((e) => ({
      id: e.id,
      kind: e.kind,
      occurredAt: e.occurredAt.toISOString(),
      channel: e.channel,
      note: noteFromPayload(e.payloadJson),
      payload: e.payloadJson,
      unitId: e.unitId,
      unitName: e.unit?.name || null,
      propertyId: e.unit?.propertyId || selected?.id || null,
      authorUserId: e.authorUserId,
      authorName: e.author?.name || null,
      createdAt: e.createdAt.toISOString(),
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
  const tenant = auth.tenant;
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const kind = String(body.kind || '').trim();
  if (!isFieldEntryKind(kind)) {
    return NextResponse.json({ error: 'Tipo de registo inválido.' }, { status: 400 });
  }

  const unitId = String(body.unitId || '').trim() || null;
  const propertyId = String(body.propertyId || '').trim() || null;

  if (unitId) {
    const unit = await prisma.nexusOpsUnit.findFirst({
      where: { id: unitId, companyId, isActive: true },
    });
    if (!unit) return NextResponse.json({ error: 'Espaço inválido.' }, { status: 400 });
    if (propertyId && unit.propertyId && unit.propertyId !== propertyId) {
      return NextResponse.json({ error: 'Espaço não pertence a esta operação.' }, { status: 400 });
    }
  } else if (propertyId) {
    const prop = await prisma.radarProperty.findFirst({ where: { id: propertyId, companyId } });
    if (!prop) return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 });
  }

  const occurredAt = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  }

  const note = String(body.note || body.text || '').trim().slice(0, 2000);
  const product = String(body.product || '').trim().slice(0, 120);
  const dose = String(body.dose || '').trim().slice(0, 80);
  const protocol = String(body.protocol || '').trim().slice(0, 160);
  const mm = body.mm == null || body.mm === '' ? null : Number(body.mm);
  const phiDays = body.phiDays == null || body.phiDays === '' ? null : Number(body.phiDays);

  if (!note && !product && !protocol && kind !== 'irrigation') {
    return NextResponse.json({ error: 'Escreve o que aconteceu ou escolhe um protocolo.' }, { status: 400 });
  }
  if (kind === 'input' && product.length < 2 && protocol.length < 2) {
    return NextResponse.json({ error: 'Insumo pede produto ou protocolo.' }, { status: 400 });
  }
  if (kind === 'irrigation' && !(Number.isFinite(mm as number) && (mm as number) > 0) && !note) {
    return NextResponse.json({ error: 'Irrigação pede milímetros ou uma nota.' }, { status: 400 });
  }

  const payload: Record<string, unknown> = {};
  if (note) payload.note = note;
  if (product) payload.product = product;
  if (dose) payload.dose = dose;
  if (protocol) payload.protocol = protocol;
  if (kind === 'irrigation' && mm != null && Number.isFinite(mm)) payload.mm = mm;
  if (kind === 'input' && Number.isFinite(phiDays as number) && (phiDays as number) > 0) {
    payload.phiDays = phiDays;
  }

  const entry = await prisma.nexusFieldEntry.create({
    data: {
      companyId,
      unitId,
      kind,
      occurredAt,
      payloadJson: payload as object,
      authorUserId: tenant.userId,
      channel: 'app',
      engagementId,
    },
    include: {
      unit: { select: { id: true, name: true, propertyId: true } },
      author: { select: { id: true, name: true } },
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

  return NextResponse.json({
    ok: true,
    entry: {
      id: entry.id,
      kind: entry.kind,
      occurredAt: entry.occurredAt.toISOString(),
      channel: entry.channel,
      note: noteFromPayload(entry.payloadJson),
      payload: entry.payloadJson,
      unitId: entry.unitId,
      unitName: entry.unit?.name || null,
      propertyId: entry.unit?.propertyId || propertyId,
      authorUserId: entry.authorUserId,
      authorName: entry.author?.name || null,
      createdAt: entry.createdAt.toISOString(),
    },
  });
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  let companyId = String(url.searchParams.get('companyId') || '').trim();
  let engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  let id = String(url.searchParams.get('id') || '').trim();

  if (!id || !companyId) {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      companyId = companyId || String(body.companyId || '').trim();
      engagementId = engagementId || String(body.engagementId || '').trim() || null;
      id = id || String(body.id || '').trim();
    } catch {
      /* query-only */
    }
  }

  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;
  if (!id) return NextResponse.json({ error: 'id obrigatório.' }, { status: 400 });

  const existing = await prisma.nexusFieldEntry.findFirst({ where: { id, companyId } });
  if (!existing) return NextResponse.json({ error: 'Registo não encontrado.' }, { status: 404 });

  await prisma.nexusFieldEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
