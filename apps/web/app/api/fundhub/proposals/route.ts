export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { nextVersionNum, shouldSaveVersion } from '@/lib/opportunity/proposal-versions';
import {
  isProposalReviewStatus,
  parseReviewStatus,
  type ProposalReviewStatus,
} from '@/lib/opportunity/proposal-review';
import {
  isProposalStatus,
  parseProposalStatus,
  parseStatusMeta,
  proposalStatusToPipeline,
  type ProposalStatus,
} from '@/lib/opportunity/proposal-status';

type DraftPayload = {
  workspaceId?: string;
  fundId?: string;
  title?: string;
  editalLink?: string;
  editalSummary?: string;
  status?: ProposalStatus | 'archived' | 'won';
  statusNote?: string;
  statusChangedAt?: string;
  documentMarkdown?: string;
  chatMessages?: unknown[];
  intake?: unknown;
  coalition?: unknown;
  stage?: string;
  reviewStatus?: ProposalReviewStatus;
  sections?: Array<{ title: string; content?: string }>;
};

/** Propostas da empresa — lista + detalhe por workspaceId. */
export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const workspaceId = req.nextUrl.searchParams.get('workspaceId')?.trim();
  if (workspaceId) {
    const proposal = await prisma.proposal.findFirst({
      where: { companyId: ctx.companyId, workspaceId, deletedAt: null },
      include: {
        fund: { select: { id: true, name: true, institution: true, linkOficial: true, deadline: true } },
        sections: { orderBy: { order: 'asc' } },
      },
    });
    if (!proposal) return NextResponse.json({ error: 'Proposta não encontrada' }, { status: 404 });
    const draft =
      proposal.draftJson && typeof proposal.draftJson === 'object'
        ? (proposal.draftJson as Record<string, unknown>)
        : {};
    const statusMeta = parseStatusMeta(draft);
    return NextResponse.json({
      proposal: {
        workspaceId: proposal.workspaceId,
        fundId: proposal.fundId,
        title: proposal.title,
        status: parseProposalStatus(proposal.status),
        statusNote: statusMeta.statusNote ?? null,
        statusChangedAt: statusMeta.statusChangedAt ?? proposal.submittedAt?.toISOString() ?? null,
        editalLink: proposal.editalLink || proposal.fund.linkOficial || '',
        editalSummary: proposal.editalSummary || '',
        fundName: proposal.fund.name,
        fundInstitution: proposal.fund.institution,
        updatedAt: proposal.updatedAt.toISOString(),
        sections: proposal.sections.map((s) => ({
          id: s.id,
          title: s.title,
          content: s.content || '',
        })),
        draftJson: draft,
        documentMarkdown:
          typeof draft.documentMarkdown === 'string'
            ? draft.documentMarkdown
            : proposal.sections.map((s) => `## ${s.title}\n\n${s.content || ''}`).join('\n\n'),
        chatMessages: Array.isArray(draft.chatMessages) ? draft.chatMessages : [],
        intake: draft.intake ?? null,
        coalition: draft.coalition ?? null,
        stage: typeof draft.stage === 'string' ? draft.stage : 'write',
        reviewStatus: parseReviewStatus(draft.reviewStatus),
      },
    });
  }

  const rows = await prisma.proposal.findMany({
    where: { companyId: ctx.companyId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    include: {
      fund: { select: { name: true, institution: true, linkOficial: true } },
    },
  });

  return NextResponse.json({
    proposals: rows.map((p) => {
      const draft =
        p.draftJson && typeof p.draftJson === 'object'
          ? (p.draftJson as Record<string, unknown>)
          : {};
      const statusMeta = parseStatusMeta(draft);
      return {
        workspaceId: p.workspaceId,
        fundId: p.fundId,
        title: p.title,
        fundName: p.fund.name,
        fundInstitution: p.fund.institution,
        editalLink: p.editalLink || p.fund.linkOficial || '',
        editalSummary: p.editalSummary || '',
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
        status: parseProposalStatus(p.status),
        statusNote: statusMeta.statusNote ?? null,
        statusChangedAt: statusMeta.statusChangedAt ?? p.submittedAt?.toISOString() ?? null,
        reviewStatus: parseReviewStatus(draft.reviewStatus),
      };
    }),
  });
}

