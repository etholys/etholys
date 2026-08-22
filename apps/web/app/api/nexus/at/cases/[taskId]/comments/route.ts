export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { createNotification } from '@/lib/notify';
import { resolveTaskCommentMentions } from '@/lib/work/mentions';
import { loadAtCaseForTenant, userIsOperator, clientCompanyIds } from '@/lib/nexus-at';

type Ctx = { params: Promise<{ taskId: string }> };

async function assertAtCommentAccess(taskId: string, tenant: { userId: string; companyIds: string[] }) {
  const loaded = await loadAtCaseForTenant(taskId, tenant.companyIds);
  if (!loaded) return null;
  const isOp = userIsOperator(loaded.engagement, tenant.companyIds);
  const clients = clientCompanyIds(loaded.engagement);
  const taskCompany = loaded.task.companyId || '';
  if (!isOp) {
    if (!taskCompany || !tenant.companyIds.includes(taskCompany) || !clients.includes(taskCompany)) {
      return null;
    }
  }
  return loaded;
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskId } = await ctx.params;
  const loaded = await assertAtCommentAccess(taskId, tenant);
  if (!loaded) return NextResponse.json({ error: 'Caso AT não encontrado.' }, { status: 404 });

  const comments = await prisma.comment.findMany({
    where: { taskId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  return NextResponse.json({ comments, engagementId: loaded.engagement.id });
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { taskId } = await ctx.params;
  const loaded = await assertAtCommentAccess(taskId, tenant);
  if (!loaded) return NextResponse.json({ error: 'Caso AT não encontrado.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const text = String(body.content || body.body || '').trim();
  if (text.length < 1) {
    return NextResponse.json({ error: 'Comentário vazio.' }, { status: 400 });
  }

  const { mentionIds } = await resolveTaskCommentMentions(text, tenant.companyIds, tenant.userId);

  const comment = await prisma.comment.create({
    data: {
      taskId,
      userId: tenant.userId,
      content: text.slice(0, 8000),
      mentions: mentionIds.length ? mentionIds.join(',') : null,
    },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const authorName = comment.user?.name || 'Alguém';
  const link = `/hub/nexus/at/${loaded.engagement.id}`;
  await Promise.all(
    mentionIds.map((userId) =>
      createNotification({
        userId,
        type: 'task_mention',
        title: 'Menção em caso AT',
        message: `${authorName} mencionou-te em: ${loaded.task.title}`,
        link,
      })
    )
  );

  await prisma.nexusAtEngagement.update({
    where: { id: loaded.engagement.id },
    data: { updatedAt: new Date() },
  });

  return NextResponse.json({ ok: true, comment }, { status: 201 });
}
