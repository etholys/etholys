export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const task = await prisma.task.findUnique({
      where: { id: params.id },
      include: {
        assignee: true, creator: true,
        project: { include: { company: true } },
        checklist: { orderBy: { order: 'asc' } },
        comments: { include: { user: true }, orderBy: { createdAt: 'desc' } },
        subtasks: { include: { assignee: true }, orderBy: { order: 'asc' } },
        timeEntries: { include: { user: true }, orderBy: { date: 'desc' } },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!task) return NextResponse.json({ error: 'No encontrada' }, { status: 404 });
    // Tenant check via project company
    if (task.project && !tenant.companyIds.includes(task.project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    return NextResponse.json({ task });
  } catch (error: any) {
    console.error('Task detail error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const body = await req.json();
    if (body.status === 'DONE' && !body.completedAt) body.completedAt = new Date();
    const task = await prisma.task.update({ where: { id: params.id }, data: body });
    return NextResponse.json({ task });
  } catch (error: any) {
    console.error('Update task error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    await prisma.task.update({ where: { id: params.id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete task error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
