export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { createAuroraVisit, loadAuroraCampo } from '@/lib/aurora-campo';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim();
  const campo = await loadAuroraCampo({
    tenantCompanyIds: tenant.companyIds,
    attendedCompanyId: companyId,
    engagementId,
  });
  if (!campo) return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  return NextResponse.json({ ok: true, ...campo });
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
  const accuracy = Number(body.accuracyM);
  const result = await createAuroraVisit({
    tenantCompanyIds: tenant.companyIds,
    userId: tenant.userId,
    attendedCompanyId: String(body.companyId || '').trim(),
    engagementId: String(body.engagementId || '').trim(),
    propertyId: String(body.propertyId || '').trim() || null,
    objectiveId: String(body.objectiveId || '').trim() || null,
    activityLabel: String(body.activityLabel || ''),
    whatDone: String(body.whatDone || ''),
    lat: Number(body.lat),
    lng: Number(body.lng),
    accuracyM: Number.isFinite(accuracy) ? accuracy : null,
    photoData: typeof body.photoData === 'string' ? body.photoData : null,
    polygon: body.polygon,
  });
  if (result.error === 'forbidden') return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  if (result.error === 'geo') return NextResponse.json({ error: 'Falta a localização do técnico.' }, { status: 400 });
  if (result.error === 'activity') return NextResponse.json({ error: 'Diz o que foste fazer.' }, { status: 400 });
  if (result.error === 'photo') return NextResponse.json({ error: 'A foto tem de ser uma imagem pequena.' }, { status: 400 });
  if (result.error === 'property') return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 400 });
  if (result.error === 'objective') return NextResponse.json({ error: 'Indicador inválido.' }, { status: 400 });
  return NextResponse.json({ ok: true, visit: result.visit });
}
