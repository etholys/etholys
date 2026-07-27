export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAnvilAccess, canAccessProject } from '@/lib/lab-anvil/access';
import { runAnvilAgentTurn } from '@/lib/lab-anvil/run-agent';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const access = await requireAnvilAccess();
  if (!access?.hasAccess) {
    return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });
  }

  const { id: sessionId } = await ctx.params;
  const session = await prisma.labAnvilSession.findUnique({
    where: { id: sessionId },
    select: { id: true, projectId: true },
  });
  if (!session) {
    return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
  }
  if (!(await canAccessProject(access, session.projectId))) {
    return NextResponse.json({ error: 'Sem acesso' }, { status: 403 });
  }

  const body = await req.json();
  const content = String(body.content || body.message || '').trim();
  if (!content) {
    return NextResponse.json({ error: 'Mensagem vazia' }, { status: 400 });
  }

  try {
    const result = await runAnvilAgentTurn({
      sessionId,
      userMessage: content,
      userId: access.userId,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    console.error('ANVIL agent error:', e);
    const message = e instanceof Error ? e.message : 'Erro do agente';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
