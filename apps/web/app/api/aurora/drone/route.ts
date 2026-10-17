export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { commitDrone, presignDrone } from '@/lib/aurora-territory-db';

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
    fileName: String(body.fileName || 'drone.jpg'),
    contentType: String(body.contentType || 'image/jpeg'),
  };
  try {
    if (body.action === 'commit') {
      const result = await commitDrone({
        ...common,
        userId: tenant.userId,
        cloudStoragePath: String(body.cloudStoragePath || ''),
      });
      if (result.error) return NextResponse.json({ error: 'Não foi possível guardar a imagem.' }, { status: 400 });
      return NextResponse.json({ ok: true, id: result.id });
    }
    const result = await presignDrone(common);
    if (result.error) return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 403 });
    return NextResponse.json({ ok: true, uploadUrl: result.uploadUrl, cloudStoragePath: result.cloudStoragePath });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload indisponível.' }, { status: 503 });
  }
}
