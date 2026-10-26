export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  buildTaskContextLine,
  notifyTaskWatchers,
  wantsWorkEmail,
} from '@/lib/work/task-notify';

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
        task: {
          select: {
            id: true,
            title: true,
            folder: { select: { name: true } },
            group: { select: { name: true } },
            project: { select: { name: true } },
          },
        },
        requester: { select: { id: true, name: true } },
        approver: { select: { id: true, name: true } },
        company: { select: { workBoardJson: true } },
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

    const approved = decision === 'APPROVED';
    const actorName = approval.approver.name || 'Alguien';
    const what = approved
      ? 'Aprobó la entrega'
      : `Rechazó la entrega${decisionNote ? `: ${decisionNote}` : ''}`;
    notifyTaskWatchers({
      actorId: tenant.userId,
      type: 'task_approval_decision',
      title: approved ? 'Entrega aprobada' : 'Entrega rechazada',
      message: `${actorName} ${approved ? 'aprobó' : 'rechazó'}: ${approval.task.title}`,
      userIds: [existing.requesterId],
      enabled: true,
      email: wantsWorkEmail(existing.company?.workBoardJson),
      link: '/hub/work',
      mail: {
        subjectPhrase: approved ? 'Entrega aprobada' : 'Entrega rechazada',
        headline: approved ? 'Entrega aprobada' : 'Entrega rechazada',
        where: buildTaskContextLine({
          taskTitle: existing.task.title,
          folderName: existing.task.folder?.name,
          groupName: existing.task.group?.name,
          projectName: existing.task.project?.name,
        }),
        what,
        who: actorName,
        when: new Date(),
        link: '/hub/work',
        detail: decisionNote,
      },
    });

    return NextResponse.json({ approval });
  } catch (error: unknown) {
    console.error('Task approval decide error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
