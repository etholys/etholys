import 'server-only';

import { randomUUID } from 'crypto';
import { llmCompleteJsonText, llmCompleteWithWebSearch } from '@/lib/llm-client';
import { normalizeCandidates } from '@/lib/opportunity/candidate-store';
import { OFFICIAL_LINK_PROMPT_RULES } from '@/lib/opportunity/official-url';
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

function promptsForFocus(scanFocus: ScanFocus) {
  const today = todayIso();

  if (scanFocus === 'open_now') {
    return {
      research: `You are an opportunity scout. Use web search to find funding calls that are ACCEPTING APPLICATIONS RIGHT NOW.

TODAY'S DATE: ${today}

CRITICAL RULES:
- Prefer official funder pages for linkOficial; if found only on aggregators, still INCLUDE the opportunity but leave linkOficial empty (never put aggregator URL in linkOficial).
- Generic web search is valuable — use it; then try to resolve the official call URL.
- EXCLUDE: expired calls, closed windows, generic program homepages WITHOUT an active open call.
- For each item: closesAt, opensAt, eligibleCountries, classification (direct|client_bridge|joint), classificationNote.
- Search broadly AND with site: filters for official portals.
- Minimum 6 opportunities when possible; fewer is OK if strict quality.

${OFFICIAL_LINK_PROMPT_RULES}`,
      structure: `Convert the research into JSON only. Return { "candidates": [ ... ] }
Each item MUST include:
name, institution, type (Grant|Crédito|Aliança|Técnico local), category, description,
linkOficial (OFFICIAL funder URL only — never aggregators; omit if unknown), amount, currency,
opensAt, closesAt, applicationWindow, eligibleCountries,
availabilityStatus ("open_now" or "rolling"),
availabilityNote, classification (direct|client_bridge|joint), classificationNote,
matchScore (0-100), matchJustification, sourceUrl (official only if present).
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

For each: name, institution, type, eligible countries, typical application windows, last known status, official URL, availabilityStatus (seasonal|rolling|closed|reference), when it typically opens.

This feeds an intelligence base — accuracy over quantity. Minimum 8 programs.

${OFFICIAL_LINK_PROMPT_RULES}`,
    structure: `Convert the research into JSON only. Return { "candidates": [ ... ] }
Each item: name, institution, type, category, description, linkOficial (official program page on funder domain),
amount, currency, opensAt, closesAt, applicationWindow, eligibleCountries,
availabilityStatus (seasonal|rolling|closed|reference — NOT open_now unless verified open),
availabilityNote (typical windows, last call date, reopening hints),
matchScore, matchJustification, sourceUrl (official only).
${OFFICIAL_LINK_PROMPT_RULES}
Do not invent URLs. Skip EXISTING duplicates. Omit linkOficial if only aggregator URL found.`,
  };
}

export type WebDiscoveryResult = {
  candidates: ScanCandidate[];
  discoveryMode: 'web' | 'knowledge';
  searchQueries: string[];
};

export async function discoverOpportunitiesOnline(opts: {
  briefing: OpportunityBriefing;
  learningContext: string;
  existingFunds: Array<{ name: string; institution: string }>;
  optionalExtraContext?: string;
  scanFocus?: ScanFocus;
}): Promise<WebDiscoveryResult> {
  const scanFocus = opts.scanFocus ?? 'open_now';
  const existingBlock =
    opts.existingFunds.map((f) => `${f.name} (${f.institution})`).join('\n') || '(none)';

  if (!isWebSearchEnabled()) {
    return knowledgeOnlyDiscovery(
      opts.briefing,
      opts.learningContext,
      existingBlock,
      scanFocus,
      opts.optionalExtraContext,
    );
  }

  const { research: RESEARCH_SYSTEM, structure: STRUCTURE_SYSTEM } = promptsForFocus(scanFocus);

  try {
    const focusHint =
      scanFocus === 'open_now'
        ? `\nMODE: OPEN NOW ONLY — reject anything without a verifiable active submission window as of ${todayIso()}.`
        : `\nMODE: REFERENCE INTELLIGENCE — map programs for future tracking, include seasonal and closed.`;

    const userResearch = [
      `BRIEFING:\n${briefingLines(opts.briefing)}`,
      `\nLEARNING:\n${opts.learningContext}`,
      `\nEXISTING (do not repeat):\n${existingBlock}`,
      opts.optionalExtraContext?.trim()
        ? `\nOPTIONAL PORTALS:\n${opts.optionalExtraContext.trim()}`
        : '',
      focusHint,
      `\n${OFFICIAL_LINK_PROMPT_RULES}`,
      `\nSearch the web broadly (generic queries OK). Prefer official domains for linkOficial; never put aggregator URLs in linkOficial.`,
    ].join('');

    const { text: research, searchQueries } = await llmCompleteWithWebSearch(
      RESEARCH_SYSTEM,
      userResearch,
      { maxOutputTokens: 16384, temperature: scanFocus === 'open_now' ? 0.15 : 0.25 },
    );

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
    let candidates = normalizeCandidates(parsed.candidates ?? [], scanFocus).map((c) => ({
      ...c,
      tempId: c.tempId || randomUUID(),
      scanFocus,
    }));

    if (scanFocus === 'open_now') {
      candidates = candidates.filter(
        (c) => c.availabilityStatus === 'open_now' || c.availabilityStatus === 'rolling',
      );
    }

    if (candidates.length > 0) {
      return { candidates, discoveryMode: 'web', searchQueries };
    }
  } catch (e) {
    console.warn('[opportunity/web-discovery] web search failed, fallback:', e);
  }

  return knowledgeOnlyDiscovery(
    opts.briefing,
    opts.learningContext,
    existingBlock,
    scanFocus,
    opts.optionalExtraContext,
  );
}

async function knowledgeOnlyDiscovery(
  briefing: OpportunityBriefing,
  learningContext: string,
  existingBlock: string,
  scanFocus: ScanFocus,
  optionalExtraContext?: string,
): Promise<WebDiscoveryResult> {
  const { structure: STRUCTURE_SYSTEM } = promptsForFocus(scanFocus);
  const system = `You are an opportunity discovery agent. ${scanFocus === 'open_now' ? 'Only return programs verifiably open for applications now.' : 'Map funding programs for intelligence base.'} Return JSON { "candidates": [...] } with 6-10 items. ${STRUCTURE_SYSTEM}`;
  const user = [
    `BRIEFING:\n${briefingLines(briefing)}`,
    `\nLEARNING:\n${learningContext}`,
    `\nEXISTING:\n${existingBlock}`,
    optionalExtraContext?.trim() ? `\nOPTIONAL PORTALS:\n${optionalExtraContext.trim()}` : '',
    `\nTODAY: ${todayIso()}`,
  ].join('');
  const jsonText = await llmCompleteJsonText(system, user, { maxOutputTokens: 16384 });
  const parsed = JSON.parse(jsonText) as { candidates?: unknown[] };
  let candidates = normalizeCandidates(parsed.candidates ?? [], scanFocus).map((c) => ({
    ...c,
    tempId: c.tempId || randomUUID(),
    scanFocus,
  }));
  if (scanFocus === 'open_now') {
    candidates = candidates.filter(
      (c) => c.availabilityStatus === 'open_now' || c.availabilityStatus === 'rolling',
    );
  }
  return { candidates, discoveryMode: 'knowledge', searchQueries: [] };
}
