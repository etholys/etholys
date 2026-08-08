export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createNotification } from '@/lib/notify';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const decision = String(body.status || '').toUpperCase();
    if (decision !== 'APPROVED' && decision !== 'REJECTED') {
      return NextResponse.json({ error: 'status debe ser APPROVED o REJECTED' }, { status: 400 });
    }
    const decisionNote = body.decisionNote ? String(body.decisionNote).trim() : null;

    const existing = await prisma.taskApprovalRequest.findFirst({
      where: { id: params.id, companyId: { in: tenant.companyIds } },
      include: {
        task: { select: { id: true, title: true } },
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (existing.status !== 'PENDING') {
      return NextResponse.json({ error: 'Ya fue decidida' }, { status: 409 });
    }
    if (existing.approverId !== tenant.userId) {
      return NextResponse.json({ error: 'Solo el aprobador puede decidir' }, { status: 403 });
    }

    const approval = await prisma.taskApprovalRequest.update({
      where: { id: params.id },
      data: {
        status: decision,
        decisionNote,
        decidedAt: new Date(),
      },
      include: {
        task: { select: { id: true, title: true } },
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    if (decision === 'APPROVED') {
      await prisma.task.update({
        where: { id: existing.taskId },
        data: { status: 'DONE', completedAt: new Date() },
      });
    }

    await createNotification({
      userId: existing.requesterId,
      type: 'task_approval_decision',
      title: decision === 'APPROVED' ? 'Entrega aprobada' : 'Entrega rechazada',
      message: `${approval.approver.name} ${decision === 'APPROVED' ? 'aprobó' : 'rechazó'}: ${approval.task.title}`,
      link: '/hub/work',
    });

    return NextResponse.json({ approval });
  } catch (error: unknown) {
    console.error('Task approval decide error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
