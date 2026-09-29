export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { llmCompleteText } from '@/lib/llm-client';
import {
  fundhubLanguageName,
  normalizeFundhubLocale,
} from '@/lib/agents/fundhub-proposal-prompt';
import { readOpportunityBriefing } from '@/lib/opportunity/briefing';
import { readCompanyScanInbox } from '@/lib/opportunity/candidate-store';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { prisma } from '@/lib/prisma';

/**
 * Assistente vivo FundHub — ajuda operacional (perfil, inbox, sócios, próximos passos).
 * POST /api/fundhub/assistant
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as {
    companyId?: string;
    message?: string;
    locale?: unknown;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  };

  const ctx = await resolveOpportunityCompanyId(body.companyId ?? null);
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: 'message obrigatório' }, { status: 400 });

  const locale = normalizeFundhubLocale(body.locale);
  const lang = fundhubLanguageName(locale);

  const [briefing, inbox, partners, fundsCount, company] = await Promise.all([
    readOpportunityBriefing(ctx.companyId),
    readCompanyScanInbox(ctx.companyId),
    prisma.fundhubPartner.findMany({
      where: { companyId: ctx.companyId, isActive: true },
      select: { name: true, country: true, role: true },
      take: 20,
    }),
    prisma.fund.count({ where: { companyId: ctx.companyId, isActive: true } }),
    prisma.company.findUnique({
      where: { id: ctx.companyId },
      select: { name: true, entityType: true },
    }),
  ]);

  const profileGaps: string[] = [];
  if (!briefing.orgKind) profileGaps.push('orgKind');
  if (!briefing.legalCountries?.length) profileGaps.push('legalCountries');
  if (briefing.hasAuditLast5Years == null) profileGaps.push('audit');
  if (!briefing.revenueByYear?.length) profileGaps.push('revenue');
  if (briefing.yearsOperating == null) profileGaps.push('yearsOperating');

  const context = [
    `Empresa: ${company?.name ?? ctx.companyId}`,
    `Tipo entityType: ${company?.entityType ?? '—'}`,
    `OrgKind: ${briefing.orgKind ?? '—'}`,
    `Temas: ${briefing.themes.join(', ') || '—'}`,
    `Países alvo: ${briefing.countries.join(', ') || '—'}`,
    `Registo jurídico: ${(briefing.legalCountries ?? []).join(', ') || '—'}`,
    `Auditoria 5 anos: ${briefing.hasAuditLast5Years == null ? '—' : briefing.hasAuditLast5Years ? 'sim' : 'não'}`,
    `Anos operação: ${briefing.yearsOperating ?? '—'} / maturidade: ${briefing.maturityLevel ?? '—'}`,
    `Faturamento anos: ${briefing.revenueByYear?.map((r) => `${r.year}:${r.amountUsd}`).join(', ') || '—'}`,
    `Lacunas de perfil: ${profileGaps.join(', ') || 'nenhuma crítica'}`,
    `Inbox por decidir: ${inbox.pending.length} (open ${inbox.pendingOpen.length}, ref ${inbox.pendingReference.length}); mais tarde: ${inbox.later.length}`,
    `Fundos em catálogo/em curso: ${fundsCount}`,
    `Sócios registados: ${partners.length ? partners.map((p) => `${p.name}${p.country ? ` (${p.country})` : ''}`).join('; ') : 'nenhum'}`,
    `Top inbox: ${inbox.pending
      .slice(0, 8)
      .map((c) => `${c.name} · ${c.institution} · ${c.availabilityStatus ?? '?'}`)
      .join(' | ') || 'vazio'}`,
  ].join('\n');

  const history = (body.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const system = `You are the FundHub capture assistant for Etholys.
Reply ALWAYS in ${lang} (Hub locale ${locale}).
Be concrete and operational: next actions, what is blocking eligibility, which partner might help, what to fill in the profile, when to run a search vs work the inbox.
Never invent call deadlines, amounts, or eligibility. If data is missing, say what to complete.
Prefer short structured answers (bullets). Point to FundHub areas: Buscar, Perfil/elegibilidad, Socios/CRM, En curso, Propuesta.`;

  const text = await llmCompleteText(
    system,
    `CONTEXT:\n${context}\n\n${history ? `HISTORY:\n${history}\n\n` : ''}USER:\n${message}`,
    { maxOutputTokens: 2048, temperature: 0.3 },
  );

  return NextResponse.json({
    reply: text,
    meta: {
      pending: inbox.pending.length,
      partners: partners.length,
      profileGaps,
    },
  });
}
