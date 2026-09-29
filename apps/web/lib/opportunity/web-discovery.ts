import 'server-only';

import { randomUUID } from 'crypto';
import { llmCompleteJsonText, llmCompleteWithWebSearch } from '@/lib/llm-client';
import { sanitizeCandidateDates } from '@/lib/opportunity/availability';
import { normalizeCandidates } from '@/lib/opportunity/candidate-store';
import {
  applyBriefingDiversity,
  buildDiscoveryQueryPacks,
  buildDiscoverySearchQueries,
  isHomogeneousInstitutionSet,
  type DiscoveryQueryPack,
} from '@/lib/opportunity/discovery-queries';
import { FUNDHUB_DISCOVERY_MODEL, fundhubScoutModel } from '@/lib/opportunity/fundhub-llm';
import { salvageJsonText, truncateForStructure } from '@/lib/opportunity/json-salvage';
import { formatOpportunityScoutBrief } from '@/lib/opportunity/scout-brief';
import { enrichAndFilterCandidates } from '@/lib/opportunity/enrich-call';
import { OFFICIAL_LINK_PROMPT_RULES } from '@/lib/opportunity/official-url';
import { dropDuplicateFunds, isOpenNowCandidate } from '@/lib/opportunity/scan-filters';
import type { OpportunityBriefing, ScanCandidate, ScanFocus } from '@/lib/opportunity/scan-types';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function briefingLines(b: OpportunityBriefing): string {
  return formatOpportunityScoutBrief(b);
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
      research: `You are a funding scout. Search the LIVE WEB and list every real open call you can verify.

TODAY'S DATE: ${today}

Hunt like an operator — wide first, official URL second:
- Search the whole internet. News, ministry bulletins, foundation pages, LinkedIn and aggregators are valid STARTING points.
- When you find a call off-site, search again for the funder's OWN convocatoria / edital / RFA page and put THAT in callUrl.
- Never invent a fund, agency, name or URL. If you did not see it in a live result, skip it.
- Skip expired or closed windows. Skip homepages with no open call.
- Cover local/municipal public funds, national public calls, private and corporate foundations, multilaterals, organisms and technical-cooperation windows (GIZ, AFD, AECID, JICA, USAID, etc.).
- For each hit keep it short: official name, funder, official call URL, deadline if seen, who can apply, what it funds (a few lines each). Do not write essays in this pass.
- At least 15 distinct open calls from at least 8 institutions when they exist. At most 4 from the same funder.
- Run every numbered query in THIS pass. They are discovery phrases, not a closed portal list.
- Ranking notes (Rural Commerce principles, etc.) score matchScore. They must NOT veto a real open call that matches the themes and geography.

${OFFICIAL_LINK_PROMPT_RULES}`,
      structure: `Convert the research into JSON only. Return { "candidates": [ ... ] }
Each item needs compact fields (Portuguese OK):
name, institution, type (Grant|Crédito|Aliança|Técnico local),
description (1 short paragraph, max ~400 chars),
whoCanApply, eligibility (1–2 lines each),
callUrl (official convocatoria page — required),
institutionUrl, linkOficial, documents (only if seen),
amount, currency, opensAt, closesAt, eligibleCountries,
availabilityStatus ("open_now" or "rolling"),
matchScore (0-100), matchJustification (1 line), sourceUrl,
classification (direct|client_bridge|joint).

Return 8–14 candidates from DISTINCT institutions. Prefer complete JSON over long essays.
Skip EXISTING duplicates. Never invent URLs.

${OFFICIAL_LINK_PROMPT_RULES}`,
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

    const packs = buildDiscoveryQueryPacks(opts.briefing);
    const requiredQueries = buildDiscoverySearchQueries(opts.briefing);
    const extraClean = opts.optionalExtraContext?.trim() ?? '';
    const sharedBrief = [
      `BRIEFING (this is the search intent — obey it, then search the open web):\n${briefingLines(opts.briefing)}`,
      `\nLEARNING (skip-list only — do not copy catalog institutions as the theme):\n${opts.learningContext}`,
      `\nALREADY ON THE DESK OR IN CATALOG (do not repeat — find OTHER official calls from OTHER institutions):\n${existingBlock}`,
      extraClean ? `\nOPTIONAL HINTS (not a closed source list):\n${extraClean}` : '',
      focusHint,
    ].join('');

    await report(22, 'web_research');
    // Um pack de cada vez: 3 em paralelo triplicava web_search + tokens sem melhorar o yield.
    const packSlice = packs.slice(0, 2);
    const packResults: Array<{ text: string; searchQueries: string[] }> = [];
    for (const pack of packSlice) {
      packResults.push(
        await runPackWebSearch({
          pack,
          researchSystem: RESEARCH_SYSTEM,
          sharedBrief,
          scanFocus,
        }),
      );
    }
    const research = packResults
      .map((r, i) => `## PASS ${packSlice[i]?.label ?? i}\n${r.text}`)
      .join('\n\n');
    const searchQueries = packResults.flatMap((r) => r.searchQueries);

    await report(65, 'structuring');
    const structureUser = [
      `RESEARCH REPORT:\n${truncateForStructure(research)}`,
      `\nEXISTING (skip duplicates):\n${existingBlock.slice(0, 4000)}`,
      `\nBRIEFING:\n${briefingLines(opts.briefing)}`,
      focusHint,
      `\nKeep each description under 400 characters. Prefer 8–14 complete candidates over a truncated dump.`,
    ].join('');

    const jsonText = await llmCompleteJsonText(STRUCTURE_SYSTEM, structureUser, {
      maxOutputTokens: 16000,
      model: FUNDHUB_DISCOVERY_MODEL,
      allowTruncated: true,
    });
    let parsed: { candidates?: unknown[] } = { candidates: [] };
    try {
      parsed = JSON.parse(salvageJsonText(jsonText)) as { candidates?: unknown[] };
    } catch (e) {
      console.warn('[opportunity/web-discovery] structure JSON parse failed, retry compact:', e);
      const retryText = await llmCompleteJsonText(
        STRUCTURE_SYSTEM,
        [
          `RESEARCH REPORT (compact):\n${truncateForStructure(research, 14_000)}`,
          `\nEXISTING:\n${existingBlock.slice(0, 2000)}`,
          `\nBRIEFING:\n${briefingLines(opts.briefing)}`,
          `\nReturn at most 8 candidates. Very short fields. Valid JSON only.`,
        ].join(''),
        {
          maxOutputTokens: 8000,
          model: FUNDHUB_DISCOVERY_MODEL,
          allowTruncated: true,
        },
      );
      parsed = JSON.parse(salvageJsonText(retryText)) as { candidates?: unknown[] };
    }
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
      candidates.length < 4 &&
      isHomogeneousInstitutionSet(candidates);

    if (needSecondPass) {
      await report(82, 'web_research_fable');
      const extra = await secondPassOpusDiscovery({
        briefing: opts.briefing,
        learningContext: opts.learningContext,
        existingBlock,
        existingFunds: [...opts.existingFunds, ...candidates],
        optionalExtraContext: extraClean,
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

async function runPackWebSearch(opts: {
  pack: DiscoveryQueryPack;
  researchSystem: string;
  sharedBrief: string;
  scanFocus: ScanFocus;
}): Promise<{ text: string; searchQueries: string[] }> {
  const user = [
    opts.sharedBrief,
    `\nTHIS PASS: ${opts.pack.label}`,
    `\nREQUIRED SEARCHES for this pass (run each; they are discovery queries, not a closed portal list):\n${opts.pack.queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
    `\nIf a result is news, LinkedIn, or an aggregator, search again for the funder's official convocatoria URL before listing the candidate.`,
    `\n${OFFICIAL_LINK_PROMPT_RULES}`,
    `\ncallUrl and linkOficial must be the funder's own page — never an aggregator.`,
  ].join('');
  try {
    const { text, searchQueries } = await llmCompleteWithWebSearch(opts.researchSystem, user, {
      model: opts.pack.id === 'open_web' ? fundhubScoutModel() : FUNDHUB_DISCOVERY_MODEL,
      maxOutputTokens: 8192,
      timeoutMs: 150_000,
      webSearchMaxUses: opts.pack.id === 'open_web' ? 6 : 4,
    });
    return { text, searchQueries };
  } catch (e) {
    console.warn(`[opportunity/web-discovery] pack ${opts.pack.id} failed:`, e);
    return { text: `(pass ${opts.pack.id} failed)`, searchQueries: opts.pack.queries };
  }
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
        `\nThe first pass was too thin or too homogeneous. Search the OPEN WEB for NEW open calls that match the BRIEFING.`,
        `\nLook for local/municipal public funds, national public calls, private and corporate foundations, multilaterals, organisms, and technical-cooperation windows. Do not restrict to a recorded portal list.`,
        `\nWhen you find a call off-site, follow through to the funder's official convocatoria page.`,
        `\nALREADY FOUND (do not repeat):\n${found}`,
        `\nEXISTING INBOX:\n${opts.existingBlock}`,
        `\nREQUIRED SEARCHES (open-web first):\n${opts.requiredQueries.map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
        opts.optionalExtraContext?.trim()
          ? `\nOPTIONAL HINTS:\n${opts.optionalExtraContext.trim()}`
          : '',
        `\nCover missing regions, themes, and instrument types. callUrl must be official.`,
      ].join(''),
      {
        model: FUNDHUB_DISCOVERY_MODEL,
        maxOutputTokens: 8192,
        timeoutMs: 150_000,
        webSearchMaxUses: 6,
      },
    );
    const jsonText = await llmCompleteJsonText(
      STRUCTURE_SYSTEM,
      `RESEARCH REPORT:\n${truncateForStructure(research, 14_000)}\n\nBRIEFING:\n${briefingLines(opts.briefing)}\n\nSkip ALREADY FOUND and EXISTING. Max 8 candidates, short fields.`,
      { maxOutputTokens: 8000, model: FUNDHUB_DISCOVERY_MODEL, allowTruncated: true },
    );
    const parsed = JSON.parse(salvageJsonText(jsonText)) as { candidates?: unknown[] };
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
