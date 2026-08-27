export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { emptyContextSetup, type CompanyContextSetup } from '@/lib/company-context-setup';
import { normalizeEconomicSectorId, parseCompanySectorId } from '@/lib/nexus-economic-sectors';

/**
 * Diretório de empresas-cliente para AT.
 * O operador pode pesquisar qualquer empresa ativa e criar fichas novas
 * sem as meter no seletor “minha empresa” (sem CompanyUser).
 */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const q = String(req.nextUrl.searchParams.get('q') || '').trim();
  const take = Math.min(40, Math.max(5, Number(req.nextUrl.searchParams.get('take') || 25) || 25));

  const companies = await prisma.company.findMany({
    where: {
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { shortName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: { id: true, name: true, shortName: true, contextSetupJson: true },
    orderBy: { name: 'asc' },
    take,
  });

  return NextResponse.json({
    companies: companies.map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      sectorId: parseCompanySectorId(c.contextSetupJson),
    })),
  });
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

  const name = String(body.name || '').trim().slice(0, 200);
  if (name.length < 2) {
    return NextResponse.json({ error: 'Nome da empresa inválido.' }, { status: 400 });
  }

  const shortRaw = String(body.shortName || '').trim().slice(0, 40);
  const shortName =
    shortRaw ||
    name
      .split(/\s+/)
      .slice(0, 3)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('')
      .slice(0, 12) ||
    name.slice(0, 12);

  const sectorRaw = body.sectorId ? String(body.sectorId).trim() : '';
  const sectorId = sectorRaw ? normalizeEconomicSectorId(sectorRaw) : null;
  if (sectorRaw && !sectorId) {
    return NextResponse.json({ error: 'Setor económico inválido.' }, { status: 400 });
  }

  const context: CompanyContextSetup = sectorId
    ? { ...emptyContextSetup(), sectorId }
    : emptyContextSetup();

  const company = await prisma.company.create({
    data: {
      name,
      shortName,
      description: body.description ? String(body.description).trim().slice(0, 2000) : null,
      color: '#6366F1',
      contextSetupJson: sectorId ? context : undefined,
    },
    select: { id: true, name: true, shortName: true, contextSetupJson: true },
  });

  return NextResponse.json(
    {
      ok: true,
      company: {
        id: company.id,
        name: company.name,
        shortName: company.shortName,
        sectorId: parseCompanySectorId(company.contextSetupJson),
      },
    },
    { status: 201 }
  );
}
