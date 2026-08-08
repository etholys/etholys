export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = new URL(req.url).searchParams.get('companyId');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const groups = await prisma.taskGroup.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tasks: true } } },
    });
    return NextResponse.json({ groups });
  } catch (error: unknown) {
    console.error('Task groups list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const companyId = String(body.companyId || '');
    const name = String(body.name || '').trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

    const max = await prisma.taskGroup.aggregate({
      where: { companyId, isActive: true },
      _max: { order: true },
    });
    const group = await prisma.taskGroup.create({
      data: {
        companyId,
        name,
        color: body.color ? String(body.color) : null,
        order: (max._max.order ?? -1) + 1,
      },
    });
    return NextResponse.json({ group });
  } catch (error: unknown) {
    console.error('Task group create error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
