export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { importPropertyPolygon, savePropertyTerritory } from '@/lib/aurora-territory-db';

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }
  const common = {
    tenantCompanyIds: tenant.companyIds,
    attendedCompanyId: String(body.companyId || '').trim(),
    engagementId: String(body.engagementId || '').trim(),
    propertyId: String(body.propertyId || '').trim(),
  };
  if (body.fileBase64 && body.fileName) {
    const raw = String(body.fileBase64);
    const bytes = Buffer.from(raw.includes(',') ? raw.split(',')[1] || '' : raw, 'base64');
    if (!bytes.length || bytes.length > 8_000_000) {
      return NextResponse.json({ error: 'Ficheiro vazio ou grande demais.' }, { status: 400 });
    }
    const result = await importPropertyPolygon({
      ...common,
      fileName: String(body.fileName),
      bytes: new Uint8Array(bytes),
    });
    if (result.error === 'forbidden') return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 403 });
    if (result.error === 'polygon') return NextResponse.json({ error: 'Não encontrei um polígono nesse ficheiro.' }, { status: 400 });
    return NextResponse.json({ ok: true, points: result.points });
  }
  const result = await savePropertyTerritory({ ...common, compliance: body.compliance, polygon: body.polygon });
  if (result.error) return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 403 });
  return NextResponse.json({ ok: true, eligibility: result.eligibility });
}
