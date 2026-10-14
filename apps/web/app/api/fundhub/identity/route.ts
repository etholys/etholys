export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { loadCompanyIdentity } from '@/lib/fundhub/load-company-identity';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

function textOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const identity = await loadCompanyIdentity(ctx.companyId);
  if (!identity) return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
  return NextResponse.json(identity);
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });

  const description = textOrNull(body.description);
  const mission = textOrNull(body.mission);
  const vision = textOrNull(body.vision);
  if (description === undefined && mission === undefined && vision === undefined) {
    return NextResponse.json({ error: 'Nada para guardar' }, { status: 400 });
  }

  await prisma.company.update({
    where: { id: ctx.companyId },
    data: {
      ...(description !== undefined ? { description } : {}),
      ...(mission !== undefined ? { mission } : {}),
      ...(vision !== undefined ? { vision } : {}),
    },
  });

  const identity = await loadCompanyIdentity(ctx.companyId);
  return NextResponse.json(identity);
}
