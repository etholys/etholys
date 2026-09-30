export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { isAggregatorFundingUrl, sanitizeFundingLinks } from '@/lib/opportunity/official-url';
import { syncWindowOpenNotifications } from '@/lib/opportunity/deadline-alerts';
import {
  drawerFilterMatch,
  fundColumnDataFromMeta,
  hydrateFundFromNotes,
  isFundDrawer,
  isPipelineStatus,
  parseFundHubMeta,
  pipelineFilterMatch,
  writeFundHubMeta,
  type DonorFiche,
  type FundDecisionOutcome,
  type FundHubMeta,
  type PipelineStatus,
} from '@/lib/opportunity/pipeline';
import { parseFundTasks, type FundTask } from '@/lib/opportunity/fund-tasks';

/** Oportunidades validadas (catálogo da empresa) — filtros pesados em SQL quando possível. */
export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const search = req.nextUrl.searchParams.get('search')?.trim();
  const status = req.nextUrl.searchParams.get('status')?.trim();
  const type = req.nextUrl.searchParams.get('type')?.trim();
  const pipeline = req.nextUrl.searchParams.get('pipeline')?.trim() || 'all';
  const drawerRaw = req.nextUrl.searchParams.get('drawer')?.trim() || 'all';
  const institution = req.nextUrl.searchParams.get('institution')?.trim();
  const exportAll = req.nextUrl.searchParams.get('export') === '1';
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const limit = exportAll
    ? 200
    : Math.min(100, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '20', 10)));

  const where: Record<string, unknown> = {
    companyId: ctx.companyId,
    isActive: true,
  };
  if (status) where.status = status;
  if (type) where.type = type;
  if (institution) where.institution = institution;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { institution: { contains: search, mode: 'insensitive' } },
    ];
  }

  const pipelineFilter =
    pipeline === 'decide' || pipeline === 'prepare' || pipeline === 'submitted' || pipeline === 'closed'
      ? pipeline
      : 'all';
  const drawer = isFundDrawer(drawerRaw) ? drawerRaw : 'all';

  // Filtros SQL nas colunas R0 (legado em notes continua a passar pelo hydrate+filter).
  if (pipelineFilter === 'decide' || pipelineFilter === 'prepare' || pipelineFilter === 'submitted') {
    where.pipelineStatus = pipelineFilter;
  } else if (pipelineFilter === 'closed') {
    where.pipelineStatus = { in: ['won', 'lost'] };
  }
  if (drawer === 'watch') {
    where.watchOpen = true;
  } else if (drawer === 'work') {
    where.deadline = { not: null };
    where.pipelineStatus = { notIn: ['won', 'lost'] };
  } else if (drawer === 'repo') {
    where.deadline = null;
  }

  const skip = (page - 1) * limit;

  const [rawPage, totalCount, facetRows] = await Promise.all([
    prisma.fund.findMany({
      where,
      orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
      skip: exportAll ? 0 : skip,
      take: exportAll ? 200 : limit,
      include: {
        userStatus: {
          where: { userId: ctx.userId },
          select: { status: true },
        },
      },
    }),
    prisma.fund.count({ where }),
    prisma.fund.findMany({
      where: { companyId: ctx.companyId, isActive: true },
      select: { institution: true, type: true },
      take: 800,
    }),
  ]);

  // Segurança: se notes legado divergir das colunas, re-filtra levemente.
  const mapped = rawPage
    .map((f) => ({
      ...hydrateFundFromNotes(f),
      amountRequested: (f as { amountRequested?: number | null }).amountRequested ?? null,
      userStatus: f.userStatus[0] ?? null,
    }))
    .filter((f) => pipelineFilterMatch(f.pipelineStatus, pipelineFilter))
    .filter((f) => drawerFilterMatch(f, drawer));

  const institutions = [...new Set(facetRows.map((f) => f.institution).filter(Boolean))]
    .sort()
    .slice(0, 60);
  const types = [...new Set(facetRows.map((f) => f.type).filter(Boolean))].sort().slice(0, 20);

  return NextResponse.json({
    funds: mapped,
    institutions,
    types,
    pagination: {
      total: totalCount,
      pages: Math.max(1, Math.ceil(totalCount / limit)),
      current: exportAll ? 1 : page,
      pageSize: limit,
    },
  });
}

