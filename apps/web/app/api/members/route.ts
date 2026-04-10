export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { projectId, userId, role, dedicationPct, monthlyCost } = body;
    if (!projectId || !userId) return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    const member = await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      update: {
        role: role || 'member',
        ...(dedicationPct !== undefined && { dedicationPct: parseFloat(dedicationPct) || 100 }),
        ...(monthlyCost !== undefined && { monthlyCost: monthlyCost ? parseFloat(monthlyCost) : null }),
      },
      create: {
        projectId, userId, role: role || 'member',
        dedicationPct: dedicationPct ? parseFloat(dedicationPct) : 100,
        monthlyCost: monthlyCost ? parseFloat(monthlyCost) : null,
      },
    });
    return NextResponse.json({ member });
  } catch (error: any) {
    console.error('Add member error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// PUT: Update member dedication %, cost, role
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    const { id, role, dedicationPct, monthlyCost } = body;
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    const data: any = {};
    if (role !== undefined) data.role = role;
    if (dedicationPct !== undefined) data.dedicationPct = parseFloat(dedicationPct) || 100;
    if (monthlyCost !== undefined) data.monthlyCost = monthlyCost ? parseFloat(monthlyCost) : null;
    const member = await prisma.projectMember.update({ where: { id }, data });
    return NextResponse.json({ member });
  } catch (error: any) {
    console.error('Update member error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
    await prisma.projectMember.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove member error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
