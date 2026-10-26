export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  buildTaskContextLine,
  notifyTaskAction,
  wantsWorkEmail,
} from '@/lib/work/task-notify';
import {
  replaceTaskRolePeople,
  responsibleIdsFromTask,
  reviewerIdsFromTask,
} from '@/lib/work/task-people';

const ACTIONS = ['review', 'delivery', 'handoff'] as const;
type SendAction = (typeof ACTIONS)[number];

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '') as SendAction;
    const recipientId = String(body.recipientId || '');
    const note = body.note ? String(body.note).trim() : null;

    if (!ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: 'action debe ser review, delivery o handoff' },
        { status: 400 },
      );
    }
    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId requerido' }, { status: 400 });
    }
    if (recipientId === tenant.userId) {
      return NextResponse.json({ error: 'Elige a otra persona' }, { status: 400 });
    }

    const task = await prisma.task.findFirst({
      where: { id: params.taskId, isActive: true, archivedAt: null },
      include: {
        project: { select: { companyId: true, name: true } },
        folder: { select: { name: true } },
        group: { select: { name: true } },
        people: { select: { userId: true, role: true, sortOrder: true } },
      },
    });
    if (!task) return NextResponse.json({ error: 'Tarea no encontrada' }, { status: 404 });

    const companyId = task.project?.companyId || task.companyId;
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'Sin acceso' }, { status: 403 });
    }

    const recipient = await prisma.user.findFirst({
      where: {
        id: recipientId,
        isActive: true,
        companyUsers: { some: { companyId } },
      },
      select: { id: true, name: true, email: true },
    });
    if (!recipient) return NextResponse.json({ error: 'Destinatario inválido' }, { status: 400 });

    const actor = await prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { name: true, email: true },
    });
    const actorName = actor?.name || actor?.email || 'Alguien';

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { workBoardJson: true },
    });
    const emailOn = wantsWorkEmail(company?.workBoardJson);

    let approval = null as Awaited<ReturnType<typeof prisma.taskApprovalRequest.create>> | null;

    if (action === 'review' || action === 'delivery') {
      const existing = await prisma.taskApprovalRequest.findFirst({
        where: { taskId: task.id, status: 'PENDING' },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'Ya hay una solicitud pendiente en esta tarea', approval: existing },
          { status: 409 },
        );
      }

      const actionTag = action === 'review' ? '[revisión]' : '[entrega]';
      approval = await prisma.taskApprovalRequest.create({
        data: {
          taskId: task.id,
          companyId,
          requesterId: tenant.userId,
          approverId: recipientId,
          note: note ? `${actionTag} ${note}` : actionTag,
          status: 'PENDING',
        },
      });

      if (task.status !== 'DONE' && task.status !== 'CANCELLED') {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'IN_REVIEW' },
        });
      }

      // Prefer recipient as supervisor when requesting review/delivery
      const currentReviewers = reviewerIdsFromTask(task);
      if (!currentReviewers.includes(recipientId)) {
        await replaceTaskRolePeople({
          taskId: task.id,
          role: 'REVIEWER',
          userIds: [...currentReviewers, recipientId],
          companyIds: tenant.companyIds,
        });
      }
    }

    if (action === 'handoff') {
      const currentResponsible = responsibleIdsFromTask(task);
      if (!currentResponsible.includes(recipientId)) {
        await replaceTaskRolePeople({
          taskId: task.id,
          role: 'RESPONSIBLE',
          userIds: [...currentResponsible, recipientId],
          companyIds: tenant.companyIds,
        });
      }
      await prisma.comment.create({
        data: {
          taskId: task.id,
          userId: tenant.userId,
          content: note
            ? `↪ Pasó la actividad a ${recipient.name || recipient.email}: ${note}`
            : `↪ Pasó la actividad a ${recipient.name || recipient.email}`,
        },
      });
    }

    const whereLine = buildTaskContextLine({
      taskTitle: task.title,
      folderName: task.folder?.name,
      groupName: task.group?.name,
      projectName: task.project?.name,
    });

    notifyTaskAction({
      recipientId,
      actorId: tenant.userId,
      actorName,
      action,
      taskTitle: task.title,
      where: whereLine,
      note,
      email: emailOn,
      link: '/hub/work',
    });

    return NextResponse.json({
      ok: true,
      action,
      approval,
      status: action === 'review' || action === 'delivery' ? 'IN_REVIEW' : task.status,
    });
  } catch (error: unknown) {
    console.error('Task send-action error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
