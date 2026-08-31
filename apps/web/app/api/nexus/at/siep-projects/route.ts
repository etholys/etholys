export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

/**
 * Projetos SIEP para vincular ao serviço AT.
 * Aceita companyId único ou companyIds (vírgula) — ex.: contratante + operador.
 */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const single = String(req.nextUrl.searchParams.get('companyId') || '').trim();
  const multi = String(req.nextUrl.searchParams.get('companyIds') || '').trim();
  const q = String(req.nextUrl.searchParams.get('q') || '').trim();

  const requested = [
    ...new Set(
      [...(multi ? multi.split(',') : []), ...(single ? [single] : [])]
        .map((id) => id.trim())
        .filter(Boolean)
    ),
  ];

  if (requested.length === 0) {
    return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  }

  const projects = await prisma.project.findMany({
    where: {
      companyId: { in: requested },
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
    take: 60,
  });

  return NextResponse.json({ projects });
}
