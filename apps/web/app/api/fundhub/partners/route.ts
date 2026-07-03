export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { isLikelyDbId } from '@/lib/utils';

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

  const partners = await prisma.fundhubPartner.findMany({
    where: { companyId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ partners });
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

  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

  const partner = await prisma.fundhubPartner.create({
    data: {
      companyId,
      name: name.slice(0, 200),
      country: String(body.country ?? '').trim().slice(0, 80) || null,
      role: String(body.role ?? '').trim().slice(0, 300) || null,
      website: String(body.website ?? '').trim().slice(0, 500) || null,
      notes: String(body.notes ?? '').trim().slice(0, 2000) || null,
    },
  });

  return NextResponse.json({ partner });
}
