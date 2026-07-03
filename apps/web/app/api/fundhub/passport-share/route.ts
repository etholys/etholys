export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isLikelyDbId } from '@/lib/utils';
import {
  enablePassportShare,
  getPassportShareMeta,
  revokePassportShare,
} from '@/lib/fundhub/passport-share';

function resolveCompanyId(tenant: { companyIds: string[] }, requested: string | null): string | null {
  const c = requested?.trim();
  if (c && isLikelyDbId(c) && tenant.companyIds.includes(c)) return c;
  return tenant.companyIds[0] || null;
}

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = resolveCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
  if (!companyId) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });

  const meta = await getPassportShareMeta(companyId);
  return NextResponse.json({
    enabled: meta?.enabled === true,
    token: meta?.enabled ? meta.token : null,
    createdAt: meta?.createdAt ?? null,
  });
}

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // empty body ok
  }

  const companyId = resolveCompanyId(tenant, String(body.companyId ?? ''));
  if (!companyId) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });

  const meta = await enablePassportShare(companyId, tenant.userId);
  return NextResponse.json({ ok: true, token: meta.token, enabled: true, createdAt: meta.createdAt });
}

export async function DELETE(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = resolveCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
  if (!companyId) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });

  await revokePassportShare(companyId, tenant.userId);
  return NextResponse.json({ ok: true, enabled: false });
}
