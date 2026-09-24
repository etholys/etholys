export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany, isFieldEntryKind } from '@/lib/nexus-ops';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  const unitId = String(url.searchParams.get('unitId') || '').trim() || undefined;
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }
  const entries = await prisma.nexusFieldEntry.findMany({
    where: { companyId, ...(unitId ? { unitId } : {}) },
    orderBy: { occurredAt: 'desc' },
    take: 80,
    include: {
      unit: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });
  return NextResponse.json({ entries });
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
  const kind = String(body.kind || '').trim();
  if (!companyId || !isFieldEntryKind(kind)) {
    return NextResponse.json({ error: 'Empresa e tipo de entrada obrigatórios.' }, { status: 400 });
  }
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }

  const unitId = String(body.unitId || '').trim() || null;
  if (unitId) {
    const unit = await prisma.nexusOpsUnit.findFirst({ where: { id: unitId, companyId, isActive: true } });
    if (!unit) return NextResponse.json({ error: 'Unidade inválida.' }, { status: 400 });
  }

  const occurredAt = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: 'Data inválida.' }, { status: 400 });
  }

  const payload =
    body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
      ? (body.payload as Record<string, unknown>)
      : { note: String(body.note || body.text || '').trim() };

  const entry = await prisma.nexusFieldEntry.create({
    data: {
      companyId,
      unitId,
      kind,
      occurredAt,
      payloadJson: payload as object,
      authorUserId: tenant.userId,
      engagementId,
      taskId: String(body.taskId || '').trim() || null,
    },
    include: {
      unit: { select: { id: true, name: true } },
      author: { select: { id: true, name: true } },
    },
  });

  const metric = String(body.metric || '').trim();
  const value = Number(body.value);
  const readingUnit = String(body.unit || '').trim();
  if (metric && Number.isFinite(value)) {
    await prisma.nexusReading.create({
      data: {
        companyId,
        unitId,
        metric,
        value,
        unit: readingUnit || (metric === 'soil_moisture' ? '%' : metric === 'irrigation_mm' ? 'mm' : 'u'),
        source: 'manual',
        recordedAt: occurredAt,
      },
    });
  } else if (kind === 'irrigation' && Number.isFinite(Number((payload as { mm?: unknown }).mm))) {
    await prisma.nexusReading.create({
      data: {
        companyId,
        unitId,
        metric: 'irrigation_mm',
        value: Number((payload as { mm: unknown }).mm),
        unit: 'mm',
        source: 'manual',
        recordedAt: occurredAt,
      },
    });
  }

  return NextResponse.json({ ok: true, entry });
}