/** Criar / actualizar proposta (fonte de verdade no servidor). */
export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as DraftPayload;
  const workspaceId = String(body.workspaceId ?? '').trim();
  const fundId = String(body.fundId ?? '').trim();
  if (!workspaceId || !fundId) {
    return NextResponse.json({ error: 'workspaceId e fundId obrigatórios' }, { status: 400 });
  }

  const fund = await prisma.fund.findFirst({
    where: { id: fundId, companyId: ctx.companyId, isActive: true },
    select: { id: true, name: true },
  });
  if (!fund) return NextResponse.json({ error: 'Fundo não encontrado' }, { status: 404 });

  const existing = await prisma.proposal.findFirst({
    where: { companyId: ctx.companyId, workspaceId, deletedAt: null },
    select: { id: true, draftJson: true, status: true, title: true, editalLink: true, editalSummary: true },
  });

  const prevDraft =
    existing?.draftJson && typeof existing.draftJson === 'object'
      ? (existing.draftJson as Record<string, unknown>)
      : {};
  const prevReview = parseReviewStatus(prevDraft.reviewStatus);
  const prevStatus = parseProposalStatus(existing?.status);
  const prevMeta = parseStatusMeta(prevDraft);

  const status: ProposalStatus =
    body.status != null && (isProposalStatus(body.status) || body.status === 'archived' || body.status === 'won')
      ? parseProposalStatus(body.status)
      : prevStatus;

  const statusChanged = !existing || status !== prevStatus;
  const statusNote =
    typeof body.statusNote === 'string'
      ? body.statusNote.trim().slice(0, 500)
      : statusChanged
        ? undefined
        : prevMeta.statusNote;
  const statusChangedAt =
    typeof body.statusChangedAt === 'string' && body.statusChangedAt
      ? body.statusChangedAt
      : statusChanged
        ? new Date().toISOString()
        : prevMeta.statusChangedAt;

  // Title-only renames must not fall back to fund.name and wipe a custom title.
  const title = (
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim()
      : existing?.title || fund.name || 'Proposta'
  ).slice(0, 300);

  // Preserve draft blob on partial PUTs (e.g. rename-only from the list).
  const draftJson = {
    documentMarkdown:
      body.documentMarkdown !== undefined
        ? body.documentMarkdown
        : typeof prevDraft.documentMarkdown === 'string'
          ? prevDraft.documentMarkdown
          : '',
    chatMessages:
      body.chatMessages !== undefined
        ? body.chatMessages
        : Array.isArray(prevDraft.chatMessages)
          ? prevDraft.chatMessages
          : [],
    intake: body.intake !== undefined ? body.intake : (prevDraft.intake ?? null),
    coalition: body.coalition !== undefined ? body.coalition : (prevDraft.coalition ?? null),
    stage:
      body.stage !== undefined
        ? body.stage
        : typeof prevDraft.stage === 'string'
          ? prevDraft.stage
          : 'write',
    editalLink:
      body.editalLink !== undefined
        ? body.editalLink
        : typeof prevDraft.editalLink === 'string'
          ? prevDraft.editalLink
          : '',
    editalSummary:
      body.editalSummary !== undefined
        ? body.editalSummary
        : typeof prevDraft.editalSummary === 'string'
          ? prevDraft.editalSummary
          : '',
    reviewStatus: isProposalReviewStatus(body.reviewStatus) ? body.reviewStatus : prevReview,
    ...(statusNote ? { statusNote } : {}),
    ...(statusChangedAt ? { statusChangedAt } : {}),
  };

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  let proposalId: string;
  let previousMarkdown = '';
  if (existing) {
    previousMarkdown =
      typeof prevDraft.documentMarkdown === 'string' ? prevDraft.documentMarkdown : '';
    await prisma.proposal.update({
      where: { id: existing.id },
      data: {
        title,
        fundId: fund.id,
        editalLink:
          body.editalLink !== undefined
            ? body.editalLink?.slice(0, 800) || null
            : existing.editalLink,
        editalSummary:
          body.editalSummary !== undefined
            ? body.editalSummary?.slice(0, 8000) || null
            : existing.editalSummary,
        status,
        draftJson,
        submittedAt:
          status === 'submitted' || status === 'resubmitted'
            ? new Date()
            : undefined,
      },
    });
    proposalId = existing.id;
  } else {
    const created = await prisma.proposal.create({
      data: {
        companyId: ctx.companyId,
        fundId: fund.id,
        workspaceId,
        title,
        editalLink: body.editalLink?.slice(0, 800) || null,
        editalSummary: body.editalSummary?.slice(0, 8000) || null,
        status,
        draftJson,
        createdBy: user?.id,
        submittedAt:
          status === 'submitted' || status === 'resubmitted' ? new Date() : null,
      },
    });
    proposalId = created.id;
  }

  // Sync leve com Em curso — só quando o status mapeia para o pipeline do Fund.
  const pipeline = proposalStatusToPipeline(status);
  if (pipeline && statusChanged) {
    await prisma.fund
      .update({
        where: { id: fund.id },
        data: {
          pipelineStatus: pipeline,
          ...(pipeline === 'won' || pipeline === 'lost'
            ? { decisionOutcome: pipeline }
            : {}),
        },
      })
      .catch(() => {});
  }

  // Snapshot de versão quando o markdown muda de forma relevante
  const nextMd = String(body.documentMarkdown ?? '');
  if (nextMd.trim().length >= 40) {
    const latest = await prisma.proposalVersion.findFirst({
      where: { proposalId },
      orderBy: { versionNum: 'desc' },
      select: { content: true, versionNum: true },
    });
    if (
      shouldSaveVersion({
        previousContent: latest?.content ?? previousMarkdown,
        nextContent: nextMd,
      })
    ) {
      const nums = await prisma.proposalVersion.findMany({
        where: { proposalId },
        select: { versionNum: true },
      });
      await prisma.proposalVersion
        .create({
          data: {
            proposalId,
            versionNum: nextVersionNum(nums.map((n) => n.versionNum)),
            content: nextMd.slice(0, 200_000),
            createdBy: user?.id,
          },
        })
        .catch(() => {});
    }
  }

  if (Array.isArray(body.sections) && body.sections.length) {
    await prisma.proposalSection.deleteMany({ where: { proposalId } });
    await prisma.proposalSection.createMany({
      data: body.sections.slice(0, 40).map((s, i) => ({
        proposalId,
        title: String(s.title || `Secção ${i + 1}`).slice(0, 200),
        content: String(s.content || '').slice(0, 50_000),
        order: i,
      })),
    });
  }

  return NextResponse.json({
    ok: true,
    workspaceId,
    fundId: fund.id,
    status,
    updatedAt: new Date().toISOString(),
  });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const workspaceId =
    req.nextUrl.searchParams.get('workspaceId')?.trim() ||
    ((await req.json().catch(() => ({}))) as { workspaceId?: string }).workspaceId?.trim();
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId obrigatório' }, { status: 400 });
  }

  const proposal = await prisma.proposal.findFirst({
    where: { companyId: ctx.companyId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!proposal) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { deletedAt: new Date(), status: 'withdrawn' },
  });
  return NextResponse.json({ ok: true });
}
