export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createNotification } from '@/lib/notify';

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const taskId = searchParams.get('taskId');
    const mine = searchParams.get('mine') === '1';
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {};
    if (taskId) {
      where.taskId = taskId;
    } else if (mine) {
      where.OR = [{ approverId: tenant.userId }, { requesterId: tenant.userId }];
      where.companyId = { in: tenant.companyIds };
    } else if (companyId && tenant.companyIds.includes(companyId)) {
      where.companyId = companyId;
    } else {
      where.companyId = { in: tenant.companyIds };
    }
    if (status) where.status = status;

    const approvals = await prisma.taskApprovalRequest.findMany({
      where,
      include: {
        task: { select: { id: true, title: true, status: true, priority: true } },
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return NextResponse.json({ approvals });
  } catch (error: unknown) {
    console.error('Task approvals list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const taskId = String(body.taskId || '');
    const approverId = String(body.approverId || '');
    const note = body.note ? String(body.note).trim() : null;
    if (!taskId || !approverId) {
      return NextResponse.json({ error: 'taskId y approverId requeridos' }, { status: 400 });
    }
    if (approverId === tenant.userId) {
      return NextResponse.json({ error: 'No puedes aprobar tu propia solicitud' }, { status: 400 });
    }

    const task = await prisma.task.findFirst({
      where: { id: taskId, isActive: true },
      include: { project: { select: { companyId: true } } },
    });
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });
    const companyId = task.project?.companyId || task.companyId;
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const approver = await prisma.user.findFirst({
      where: {
        id: approverId,
        isActive: true,
        companyUsers: { some: { companyId } },
      },
      select: { id: true, name: true },
    });
    if (!approver) return NextResponse.json({ error: 'Aprobador inválido' }, { status: 400 });

    const existing = await prisma.taskApprovalRequest.findFirst({
      where: { taskId, status: 'PENDING' },
    });
    if (existing) {
      return NextResponse.json({ error: 'Ya hay una aprobación pendiente', approval: existing }, { status: 409 });
    }

    const approval = await prisma.taskApprovalRequest.create({
      data: {
        taskId,
        companyId,
        requesterId: tenant.userId,
        approverId,
        note,
        status: 'PENDING',
      },
      include: {
        task: { select: { id: true, title: true } },
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    await createNotification({
      userId: approverId,
      type: 'task_approval_request',
      title: 'Aprobación de entrega solicitada',
      message: `${approval.requester.name} solicita aprobación de: ${approval.task.title}`,
      link: '/hub/carta',
    });

    return NextResponse.json({ approval });
  } catch (error: unknown) {
    console.error('Task approval create error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
