export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

async function findProposal(companyId: string, workspaceId: string) {
  return prisma.proposal.findFirst({
    where: { companyId, workspaceId, deletedAt: null },
    select: { id: true },
  });
}

/** Lista comentários de revisão da proposta. */
export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId obrigatório' }, { status: 400 });
  }

  const proposal = await findProposal(ctx.companyId, workspaceId);
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });

  const comments = await prisma.proposalComment.findMany({
    where: { proposalId: proposal.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      creator: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      content: c.content,
      sectionId: c.sectionId,
      createdAt: c.createdAt.toISOString(),
      author: c.creator.name || c.creator.email || '—',
      authorId: c.createdBy,
    })),
  });
}

/** Novo comentário de revisão. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as {
    workspaceId?: string;
    content?: string;
    sectionId?: string | null;
  };
  const workspaceId = String(body.workspaceId ?? '').trim();
  const content = String(body.content ?? '').trim();
  if (!workspaceId || !content) {
    return NextResponse.json({ error: 'workspaceId e content obrigatórios' }, { status: 400 });
  }

  const proposal = await findProposal(ctx.companyId, workspaceId);
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true, email: true },
  });
  if (!user) return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 401 });

  const created = await prisma.proposalComment.create({
    data: {
      proposalId: proposal.id,
      content: content.slice(0, 4000),
      sectionId: body.sectionId ? String(body.sectionId).slice(0, 80) : null,
      createdBy: user.id,
    },
  });

  return NextResponse.json({
    comment: {
      id: created.id,
      content: created.content,
      sectionId: created.sectionId,
      createdAt: created.createdAt.toISOString(),
      author: user.name || user.email || '—',
      authorId: user.id,
    },
  });
}