/** Registar fundo que o utilizador já conhece (importação manual). */
export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    institution?: string;
    linkOficial?: string;
    type?: string;
    notes?: string;
    bulk?: string;
  };

  const created: string[] = [];

  if (body.bulk?.trim()) {
    for (const line of body.bulk.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split('|').map((s) => s.trim());
      const name = parts[0];
      const institution = parts[1] || parts[0];
      const linkOficial = parts[2] || undefined;
      if (!name) continue;
      const id = await createKnownFund(ctx.companyId, {
        name,
        institution,
        linkOficial,
        type: body.type,
        notes: body.notes,
      });
      created.push(id);
    }
  } else {
    const name = body.name?.trim();
    const institution = body.institution?.trim();
    if (!name || !institution) {
      return NextResponse.json({ error: 'name e institution são obrigatórios' }, { status: 400 });
    }
    const rawLink = body.linkOficial?.trim();
    if (rawLink && isAggregatorFundingUrl(rawLink)) {
      return NextResponse.json(
        { error: 'URL rejeitada — use o site oficial do financiador, não agregadores (ex.: grantbite.com).' },
        { status: 400 },
      );
    }
    const id = await createKnownFund(ctx.companyId, {
      name,
      institution,
      linkOficial: body.linkOficial?.trim(),
      type: body.type,
      notes: body.notes,
    });
    created.push(id);
  }

  if (created.length === 0) {
    return NextResponse.json({ error: 'Nenhum fundo válido para importar' }, { status: 400 });
  }

  return NextResponse.json({ companyId: ctx.companyId, fundIds: created, count: created.length });
}

