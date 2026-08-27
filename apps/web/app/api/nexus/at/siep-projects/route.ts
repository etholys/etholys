export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

/**
 * Projetos SIEP de uma empresa (contratante) para vincular ao serviço AT.
 * Operadores precisam ver projetos da incubadora/instituição mesmo sem membership.
 */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const companyId = String(req.nextUrl.searchParams.get('companyId') || '').trim();
  const q = String(req.nextUrl.searchParams.get('q') || '').trim();
  if (!companyId) {
    return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  }

  const projects = await prisma.project.findMany({
    where: {
      companyId,
      isActive: true,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { code: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      code: true,
      status: true,
      companyId: true,
      company: { select: { id: true, shortName: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 40,
  });

  return NextResponse.json({ projects });
}
