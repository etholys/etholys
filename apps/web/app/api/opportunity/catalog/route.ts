export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { isAggregatorFundingUrl, sanitizeFundingLinks } from '@/lib/opportunity/official-url';
import {
  isPipelineStatus,
  pipelineFilterMatch,
  pipelineOf,
  writeFundHubMeta,
  type PipelineStatus,
} from '@/lib/opportunity/pipeline';

/** Oportunidades validadas (catálogo da empresa). */
export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const search = req.nextUrl.searchParams.get('search')?.trim();
  const status = req.nextUrl.searchParams.get('status')?.trim();
  const type = req.nextUrl.searchParams.get('type')?.trim();
  const pipeline = req.nextUrl.searchParams.get('pipeline')?.trim() || 'all';
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
  const limit = Math.min(50, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || '20', 10)));

  const where: Record<string, unknown> = {
    companyId: ctx.companyId,
    isActive: true,
  };
  if (status) where.status = status;
  if (type) where.type = type;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { institution: { contains: search, mode: 'insensitive' } },
    ];
  }

  const skip = (page - 1) * limit;
  const raw = await prisma.fund.findMany({
    where,
    orderBy: [{ deadline: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }],
    include: {
      userStatus: {
        where: { userId: ctx.userId },
        select: { status: true },
      },
    },
  });

  const pipelineFilter =
    pipeline === 'decide' || pipeline === 'prepare' || pipeline === 'submitted' || pipeline === 'closed'
      ? pipeline
      : 'all';

  const mapped = raw
    .map((f) => ({
      ...f,
      pipelineStatus: pipelineOf(f.notes),
      userStatus: f.userStatus[0] ?? null,
    }))
    .filter((f) => pipelineFilterMatch(f.pipelineStatus, pipelineFilter));

  const total = mapped.length;
  const funds = mapped.slice(skip, skip + limit);

  return NextResponse.json({
    funds,
    pagination: {
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      current: page,
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

  const fund = await prisma.fund.create({
    data: {
      companyId,
      name: data.name.slice(0, 300),
      institution: data.institution.slice(0, 200),
      linkOficial,
      type: data.type?.slice(0, 80) || 'Grant',
      status: 'open',
      notes: writeFundHubMeta(data.notes?.slice(0, 500) ?? 'Importado manualmente pelo utilizador', {
        pipelineStatus: 'decide',
      }),
      sourceOfInformation: 'known_by_user',
      lastReviewedAt: new Date(),
    },
  });
  return fund.id;
}

export async function PATCH(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { fundId?: string; pipelineStatus?: PipelineStatus };
  const fundId = String(body.fundId ?? '').trim();
  if (!fundId || !isPipelineStatus(body.pipelineStatus)) {
    return NextResponse.json({ error: 'fundId e pipelineStatus obrigatórios' }, { status: 400 });
  }

  const fund = await prisma.fund.findFirst({
    where: { id: fundId, companyId: ctx.companyId, isActive: true },
    select: { id: true, notes: true },
  });
  if (!fund) return NextResponse.json({ error: 'Fundo não encontrado' }, { status: 404 });

  const notes = writeFundHubMeta(fund.notes, { pipelineStatus: body.pipelineStatus });
  await prisma.fund.update({
    where: { id: fund.id },
    data: { notes, lastReviewedAt: new Date() },
  });

  return NextResponse.json({ ok: true, fundId: fund.id, pipelineStatus: body.pipelineStatus });
}