async function createKnownFund(
  companyId: string,
  data: { name: string; institution: string; linkOficial?: string; type?: string; notes?: string },
): Promise<string> {
  const links = sanitizeFundingLinks(data.linkOficial, undefined);
  const linkOficial = links.linkOficial ?? null;

  const existing = await prisma.fund.findFirst({
    where: { companyId, name: data.name, institution: data.institution, isActive: true },
    select: { id: true },
  });
  if (existing) {
    await prisma.fund.update({
      where: { id: existing.id },
      data: {
        linkOficial: linkOficial ?? undefined,
        lastReviewedAt: new Date(),
      },
    });
    return existing.id;
  }

  const notes = writeFundHubMeta(data.notes?.slice(0, 500) ?? 'Importado manualmente pelo utilizador', {
    pipelineStatus: 'decide',
    watchOpen: true,
    origin: { scanFocus: 'known', savedAt: new Date().toISOString() },
  });
  const cols = fundColumnDataFromMeta(parseFundHubMeta(notes));
  const fund = await prisma.fund.create({
    data: {
      companyId,
      name: data.name.slice(0, 300),
      institution: data.institution.slice(0, 200),
      linkOficial,
      type: data.type?.slice(0, 80) || 'Grant',
      status: 'open',
      notes,
      pipelineStatus: cols.pipelineStatus,
      ownerUserId: cols.ownerUserId,
      watchOpen: cols.watchOpen,
      fundHubMetaJson: cols.fundHubMetaJson,
      sourceOfInformation: 'known_by_user',
      lastReviewedAt: new Date(),
    },
  });
  return fund.id;
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as {
    fundId?: string;
    pipelineStatus?: PipelineStatus;
    watchOpen?: boolean;
    ownerUserId?: string | null;
    donor?: DonorFiche;
    amountRequested?: number | null;
    decisionOutcome?: FundDecisionOutcome;
    decisionNote?: string | null;
    tasks?: FundTask[];
    seedDefaultTasks?: boolean;
    /** R2 — actualiza disponibilidade (p.ex. closed → open) para o relógio. */
    status?: string;
  };
  const fundId = String(body.fundId ?? '').trim();
  if (!fundId) {
    return NextResponse.json({ error: 'fundId obrigatório' }, { status: 400 });
  }
  if (body.pipelineStatus != null && !isPipelineStatus(body.pipelineStatus)) {
    return NextResponse.json({ error: 'pipelineStatus inválido' }, { status: 400 });
  }

  const fund = await prisma.fund.findFirst({
    where: { id: fundId, companyId: ctx.companyId, isActive: true },
    select: {
      id: true,
      notes: true,
      status: true,
      name: true,
      institution: true,
      deadline: true,
      fundHubMetaJson: true,
      watchOpen: true,
    },
  });
  if (!fund) return NextResponse.json({ error: 'Fundo não encontrado' }, { status: 404 });

  const nextStatus =
    typeof body.status === 'string' && body.status.trim()
      ? body.status.trim().slice(0, 40)
      : fund.status;

  const metaPatch: FundHubMeta = {
    ...(body.pipelineStatus ? { pipelineStatus: body.pipelineStatus } : {}),
    ...(typeof body.watchOpen === 'boolean' ? { watchOpen: body.watchOpen } : {}),
    ...(body.ownerUserId !== undefined ? { ownerUserId: body.ownerUserId || undefined } : {}),
    ...(body.donor ? { donor: body.donor } : {}),
    ...(body.decisionOutcome
      ? { decisionOutcome: body.decisionOutcome }
      : body.pipelineStatus === 'won' || body.pipelineStatus === 'lost'
        ? { decisionOutcome: body.pipelineStatus }
        : {}),
    ...(body.decisionNote !== undefined
      ? { decisionNote: body.decisionNote || undefined }
      : {}),
    ...(nextStatus !== fund.status ? { lastSeenStatus: fund.status } : {}),
  };

  if (Array.isArray(body.tasks)) {
    metaPatch.tasks = parseFundTasks(body.tasks);
  } else if (body.seedDefaultTasks) {
    const { defaultMilestones } = await import('@/lib/opportunity/fund-tasks');
    const current = hydrateFundFromNotes(fund);
    if (!current.tasks?.length) {
      metaPatch.tasks = defaultMilestones('es', fund.deadline?.toISOString() ?? null);
    }
  }

  const notes = writeFundHubMeta(fund.notes, metaPatch);
  const meta = parseFundHubMeta(notes);
  const cols = fundColumnDataFromMeta(meta);
  await prisma.fund.update({
    where: { id: fund.id },
    data: {
      notes,
      pipelineStatus: cols.pipelineStatus,
      ownerUserId: cols.ownerUserId,
      watchOpen: cols.watchOpen,
      fundHubMetaJson: cols.fundHubMetaJson,
      ...(nextStatus !== fund.status ? { status: nextStatus } : {}),
      ...(typeof body.amountRequested === 'number' || body.amountRequested === null
        ? { amountRequested: body.amountRequested }
        : {}),
      ...(meta.decisionOutcome ? { decisionOutcome: meta.decisionOutcome } : {}),
      ...(body.decisionNote !== undefined ? { decisionNote: body.decisionNote } : {}),
      lastReviewedAt: new Date(),
    },
  });

  const watchOn = Boolean(meta.watchOpen);
  if (watchOn) {
    void syncWindowOpenNotifications(
      ctx.companyId,
      ctx.userId,
      [
        {
          id: fund.id,
          name: fund.name,
          institution: fund.institution,
          status: nextStatus,
          notes,
          watchOpen: true,
          fundHubMetaJson: cols.fundHubMetaJson,
        },
      ],
      {
        watchJustEnabledIds:
          body.watchOpen === true && fund.status === 'open' && nextStatus === 'open'
            ? [fund.id]
            : undefined,
      },
    );
  }

  let successFee: { allowed: boolean; accrued?: boolean; amountCents?: number; blockedReason?: string | null } | undefined;
  let siepHint: { canHandoff: boolean } | undefined;

  if (body.pipelineStatus === 'won') {
    const company = await prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: { entityType: true, description: true },
    });
    const { successFeeAllowed, successFeeBlockReason } = await import(
      '@/lib/fundhub/success-fee-policy'
    );
    const allowed = successFeeAllowed(company?.entityType, company?.description);
    successFee = {
      allowed,
      blockedReason: allowed ? null : successFeeBlockReason(company?.entityType, company?.description),
    };
    if (allowed) {
      await prisma.proposal.updateMany({
        where: {
          companyId: ctx.companyId,
          fundId: fund.id,
          deletedAt: null,
          status: { in: ['draft', 'submitted'] },
        },
        data: { status: 'won', submittedAt: new Date() },
      });
      const { scanFundhubSuccessFees } = await import('@/lib/billing/commissions');
      const fee = await scanFundhubSuccessFees(ctx.companyId);
      successFee.accrued = fee.created > 0;
    }
    siepHint = { canHandoff: true };
  }

  return NextResponse.json({
    ok: true,
    fundId: fund.id,
    pipelineStatus: meta.pipelineStatus ?? 'decide',
    watchOpen: Boolean(meta.watchOpen),
    status: nextStatus,
    ownerUserId: meta.ownerUserId ?? null,
    donor: meta.donor ?? null,
    tasks: meta.tasks ?? [],
    decisionOutcome: meta.decisionOutcome ?? 'pending',
    decisionNote: meta.decisionNote ?? null,
    amountRequested:
      typeof body.amountRequested === 'number' || body.amountRequested === null
        ? body.amountRequested
        : undefined,
    successFee,
    siepHint,
    siepProjectId: meta.siepProjectId ?? null,
  });
}
