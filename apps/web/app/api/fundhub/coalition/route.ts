export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { isLikelyDbId } from '@/lib/utils';
import { newCoalitionMember, readCoalition, writeCoalition } from '@/lib/fundhub/coalition-memory';

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

  const payload = await readCoalition(companyId);
  return NextResponse.json(payload);
}

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const companyId = resolveCompanyId(tenant, String(body.companyId ?? ''));
  if (!companyId) return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });

  const orgName = String(body.orgName ?? '').trim();
  const role = String(body.role ?? '').trim();
  if (!orgName || !role) {
    return NextResponse.json({ error: 'orgName e role são obrigatórios' }, { status: 400 });
  }

  const current = await readCoalition(companyId);
  const member = newCoalitionMember({
    orgName,
    role,
    country: String(body.country ?? '').trim() || undefined,
    contactEmail: String(body.contactEmail ?? '').trim() || undefined,
  });

  const payload = await writeCoalition(
    companyId,
    { members: [member, ...current.members] },
    `fundhub-coalition:${tenant.userId}`,
  );

  return NextResponse.json({ ok: true, ...payload });
}

export async function DELETE(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = resolveCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
  const memberId = req.nextUrl.searchParams.get('memberId')?.trim();
  if (!companyId || !memberId) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }

  const current = await readCoalition(companyId);
  const payload = await writeCoalition(
    companyId,
    { members: current.members.filter((m) => m.id !== memberId) },
    `fundhub-coalition-del:${tenant.userId}`,
  );

  return NextResponse.json({ ok: true, ...payload });
}
