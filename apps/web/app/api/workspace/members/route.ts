export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';

/** Membros da empresa (para o admin atribuir acesso ao centro integrado). */
export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || '';
  if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida' }, { status: 400 });
  }

  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador.' }, { status: 403 });
  }

  const rows = await prisma.companyUser.findMany({
    where: { companyId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { user: { name: 'asc' } },
  });

  return NextResponse.json({
    members: rows.map((r) => ({
      userId: r.userId,
      email: r.user.email,
      name: r.user.name,
      role: r.role,
    })),
  });
}
