export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { isCompanyAdmin } from '@/lib/integrated-workspace';
import { ALL_SIEP_PERMISSIONS, type SiepPermissionKey } from '@/lib/siep/permissions';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const companyId = req.nextUrl.searchParams.get('companyId')?.trim() || '';
  const userId = req.nextUrl.searchParams.get('userId')?.trim() || '';
  if (!companyId || !userId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }
  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador.' }, { status: 403 });
  }

  const cu = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId, companyId } },
    select: { siepPermissions: true, role: true },
  });
  if (!cu) return NextResponse.json({ error: 'Membro não encontrado' }, { status: 404 });

  const raw = cu.siepPermissions;
  const permissions = Array.isArray(raw)
    ? raw.filter((k): k is SiepPermissionKey => ALL_SIEP_PERMISSIONS.includes(k as SiepPermissionKey))
    : [];

  return NextResponse.json({ permissions, role: cu.role });
}

export async function PUT(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = await req.json();
  const companyId = String(body.companyId || '').trim();
  const userId = String(body.userId || '').trim();
  const permissions = Array.isArray(body.permissions) ? body.permissions : [];

  if (!companyId || !userId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
  }
  if (!(await isCompanyAdmin(tenant.userId, companyId))) {
    return NextResponse.json({ error: 'Apenas administrador.' }, { status: 403 });
  }

  const cleaned = permissions.filter((k: string) =>
    ALL_SIEP_PERMISSIONS.includes(k as SiepPermissionKey),
  );

  await prisma.companyUser.update({
    where: { userId_companyId: { userId, companyId } },
    data: { siepPermissions: cleaned },
  });

  return NextResponse.json({ success: true, permissions: cleaned });
}
