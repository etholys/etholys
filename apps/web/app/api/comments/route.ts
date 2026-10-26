export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { resolveTaskCommentMentions } from '@/lib/work/mentions';
import {
  buildTaskContextLine,
  compactTitle,
  notifyTaskWatchers,
  taskRoleUserIds,
  wantsWorkEmail,
  wantsWorkNotify,
} from '@/lib/work/task-notify';

async function assertTaskAccess(taskId: string, companyIds: string[]) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, isActive: true },
    include: {
      project: { select: { companyId: true, name: true } },
      folder: { select: { name: true } },
      group: { select: { name: true } },
    },
  });
  if (!task) return null;
  const companyId = task.project?.companyId || task.companyId;
  if (!companyId || !companyIds.includes(companyId)) return null;
  return { ...task, resolvedCompanyId: companyId };
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const taskId = new URL(req.url).searchParams.get('taskId');
    if (!taskId) return NextResponse.json({ error: 'taskId requerido' }, { status: 400 });

    const access = await assertTaskAccess(taskId, tenant.companyIds);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const comments = await prisma.comment.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json({ comments });
  } catch (error: unknown) {
    console.error('Comment list error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { taskId, content } = await req.json();
    if (!taskId || !String(content || '').trim()) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const access = await assertTaskAccess(taskId, tenant.companyIds);
    if (!access) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const text = String(content).trim();
    const { mentionIds } = await resolveTaskCommentMentions(text, tenant.companyIds, tenant.userId);

    const comment = await prisma.comment.create({
      data: {
        taskId,
        userId: tenant.userId,
        content: text,
        mentions: mentionIds.length ? mentionIds.join(',') : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const link = `/hub/work`;
    const authorName = comment.user?.name || 'Alguien';
    const company = access.resolvedCompanyId
      ? await prisma.company.findUnique({
          where: { id: access.resolvedCompanyId },
          select: { workBoardJson: true },
        })
      : null;
    const emailOn = wantsWorkEmail(company?.workBoardJson);
    const whereLine = buildTaskContextLine({
      taskTitle: access.title,
      folderName: access.folder?.name,
      groupName: access.group?.name,
      projectName: access.project?.name,
    });
    const when = comment.createdAt || new Date();
    notifyTaskWatchers({
      actorId: tenant.userId,
      type: 'task_update',
      title: 'Nuevo comentario',
      message: `${authorName}: ${text.slice(0, 140)}`,
      userIds: taskRoleUserIds(access),
      enabled: wantsWorkNotify(company?.workBoardJson, 'comment'),
      email: emailOn,
      link,
      mail: {
        subjectPhrase: 'Nuevo comentario',
        headline: 'Nuevo comentario',
        where: whereLine,
        what: 'Añadió un comentario',
        who: authorName,
        when,
        link,
        detail: text.slice(0, 2000),
      },
    });
    notifyTaskWatchers({
      actorId: tenant.userId,
      type: 'task_mention',
      title: 'Te mencionaron',
      message: `${authorName} te mencionó en: ${compactTitle(access.title)}`,
      userIds: mentionIds,
      enabled: true,
      email: emailOn,
      link,
      mail: {
        subjectPhrase: 'Te mencionaron',
        headline: 'Te mencionaron',
        where: whereLine,
        what: 'Te mencionó en un comentario',
        who: authorName,
        when,
        link,
        detail: text.slice(0, 2000),
      },
    });

    return NextResponse.json({ comment });
  } catch (error: unknown) {
    console.error('Comment error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
