import 'server-only';

import { randomUUID } from 'crypto';
import { llmCompleteJsonText, llmCompleteWithWebSearch } from '@/lib/llm-client';
import { sanitizeCandidateDates } from '@/lib/opportunity/availability';
import { normalizeCandidates } from '@/lib/opportunity/candidate-store';
import {
  applyBriefingDiversity,
  briefingRequestsIfad,
  buildDiscoverySearchQueries,
  isHomogeneousInstitutionSet,
} from '@/lib/opportunity/discovery-queries';
import { enrichAndFilterCandidates } from '@/lib/opportunity/enrich-call';
import { OFFICIAL_LINK_PROMPT_RULES } from '@/lib/opportunity/official-url';
import { dropDuplicateFunds, isOpenNowCandidate } from '@/lib/opportunity/scan-filters';
import type { OpportunityBriefing, ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

const TYPE_MAP: Record<string, string> = {
  grant: 'Grant',
  credit: 'Crédito',
  alliance: 'Aliança',
  local_expert: 'Técnico local',
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function briefingLines(b: OpportunityBriefing): string {
  const kinds = b.kinds.map((k) => TYPE_MAP[k] ?? k).join(', ');
  const classLabels: Record<string, string> = {
    direct: 'candidatura directa pela nossa organização',
    client_bridge: 'fundos para possíveis clientes (nós somos a ponte)',
    joint: 'apresentação em conjunto / consórcio',
  };
  const classes = (b.classifications ?? ['direct'])
    .map((c) => classLabels[c] ?? c)
    .join('; ');
  return [
    b.scanName ? `Nome da varredura: ${b.scanName}` : '',
    `Temas: ${b.themes.join(', ') || 'inferir'}`,
    `Países elegíveis desejados: ${b.countries.join(', ') || 'inferir'}`,
    `Tipos: ${kinds}`,
    b.amountMax != null ? `Montante máximo preferido: ${b.amountMax} USD` : '',
    b.amountMin != null ? `Montante mínimo: ${b.amountMin} USD` : '',
    b.privateEligible ? 'Elegibilidade: empresas privadas OK' : '',
    b.reimbursable === false ? 'Só financiamento NÃO reembolsável (grants). Sem empréstimos.' : '',
    `Classificações a etiquetar: ${classes}`,
    b.notes ? `Notas: ${b.notes}` : '',
    b.searchFeedback ? `ORIENTAÇÃO COMPLETA DO UTILIZADOR:\n${b.searchFeedback}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function isWebSearchEnabled(): boolean {
  const flag = process.env.OPPORTUNITY_WEB_SEARCH?.trim().toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.CLAUDE_API_KEY ||
      process.env.LLM_API_KEY,
  );
}

/** Regras partilhadas: descrições úteis para decisão, não marketing. */
const CANDIDATE_CONTENT_RULES = `CANDIDATE CONTENT (critical — decision support, not marketing):
Extract from OFFICIAL funder pages when possible. If uncertain, write clearly e.g. "Não confirmado na fonte oficial — verificar no link" — NEVER invent eligibility, amounts, or deadlines.

Each candidate MUST fill these fields (Portuguese preferred unless briefing is in another language):
- description: 2–4 SUBSTANTIVE paragraphs. Explain what the call/program funds, thematic/sector focus, geographic scope, and operational context. Dates/amounts/topic codes belong as supporting detail inside the narrative — never as a one-line blurb alone. Thin marketing slogans are forbidden.
- whoCanApply: who may apply (org types: private company, NGO, university, public body, consortium; nationality / establishment rules).
- eligibility: key eligibility criteria (size, co-funding %, prior experience, geography, sector exclusions).
- requirements: mandatory docs, consortium rules, language, match funding, reporting burdens if known.
- howToApply: portal/steps/next actions if known from the source; otherwise say to verify on the official page.
- risksCaveats: co-financing burden, short windows, restricted beneficiaries, or unknowns.
- Also: closesAt, opensAt, amount, currency, eligibleCountries, applicationWindow when known.
DATES: Never invent opensAt/closesAt/deadline. If the official page does not state a calendar date, leave null. NEVER use 1 January / 2026-01-01 as a placeholder. Prefer availabilityNote "prazo a confirmar na página oficial".`;

function promptsForFocus(scanFocus: ScanFocus) {
  const today = todayIso();

  if (scanFocus === 'open_now') {
    return {
      research: `You are an opportunity scout. Use web search to find funding calls that are ACCEPTING APPLICATIONS RIGHT NOW.

TODAY'S DATE: ${today}

CRITICAL RULES:
- ONLY include calls you found in live search results with a real official callUrl (the convocatoria page, not the agency homepage).
- If you cannot cite a live official call page, skip the item. Invented agencies (e.g. fake "ANDEDE") are forbidden.
- EXCLUDE: expired calls, closed windows, generic program homepages WITHOUT an active open call.
- For each item gather: closesAt, opensAt, eligibleCountries, classification (direct|client_bridge|joint), classificationNote, PLUS full operational content (what it funds, who can apply, eligibility, requirements, how to apply, risks).
- The BRIEFING (themes, countries, type, command) is the ONLY search query. Do not default to a favourite multilateral. Never return more than ONE result from the same institution.
- Search the REQUIRED official site: queries first. Cover every requested region when an official open grant exists.
- Prefer current call/edital/RFA pages on Horizon, LIFE, grants.gov, Finep, BNDES, IDB, CAF, GCF, GEF, USDA/NIFA and national ministries.
- Minimum 10 distinct official calls from at least 5 different institutions when possible.

${CANDIDATE_CONTENT_RULES}

${OFFICIAL_LINK_PROMPT_RULES}`,
      structure: `Convert the research into JSON only. Return { "candidates": [ ... ] }
Each item MUST include:
name, institution, type (Grant|Crédito|Aliança|Técnico local), category,
description (2–4 substantive paragraphs — see content rules),
whoCanApply, eligibility, requirements, howToApply, risksCaveats,
callUrl (official convocatoria / edital PAGE — required for open_now),
institutionUrl (funder homepage if different),
linkOficial (same as callUrl if only one official page),
documents (array of {title,url} official PDFs/docs you saw — omit if none),
amount, currency,
opensAt, closesAt, applicationWindow, eligibleCountries,
availabilityStatus ("open_now" or "rolling"),
availabilityNote, classification (direct|client_bridge|joint), classificationNote,
matchScore (0-100), matchJustification, sourceUrl (official only if present).

${CANDIDATE_CONTENT_RULES}
${OFFICIAL_LINK_PROMPT_RULES}
Respect ORIENTAÇÃO COMPLETA (amount caps, grant-only, private eligibility, countries).
Skip EXISTING duplicates.`,
    };
  }

  return {
    research: `You are a funding intelligence analyst. Map RELEVANT funding programs, frameworks, and institutions for long-term knowledge — regardless of whether a call is open today.

TODAY'S DATE: ${today}

Include:
- Permanent/rolling programs (even if no window open now)
- Seasonal programs (note typical windows: e.g. "Q1 annually")
- Major multilateral/bilateral frameworks the organization should track
- Programs that existed and may reopen

For each: name, institution, type, eligible countries, typical application windows, last known status, official URL, availabilityStatus (seasonal|rolling|closed|reference), when it typically opens — PLUS what it funds, who can apply, eligibility, requirements, how to apply, risks.

This feeds an intelligence base — accuracy over quantity. Minimum 8 programs.

${CANDIDATE_CONTENT_RULES}

${OFFICIAL_LINK_PROMPT_RULES}`,
    structure: `Convert the research into JSON only. Return { "candidates": [ ... ] }
Each item: name, institution, type, category,
description (2–4 substantive paragraphs),
whoCanApply, eligibility, requirements, howToApply, risksCaveats,
callUrl (official programme / convocatoria page), institutionUrl (homepage if different),
linkOficial (same as callUrl if only one page),
documents (official PDFs/docs actually seen),
amount, currency, opensAt, closesAt, applicationWindow, eligibleCountries,
availabilityStatus (seasonal|rolling|closed|reference — NOT open_now unless verified open),
availabilityNote (typical windows, last call date, reopening hints),
matchScore, matchJustification, sourceUrl (official only).

${CANDIDATE_CONTENT_RULES}
${OFFICIAL_LINK_PROMPT_RULES}
Do not invent URLs. Skip EXISTING duplicates. Omit linkOficial if only aggregator URL found.`,
  };
}

export type WebDiscoveryResult = {
  candidates: ScanCandidate[];
  discoveryMode: 'web' | 'knowledge';
  searchQueries: string[];
  fallbackReason?: string;
};

export async function discoverOpportunitiesOnline(opts: {
  briefing: OpportunityBriefing;
  learningContext: string;
  existingFunds: Array<{ name: string; institution: string }>;
  optionalExtraContext?: string;
  scanFocus?: ScanFocus;
  /** 0–100 phase updates during long web search. */
  onProgress?: (pct: number, phase: string) => void | Promise<void>;
}): Promise<WebDiscoveryResult> {
  const scanFocus = opts.scanFocus ?? 'open_now';
  const report = async (pct: number, phase: string) => {
    try {
      await opts.onProgress?.(pct, phase);
    } catch {
      /* ignore progress write failures */
    }
  };
  const existingBlock =
    opts.existingFunds.map((f) => `${f.name} (${f.institution})`).join('\n') || '(none)';

  if (!isWebSearchEnabled()) {
    await report(40, 'knowledge');
    const result = await knowledgeOnlyDiscovery(
      opts.briefing,
      opts.learningContext,
      existingBlock,
      scanFocus,
      opts.optionalExtraContext,
      opts.existingFunds,
    );
    await report(90, 'structuring');
    return { ...result, fallbackReason: 'web_search_disabled' };
  }

  const { research: RESEARCH_SYSTEM, structure: STRUCTURE_SYSTEM } = promptsForFocus(scanFocus);
  let webFailure: string | undefined;

  try {
    const focusHint =
      scanFocus === 'open_now'
        ? `\nMODE: OPEN NOW ONLY — reject anything without a verifiable active submission window as of ${todayIso()}.`
        : `\nMODE: REFERENCE INTELLIGENCE — map programs for future tracking, include seasonal and closed.`;

    const requiredQueries = buildDiscoverySearchQueries(opts.briefing);
    const ifadBan = briefingRequestsIfad(opts.briefing)
      ? ''
      : `\nFORBIDDEN AGENCY: do not return IFAD / FIDA / ifad.org calls. A leftover portal list is not a request for that agency. Search the briefing themes and countries instead.`;
    const userResearch = [
      `BRIEFING (this is the search query — obey it):\n${briefingLines(opts.briefing)}`,
      `\nLEARNING (skip-list only — do not copy catalog institutions as the theme):\n${opts.learningContext}`,
      `\nEXISTING (do not repeat — find OTHER official calls):\n${existingBlock}`,
      opts.optionalExtraContext?.trim()
        ? `\nOPTIONAL / CATALOGUE PORTALS:\n${opts.optionalExtraContext.trim()}`
        : '',
      focusHint,
      ifadBan,
      `\nREQUIRED OFFICIAL SEARCHES (run these site: queries; official portals only, never aggregators):\n${requiredQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
      `\n${OFFICIAL_LINK_PROMPT_RULES}`,
      `\nSearch official domains for callUrl; never put aggregator URLs in linkOficial.`,
    ].join('');

    await report(25, 'web_research');
    const preferOpus =
      briefingRequestsIfad(opts.briefing) ||
      Boolean(opts.briefing.searchFeedback?.trim()) ||
      Boolean(opts.briefing.scanName?.trim());
    const { text: research, searchQueries } = await llmCompleteWithWebSearch(
      RESEARCH_SYSTEM,
      userResearch,
      {
        model: preferOpus ? 'claude-opus-4-6' : 'claude-sonnet-4-6',
        maxOutputTokens: 16384,
        temperature: scanFocus === 'open_now' ? 0.15 : 0.25,
        timeoutMs: 180_000,
        webSearchMaxUses: 14,
      },
    );

    await report(65, 'structuring');
    const structureUser = [
      `RESEARCH REPORT:\n${research}`,
      `\nEXISTING (skip duplicates):\n${existingBlock}`,
      `\nBRIEFING:\n${briefingLines(opts.briefing)}`,
      focusHint,
    ].join('');

    const jsonText = await llmCompleteJsonText(STRUCTURE_SYSTEM, structureUser, {
      maxOutputTokens: 16384,
    });
    const parsed = JSON.parse(jsonText) as { candidates?: unknown[] };
    let candidates = normalizeCandidates(parsed.candidates ?? [], scanFocus).map((c) =>
      sanitizeCandidateDates({
        ...c,
        tempId: c.tempId || randomUUID(),
        scanFocus,
      }),
    );
    candidates = dropDuplicateFunds(candidates, opts.existingFunds);
    candidates = applyBriefingDiversity(candidates, opts.briefing);

    if (scanFocus === 'open_now') {
      const open = candidates.filter(isOpenNowCandidate);
      // Se o estruturador omitiu availabilityStatus, não deitar fora a pesquisa web.
      candidates = open.length > 0 ? open : candidates;
    }

    await report(78, 'verifying_official_pages');
    candidates = await enrichAndFilterCandidates(candidates, scanFocus);
    candidates = applyBriefingDiversity(
      candidates.map((c) => sanitizeCandidateDates(c)),
      opts.briefing,
    );

    const needSecondPass =
      scanFocus === 'open_now' &&
      (candidates.length < 6 || isHomogeneousInstitutionSet(candidates));

    if (needSecondPass) {
      await report(82, 'web_research_opus');
      const extra = await secondPassOpusDiscovery({
        briefing: opts.briefing,
        learningContext: opts.learningContext,
        existingBlock,
        existingFunds: [...opts.existingFunds, ...candidates],
        optionalExtraContext: opts.optionalExtraContext,
        alreadyFound: candidates,
        requiredQueries,
      });
      if (extra.length > 0) {
        const extraEnriched = (await enrichAndFilterCandidates(extra, scanFocus)).map((c) =>
          sanitizeCandidateDates(c),
        );
        candidates = applyBriefingDiversity(
          dropDuplicateFunds([...candidates, ...extraEnriched], opts.existingFunds),
          opts.briefing,
        );
      }
    }

    await report(88, 'filtering');
    if (candidates.length > 0) {
      return { candidates, discoveryMode: 'web', searchQueries };
    }
    console.warn('[opportunity/web-discovery] web search returned 0 verifiable candidates');
    if (scanFocus === 'open_now') {
      return {
        candidates: [],
        discoveryMode: 'web',
        searchQueries,
        fallbackReason: 'no_official_call_page',
      };
    }
  } catch (e) {
    console.warn('[opportunity/web-discovery] web search failed, fallback:', e);
    webFailure = e instanceof Error ? e.message.slice(0, 240) : String(e).slice(0, 240);
  }

  if (scanFocus === 'open_now') {
    await report(90, 'no_verified_calls');
    return {
      candidates: [],
      discoveryMode: 'web',
      searchQueries: [],
      fallbackReason: webFailure ? `web_failed:${webFailure}` : 'no_official_call_page',
    };
  }

  await report(50, 'knowledge_fallback');
  const fallback = await knowledgeOnlyDiscovery(
    opts.briefing,
    opts.learningContext,
    existingBlock,
    scanFocus,
    opts.optionalExtraContext,
    opts.existingFunds,
  );
  await report(90, 'structuring');
  return {
    ...fallback,
    fallbackReason: webFailure ? `web_failed:${webFailure}` : 'web_empty',
  };
}

async function secondPassOpusDiscovery(opts: {
  briefing: OpportunityBriefing;
  learningContext: string;
  existingBlock: string;
  existingFunds: Array<{ name: string; institution: string }>;
  optionalExtraContext?: string;
  alreadyFound: ScanCandidate[];
  requiredQueries: string[];
}): Promise<ScanCandidate[]> {
  const found = opts.alreadyFound
    .map((c) => `${c.name} (${c.institution})`)
    .join('\n') || '(none)';
  const { research: RESEARCH_SYSTEM, structure: STRUCTURE_SYSTEM } = promptsForFocus('open_now');
  try {
    const { text: research } = await llmCompleteWithWebSearch(
      RESEARCH_SYSTEM,
      [
        `BRIEFING:\n${briefingLines(opts.briefing)}`,
        `\nThe first pass collapsed onto one agency or was too thin. Find NEW official open grant calls that match the BRIEFING.`,
        briefingRequestsIfad(opts.briefing) ? '' : `\nFORBIDDEN: do not include IFAD / FIDA / ifad.org.`,
        `\nALREADY FOUND (do not repeat):\n${found}`,
        `\nEXISTING INBOX:\n${opts.existingBlock}`,
        `\nREQUIRED OFFICIAL SEARCHES:\n${opts.requiredQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
        opts.optionalExtraContext?.trim()
          ? `\nPORTALS:\n${opts.optionalExtraContext.trim()}`
          : '',
        `\nCover missing regions and themes. Official call pages only.`,
      ].join(''),
      {
        model: 'claude-opus-4-6',
        maxOutputTokens: 12288,
        temperature: 0.2,
        timeoutMs: 150_000,
        webSearchMaxUses: 10,
      },
    );
    const jsonText = await llmCompleteJsonText(
      STRUCTURE_SYSTEM,
      `RESEARCH REPORT:\n${research}\n\nBRIEFING:\n${briefingLines(opts.briefing)}\n\nSkip ALREADY FOUND and EXISTING.`,
      { maxOutputTokens: 12288 },
    );
    const parsed = JSON.parse(jsonText) as { candidates?: unknown[] };
    let extra = normalizeCandidates(parsed.candidates ?? [], 'open_now').map((c) =>
      sanitizeCandidateDates({
        ...c,
        tempId: c.tempId || randomUUID(),
        scanFocus: 'open_now' as const,
      }),
    );
    extra = applyBriefingDiversity(dropDuplicateFunds(extra, opts.existingFunds), opts.briefing);
    return extra.filter(isOpenNowCandidate);
  } catch (e) {
    console.warn('[opportunity/web-discovery] opus second pass failed:', e);
    return [];
  }
}

async function knowledgeOnlyDiscovery(
  briefing: OpportunityBriefing,
  learningContext: string,
  existingBlock: string,
  scanFocus: ScanFocus,
  optionalExtraContext?: string,
  existingFunds: Array<{ name: string; institution: string }> = [],
): Promise<WebDiscoveryResult> {
  const { structure: STRUCTURE_SYSTEM } = promptsForFocus(scanFocus);
  const system = `You are an opportunity discovery agent. ${scanFocus === 'open_now' ? 'Only return programs verifiably open for applications now.' : 'Map funding programs for intelligence base.'} Return JSON { "candidates": [...] } with 6-10 REAL official programs. NEVER copy items listed under EXISTING (including demo/sandbox funds). ${STRUCTURE_SYSTEM}`;
  const user = [
    `BRIEFING:\n${briefingLines(briefing)}`,
    `\nLEARNING:\n${learningContext}`,
    `\nEXISTING (do not repeat names):\n${existingBlock}`,
    optionalExtraContext?.trim() ? `\nOPTIONAL PORTALS:\n${optionalExtraContext.trim()}` : '',
    `\nTODAY: ${todayIso()}`,
  ].join('');
  const jsonText = await llmCompleteJsonText(system, user, { maxOutputTokens: 16384 });
  const parsed = JSON.parse(jsonText) as { candidates?: unknown[] };
  let candidates = normalizeCandidates(parsed.candidates ?? [], scanFocus).map((c) =>
    sanitizeCandidateDates({
      ...c,
      tempId: c.tempId || randomUUID(),
      scanFocus,
    }),
  );
  candidates = applyBriefingDiversity(dropDuplicateFunds(candidates, existingFunds), briefing);
  if (scanFocus === 'open_now') {
    const open = candidates.filter(isOpenNowCandidate);
    candidates = open.length > 0 ? open : candidates;
  }
  return { candidates, discoveryMode: 'knowledge', searchQueries: [] };
}
