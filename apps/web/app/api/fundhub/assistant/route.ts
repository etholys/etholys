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
import { listScanProfiles } from '@/lib/opportunity/scan-profiles';
import { OPPORTUNITY_CLASSIFICATIONS } from '@/lib/opportunity/scan-types';
import type { OpportunityClassification } from '@/lib/opportunity/scan-types';
import { prisma } from '@/lib/prisma';

export type SuggestedShortcut = {
  name: string;
  orientationText: string;
  classifications: OpportunityClassification[];
};

function parseSuggestedShortcut(raw: string): {
  reply: string;
  suggestedShortcut: SuggestedShortcut | null;
} {
  const re = /<<<SHORTCUT>>>\s*([\s\S]*?)\s*<<<END>>>/i;
  const m = raw.match(re);
  if (!m) return { reply: raw.trim(), suggestedShortcut: null };
  const reply = raw.replace(re, '').trim();
  try {
    const parsed = JSON.parse(m[1].trim()) as {
      name?: string;
      orientationText?: string;
      classifications?: string[];
    };
    const name = String(parsed.name || '').trim().slice(0, 120);
    const orientationText = String(parsed.orientationText || '').trim().slice(0, 4000);
    if (!name || orientationText.length < 20) {
      return { reply, suggestedShortcut: null };
    }
    const classifications = (parsed.classifications ?? ['direct']).filter(
      (c): c is OpportunityClassification =>
        (OPPORTUNITY_CLASSIFICATIONS as readonly string[]).includes(c),
    );
    return {
      reply,
      suggestedShortcut: {
        name,
        orientationText,
        classifications: classifications.length ? classifications : ['direct'],
      },
    };
  } catch {
    return { reply, suggestedShortcut: null };
  }
}

/**
 * Assistente vivo FundHub — perfil, inbox, sócios, atalhos de busca, anexos.
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
    attachments?: Array<{ name?: string; textExcerpt?: string }>;
  };

  const ctx = await resolveOpportunityCompanyId(body.companyId ?? null);
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const message = body.message?.trim();
  if (!message) return NextResponse.json({ error: 'message obrigatório' }, { status: 400 });

  const locale = normalizeFundhubLocale(body.locale);
  const lang = fundhubLanguageName(locale);

  const [briefing, inbox, partners, fundsCount, company, shortcuts] = await Promise.all([
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
    listScanProfiles(ctx.companyId),
  ]);

  const profileGaps: string[] = [];
  if (!briefing.orgKind) profileGaps.push('orgKind');
  if (!briefing.legalCountries?.length) profileGaps.push('legalCountries');
  if (briefing.hasAuditLast5Years == null) profileGaps.push('audit');
  if (!briefing.revenueByYear?.length) profileGaps.push('revenue');
  if (briefing.yearsOperating == null) profileGaps.push('yearsOperating');

  const attachBlock = (Array.isArray(body.attachments) ? body.attachments : [])
    .filter((a) => a && (a.name || a.textExcerpt))
    .slice(0, 4)
    .map((a) => {
      const name = String(a.name || 'file').slice(0, 200);
      const excerpt = String(a.textExcerpt || '').trim().slice(0, 6000);
      return excerpt
        ? `--- Anexo: ${name} ---\n${excerpt}`
        : `--- Anexo: ${name} (sem texto extraído; só o nome) ---`;
    })
    .join('\n\n');

  const shortcutsBlock =
    shortcuts.length === 0
      ? 'Nenhum atalho de busca ainda.'
      : shortcuts
          .slice(0, 12)
          .map(
            (p) =>
              `- «${p.name}» [${(p.classifications || []).join(',') || 'direct'}]: ${(
                p.briefing.searchFeedback ||
                p.briefing.notes ||
                ''
              )
                .replace(/\s+/g, ' ')
                .slice(0, 180)}`,
          )
          .join('\n');

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
    `Atalhos de busca existentes:\n${shortcutsBlock}`,
  ].join('\n');

  const history = (body.history ?? [])
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');

  const system = `You are the FundHub capture assistant for Etholys.
Reply ALWAYS in ${lang} (Hub locale ${locale}).
Be concrete and operational: next actions, eligibility blockers, partners, profile gaps, when to search vs work the inbox.

## Search shortcuts (atalhos / atajos)
A shortcut is a named, reusable search brief used on Buscar (Discover). It has:
- name (short label, e.g. «PPD Costa Rica MiPymes»)
- orientationText: specific criteria the scout should follow (themes, geography, donor types, eligible org types, exclusions, languages, amount range, open-now vs reference programs)
- classifications: subset of direct | client_bridge | joint

Help the user design MORE SPECIFIC shortcuts when they ask (or when attachments describe a niche need). Compare with existing shortcuts and avoid duplicates.
When you have enough to create one, end your human reply with EXACTLY this machine block (no markdown fences around it):

<<<SHORTCUT>>>
{"name":"…","orientationText":"…","classifications":["direct"]}
<<<END>>>

Only emit <<<SHORTCUT>>> when you are proposing a concrete shortcut ready to save. Otherwise omit the block.
orientationText must be actionable for discovery (not vague). Prefer 3–8 crisp bullets or short paragraphs in ${lang}.

Never invent call deadlines, amounts, or eligibility. If data is missing, say what to complete.
Prefer short structured answers (bullets). Point to FundHub areas: Buscar, Perfil, Socios/CRM, En curso, Propuesta, Atalhos de busca.`;

  const userText = [
    `CONTEXT:\n${context}`,
    history ? `HISTORY:\n${history}` : '',
    attachBlock ? `ATTACHMENTS:\n${attachBlock}` : '',
    `USER:\n${message}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const text = await llmCompleteText(system, userText, {
    maxOutputTokens: 2500,
    temperature: 0.3,
  });

  const { reply, suggestedShortcut } = parseSuggestedShortcut(text);

  return NextResponse.json({
    reply,
    suggestedShortcut,
    meta: {
      pending: inbox.pending.length,
      partners: partners.length,
      profileGaps,
      shortcuts: shortcuts.length,
    },
  });
}
