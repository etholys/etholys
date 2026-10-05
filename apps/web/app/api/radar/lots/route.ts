export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import {
  buildCheckInPayload,
  canAdvanceStage,
  clampTraceCoord,
  generateLotCode,
  generatePublicToken,
  isTraceStage,
  nextStage,
  parseCheckInEvidence,
  sharePath,
  type TraceStage,
} from '@/lib/radar/trace';
import { decodeEvidenceImage, storeCheckInPhoto } from '@/lib/radar/evidence-upload';

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

function summarizeLot(lot: {
  id: string;
  code: string;
  publicToken: string;
  crop: string | null;
  qty: number | null;
  unitLabel: string | null;
  status: string;
  currentStage: string;
  unitId: string | null;
  createdAt: Date;
  unit?: { id: string; name: string } | null;
  events?: Array<{ id: string; stage: string; occurredAt: Date; payloadJson?: unknown }>;
}) {
  const stage = isTraceStage(lot.currentStage) ? lot.currentStage : 'harvest';
  const last = lot.events?.[lot.events.length - 1];
  const evidence = last ? parseCheckInEvidence(last.payloadJson) : null;
  return {
    id: lot.id,
    code: lot.code,
    crop: lot.crop,
    qty: lot.qty,
    unitLabel: lot.unitLabel || 'kg',
    status: lot.status,
    currentStage: stage,
    nextStage: nextStage(stage),
    unitId: lot.unitId,
    unitName: lot.unit?.name || null,
    createdAt: lot.createdAt.toISOString(),
    sharePath: sharePath(lot.publicToken),
    eventCount: lot.events?.length ?? 0,
    lastCheckIn: evidence
      ? {
          lat: evidence.lat,
          lng: evidence.lng,
          hasPhoto: Boolean(evidence.photoUrl),
          checkedInAt: evidence.checkedInAt,
        }
      : null,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const lots = await prisma.radarLot.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: {
      unit: { select: { id: true, name: true } },
      events: {
        select: { id: true, stage: true, occurredAt: true, payloadJson: true },
        orderBy: { occurredAt: 'asc' },
      },
    },
  });

  return NextResponse.json({
    companyId,
    lots: lots.map(summarizeLot),
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

  const action = String(body.action || '').trim();
  if (action === 'open_from_harvest') return openFromHarvest(companyId, engagementId, tenant.userId, body);
  if (action === 'advance' || action === 'checkin') return advanceLot(companyId, tenant.userId, body);
  return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 });
}

async function resolvePhoto(
  companyId: string,
  lotId: string,
  body: Record<string, unknown>
): Promise<{ photoUrl: string | null; photoKey: string | null; error?: string }> {
  if (typeof body.photoDataUrl === 'string' && body.photoDataUrl.trim()) {
    const decoded = decodeEvidenceImage(body.photoDataUrl);
    if (!decoded) return { photoUrl: null, photoKey: null, error: 'Foto inválida (JPEG/PNG/WebP, máx. 4MB).' };
    const stored = await storeCheckInPhoto({
      companyId,
      lotId,
      buffer: decoded.buffer,
      contentType: decoded.contentType,
    });
    return { photoUrl: stored.photoUrl, photoKey: stored.photoKey };
  }
  const photoUrl = typeof body.photoUrl === 'string' ? body.photoUrl.trim().slice(0, 500) : '';
  const photoKey = typeof body.photoKey === 'string' ? body.photoKey.trim().slice(0, 400) : '';
  if (photoUrl && photoUrl.startsWith('http')) return { photoUrl, photoKey: photoKey || null };
  return { photoUrl: null, photoKey: null };
}

