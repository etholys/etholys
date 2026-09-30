export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import {
  nextVersionNum,
  shouldSaveVersion,
  versionLabel,
} from '@/lib/opportunity/proposal-versions';

async function findProposal(companyId: string, workspaceId: string) {
  return prisma.proposal.findFirst({
    where: { companyId, workspaceId, deletedAt: null },
    select: { id: true, draftJson: true },
  });
}

/** Lista versões de uma proposta. */
export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const workspaceId = req.nextUrl.searchParams.get('workspaceId')?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId obrigatório' }, { status: 400 });
  }

  const proposal = await findProposal(ctx.companyId, workspaceId);
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });

  const versions = await prisma.proposalVersion.findMany({
    where: { proposalId: proposal.id },
    orderBy: { versionNum: 'desc' },
    take: 30,
    select: {
      id: true,
      versionNum: true,
      content: true,
      createdAt: true,
      createdBy: true,
    },
  });

  const locale = req.nextUrl.searchParams.get('locale') || 'es';
  return NextResponse.json({
    versions: versions.map((v) => ({
      id: v.id,
      versionNum: v.versionNum,
      label: versionLabel(v.versionNum, locale),
      content: v.content,
      createdAt: v.createdAt.toISOString(),
      createdBy: v.createdBy,
    })),
  });
}

/** Grava snapshot manual ou restaura (body.restoreVersionNum). */
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
    restoreVersionNum?: number;
    force?: boolean;
  };
  const workspaceId = String(body.workspaceId ?? '').trim();
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId obrigatório' }, { status: 400 });
  }

  const proposal = await findProposal(ctx.companyId, workspaceId);
  if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (typeof body.restoreVersionNum === 'number') {
    const ver = await prisma.proposalVersion.findFirst({
      where: { proposalId: proposal.id, versionNum: body.restoreVersionNum },
    });
    if (!ver) return NextResponse.json({ error: 'Versão não encontrada' }, { status: 404 });

    const draft =
      proposal.draftJson && typeof proposal.draftJson === 'object'
        ? { ...(proposal.draftJson as Record<string, unknown>) }
        : {};
    draft.documentMarkdown = ver.content;
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { draftJson: draft },
    });
    return NextResponse.json({
      ok: true,
      restored: true,
      versionNum: ver.versionNum,
      documentMarkdown: ver.content,
    });
  }

  const content = String(body.content ?? '').trim();
  if (!content) {
    return NextResponse.json({ error: 'content obrigatório' }, { status: 400 });
  }

  const latest = await prisma.proposalVersion.findFirst({
    where: { proposalId: proposal.id },
    orderBy: { versionNum: 'desc' },
    select: { content: true, versionNum: true },
  });

  if (
    !body.force &&
    !shouldSaveVersion({ previousContent: latest?.content, nextContent: content })
  ) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'unchanged',
      latestVersionNum: latest?.versionNum ?? 0,
    });
  }

  const nums = await prisma.proposalVersion.findMany({
    where: { proposalId: proposal.id },
    select: { versionNum: true },
  });
  const versionNum = nextVersionNum(nums.map((n) => n.versionNum));

  const created = await prisma.proposalVersion.create({
    data: {
      proposalId: proposal.id,
      versionNum,
      content: content.slice(0, 200_000),
      createdBy: user?.id,
    },
  });

  return NextResponse.json({
    ok: true,
    versionNum: created.versionNum,
    id: created.id,
    createdAt: created.createdAt.toISOString(),
  });
}