async function openFromHarvest(
  companyId: string,
  engagementId: string | null,
  userId: string,
  body: Record<string, unknown>
) {
  const unitId = String(body.unitId || '').trim();
  if (!unitId) return NextResponse.json({ error: 'Espaço obrigatório.' }, { status: 400 });
  const unit = await prisma.nexusOpsUnit.findFirst({
    where: {
      id: unitId,
      companyId,
      isActive: true,
      kind: { in: ['parcel', 'lot', 'herd', 'generic'] },
    },
  });
  if (!unit) return NextResponse.json({ error: 'Espaço inválido.' }, { status: 400 });

  const coords = clampTraceCoord(body.lat, body.lng);
  if (!coords) {
    return NextResponse.json(
      { error: 'Check-in de colheita exige geolocalização (lat/lng).' },
      { status: 400 }
    );
  }

  // PHI só para parcelas de campo (agricultura)
  if (unit.kind === 'parcel') {
    const lastInput = await prisma.nexusFieldEntry.findFirst({
      where: { companyId, unitId, kind: 'input' },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true, payloadJson: true },
    });
    if (lastInput) {
      const phiDays = Number((lastInput.payloadJson as { phiDays?: unknown })?.phiDays);
      const wait = Number.isFinite(phiDays) && phiDays > 0 ? phiDays : 7;
      const elapsed = (Date.now() - lastInput.occurredAt.getTime()) / (24 * 60 * 60 * 1000);
      if (elapsed < wait) {
        return NextResponse.json(
          { error: `Carência ativa: faltam ${Math.ceil(wait - elapsed)} dia(s) antes de colher.` },
          { status: 409 }
        );
      }
    }
  }

  const qtyRaw = body.qty == null || body.qty === '' ? null : Number(body.qty);
  const qty = qtyRaw != null && Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : null;
  const crop = String(body.crop || unit.crop || '').trim().slice(0, 80) || null;
  const note = String(body.note || '').trim().slice(0, 2000);
  const unitLabel = String(body.unitLabel || 'kg').trim().slice(0, 12) || 'kg';
  const occurredAt = new Date();

  // Temporary lot id placeholder for photo path — create lot first without photo, then update if needed
  let code = generateLotCode(occurredAt);
  for (let i = 0; i < 4; i++) {
    const clash = await prisma.radarLot.findFirst({ where: { companyId, code }, select: { id: true } });
    if (!clash) break;
    code = generateLotCode(occurredAt);
  }

  const publicToken = generatePublicToken();
  const entry = await prisma.nexusFieldEntry.create({
    data: {
      companyId,
      unitId,
      kind: 'harvest',
      occurredAt,
      payloadJson: { note, qty, crop, unitLabel, source: 'radar_lot', lat: coords.lat, lng: coords.lng },
      authorUserId: userId,
      channel: 'app',
      engagementId,
    },
  });

  const lot = await prisma.radarLot.create({
    data: {
      companyId,
      code,
      publicToken,
      unitId,
      crop,
      qty,
      unitLabel,
      status: 'open',
      currentStage: 'harvest',
      harvestEntryId: entry.id,
    },
  });

  const photo = await resolvePhoto(companyId, lot.id, body);
  if (photo.error) {
    await prisma.radarLot.delete({ where: { id: lot.id } }).catch(() => undefined);
    return NextResponse.json({ error: photo.error }, { status: 400 });
  }

  const payload = buildCheckInPayload({
    note,
    lat: coords.lat,
    lng: coords.lng,
    photoUrl: photo.photoUrl,
    photoKey: photo.photoKey,
    checkedInAt: occurredAt,
    extra: { qty, crop, unitLabel, parcel: unit.name },
  });

  await prisma.radarLotEvent.create({
    data: {
      lotId: lot.id,
      stage: 'harvest',
      occurredAt,
      payloadJson: payload,
      channel: 'app',
      authorUserId: userId,
    },
  });

  const full = await prisma.radarLot.findFirst({
    where: { id: lot.id },
    include: {
      unit: { select: { id: true, name: true } },
      events: {
        select: { id: true, stage: true, occurredAt: true, payloadJson: true },
        orderBy: { occurredAt: 'asc' },
      },
    },
  });

  return NextResponse.json({ ok: true, lot: summarizeLot(full!) });
}

async function advanceLot(companyId: string, userId: string, body: Record<string, unknown>) {
  const lotId = String(body.lotId || '').trim();
  const stageRaw = String(body.stage || '').trim();
  if (!lotId || !isTraceStage(stageRaw)) {
    return NextResponse.json({ error: 'Lote e etapa obrigatórios.' }, { status: 400 });
  }
  const target = stageRaw as TraceStage;
  const lot = await prisma.radarLot.findFirst({ where: { id: lotId, companyId } });
  if (!lot) return NextResponse.json({ error: 'Lote inválido.' }, { status: 404 });
  if (lot.status === 'closed') {
    return NextResponse.json({ error: 'Lote já fechado.' }, { status: 409 });
  }
  const current = isTraceStage(lot.currentStage) ? lot.currentStage : 'harvest';
  if (!canAdvanceStage(current, target)) {
    return NextResponse.json(
      { error: `Etapa inválida. Seguinte permitida: ${nextStage(current) || 'nenhuma'}.` },
      { status: 400 }
    );
  }

  const coords = clampTraceCoord(body.lat, body.lng);
  if (!coords) {
    return NextResponse.json(
      { error: 'Check-in exige geolocalização (lat/lng) nesta etapa.' },
      { status: 400 }
    );
  }

  const photo = await resolvePhoto(companyId, lotId, body);
  if (photo.error) return NextResponse.json({ error: photo.error }, { status: 400 });

  const occurredAt = new Date();
  const payload = buildCheckInPayload({
    note: String(body.note || ''),
    destination: String(body.destination || ''),
    buyer: String(body.buyer || ''),
    carrier: String(body.carrier || ''),
    lat: coords.lat,
    lng: coords.lng,
    photoUrl: photo.photoUrl,
    photoKey: photo.photoKey,
    checkedInAt: occurredAt,
  });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.radarLotEvent.create({
      data: {
        lotId,
        stage: target,
        occurredAt,
        payloadJson: payload,
        channel: 'app',
        authorUserId: userId,
      },
    });
    return tx.radarLot.update({
      where: { id: lotId },
      data: {
        currentStage: target,
        status: target === 'sale' ? 'closed' : 'open',
      },
      include: {
        unit: { select: { id: true, name: true } },
        events: {
          select: { id: true, stage: true, occurredAt: true, payloadJson: true },
          orderBy: { occurredAt: 'asc' },
        },
      },
    });
  });

  return NextResponse.json({ ok: true, lot: summarizeLot(updated) });
}
