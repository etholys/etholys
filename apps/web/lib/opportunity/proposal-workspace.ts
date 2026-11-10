/** Client-safe helpers to open a FundHub proposal from a known fund or a manual edital. */

import type { Locale } from '@/lib/i18n';
import { parseProposalStatus, type ProposalStatus } from '@/lib/opportunity/proposal-status';

const DOC_HEAD: Record<
  Locale,
  {
    read: string;
    idea: string;
    draft: string;
    elig: string;
    bases: string;
    waitingRead: string;
    waitingIdea: string;
    /** After understand: full briefing stays in chat; canvas waits for Write. */
    readInChat: string;
  }
> = {
  es: {
    read: 'Lectura de la convocatoria',
    idea: 'Idea general',
    draft: 'Borrador',
    elig: 'Elegibilidad y requisitos',
    bases: 'Bases oficiales (citar; no inventar)',
    waitingRead: 'La IA está leyendo la convocatoria oficial. La postulación empieza solo después de esta lectura.',
    waitingIdea: 'La IA está preparando una idea general para este fondo y el perfil de la organización.',
    readInChat:
      'La lectura completa está en el chat. Este documento se llena solo al pasar a la postulación (Redactar).',
  },
  pt: {
    read: 'Leitura do edital',
    idea: 'Ideia geral',
    draft: 'Rascunho',
    elig: 'Elegibilidade e requisitos',
    bases: 'Bases oficiais (citar; não inventar)',
    waitingRead: 'A IA está a ler a convocatória oficial. A postulação começa só depois desta leitura.',
    waitingIdea: 'A IA está a preparar uma ideia geral para este fundo e o perfil da organização.',
    readInChat:
      'A leitura completa está no chat. Este documento só se preenche ao passar à postulação (Redigir).',
  },
  en: {
    read: 'Call reading',
    idea: 'General idea',
    draft: 'Draft',
    elig: 'Eligibility and requirements',
    bases: 'Official guidelines (quote; do not invent)',
    waitingRead: 'The AI is reading the official call. Writing starts only after this briefing.',
    waitingIdea: 'The AI is preparing a general idea for this fund and the organisation profile.',
    readInChat:
      'The full briefing is in the chat. This document fills only when you start writing.',
  },
};

function docHead(locale?: string | null) {
  if (locale === 'pt') return DOC_HEAD.pt;
  if (locale === 'en') return DOC_HEAD.en;
  return DOC_HEAD.es;
}

export const PROPOSAL_CANDIDATE_KEY = 'opportunityProposalCandidate';
export const SELECTED_FUND_KEY = 'selectedFund';

export type ProposalFundSeed = {
  id: string;
  name: string;
  institution?: string | null;
  description?: string | null;
  linkOficial?: string | null;
  callUrl?: string | null;
  institutionUrl?: string | null;
  documents?: Array<{ title: string; url: string; kind?: string }>;
  sourceExcerpt?: string | null;
  basesText?: string | null;
  eligibilityCriteria?: string | null;
  whoCanApply?: string | null;
  eligibility?: string | null;
  requirements?: string | null;
  howToApply?: string | null;
  risksCaveats?: string | null;
  deadline?: string | Date | null;
  countries?: string | null;
  amount?: number | null;
  currency?: string | null;
  type?: string | null;
  category?: string | null;
  notes?: string | null;
  summary?: string | null;
  matchJustification?: string | null;
};

export type ProposalIntakeRecord = {
  workspaceId: string;
  fundId: string;
  fundName: string;
  fundInstitution: string;
  editalLink: string;
  intakeNotes: string;
  attachedFiles?: ProposalAttachedFile[];
  seedSource?: 'fund' | 'candidate' | 'manual';
  sourceExcerpt?: string;
  basesText?: string;
  documents?: Array<{ title: string; url: string; kind?: string }>;
  stage?: 'understand' | 'write';
};

export type ProposalDraftIndex = {
  workspaceId: string;
  fundId: string;
  title?: string;
  fundName: string;
  fundInstitution: string;
  editalLink: string;
  editalSummary: string;
  createdAt: string;
  updatedAt: string;
  status: ProposalStatus;
  statusNote?: string;
  statusChangedAt?: string;
};

/** Browser index used by the proposals list and FundHub sidebar history. */
export function readLocalProposalDrafts(): ProposalDraftIndex[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('proposalDrafts');
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: ProposalDraftIndex[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== 'object') continue;
      const p = row as Record<string, unknown>;
      const workspaceId = String(p.workspaceId ?? '').trim();
      if (!workspaceId) continue;
      const status = parseProposalStatus(p.status);
      out.push({
        workspaceId,
        fundId: String(p.fundId ?? '').trim(),
        title: typeof p.title === 'string' ? p.title : undefined,
        fundName: typeof p.fundName === 'string' ? p.fundName : '',
        fundInstitution: typeof p.fundInstitution === 'string' ? p.fundInstitution : '',
        editalLink: typeof p.editalLink === 'string' ? p.editalLink : '',
        editalSummary: typeof p.editalSummary === 'string' ? p.editalSummary : '',
        createdAt: typeof p.createdAt === 'string' ? p.createdAt : '',
        updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '',
        status,
        statusNote: typeof p.statusNote === 'string' ? p.statusNote : undefined,
        statusChangedAt: typeof p.statusChangedAt === 'string' ? p.statusChangedAt : undefined,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Merge server + local indexes.
 * Same workspaceId: newer `updatedAt` wins (so a just-renamed local title sticks
 * until the server refresh catches up). Local-only drafts are appended.
 */
export function mergeProposalDraftIndexes(
  server: ProposalDraftIndex[],
  local: ProposalDraftIndex[] = readLocalProposalDrafts(),
): ProposalDraftIndex[] {
  const byId = new Map<string, ProposalDraftIndex>();
  for (const row of server) {
    if (row.workspaceId) byId.set(row.workspaceId, row);
  }
  for (const row of local) {
    if (!row.workspaceId) continue;
    const prev = byId.get(row.workspaceId);
    if (!prev) {
      byId.set(row.workspaceId, row);
      continue;
    }
    const localNewer =
      String(row.updatedAt || '').localeCompare(String(prev.updatedAt || '')) >= 0;
    byId.set(row.workspaceId, localNewer ? { ...prev, ...row } : { ...row, ...prev });
  }
  const merged = Array.from(byId.values());
  merged.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return merged;
}

/** Same-tab signal so FundHub sidebar / list can refresh after local index edits. */
export const PROPOSALS_INDEX_CHANGED_EVENT = 'fundhub:proposals-index-changed';

export function notifyProposalsIndexChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROPOSALS_INDEX_CHANGED_EVENT));
}

export function normalizeProposalTitle(raw: string, fallback = 'Proposta'): string {
  const t = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 300);
  return t || fallback;
}

/**
 * Persist the canonical proposal display title into the local draft index
 * (+ full draft blob when present). Does not change fundName.
 */
export function updateLocalProposalTitle(
  workspaceId: string,
  title: string,
  base?: Partial<ProposalDraftIndex>,
): ProposalDraftIndex[] {
  if (typeof window === 'undefined') return [];
  const id = String(workspaceId ?? '').trim();
  if (!id) return readLocalProposalDrafts();
  const nextTitle = normalizeProposalTitle(title);
  const updatedAt = new Date().toISOString();
  const drafts = readLocalProposalDrafts();
  const idx = drafts.findIndex((d) => d.workspaceId === id);
  if (idx >= 0) {
    drafts[idx] = { ...drafts[idx]!, title: nextTitle, updatedAt };
  } else {
    drafts.unshift({
      workspaceId: id,
      fundId: String(base?.fundId ?? '').trim(),
      title: nextTitle,
      fundName: typeof base?.fundName === 'string' ? base.fundName : '',
      fundInstitution: typeof base?.fundInstitution === 'string' ? base.fundInstitution : '',
      editalLink: typeof base?.editalLink === 'string' ? base.editalLink : '',
      editalSummary: typeof base?.editalSummary === 'string' ? base.editalSummary : '',
      createdAt: typeof base?.createdAt === 'string' && base.createdAt ? base.createdAt : updatedAt,
      updatedAt,
      status: parseProposalStatus(base?.status),
      statusNote: typeof base?.statusNote === 'string' ? base.statusNote : undefined,
      statusChangedAt: typeof base?.statusChangedAt === 'string' ? base.statusChangedAt : undefined,
    });
  }
  localStorage.setItem('proposalDrafts', JSON.stringify(drafts));
  try {
    const draftKey = `proposalDraft:${id}`;
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      const draft = JSON.parse(raw) as Record<string, unknown>;
      draft.title = nextTitle;
      draft.updatedAt = updatedAt;
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }
  } catch {
    /* ignore */
  }
  notifyProposalsIndexChanged();
  return drafts;
}

/** How a file is used — mixing these in one unlabeled pile confuses the model. */
export type ProposalFileRole = 'bases' | 'reference' | 'turn';

export type ProposalAttachedFile = {
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  role: ProposalFileRole;
  textExcerpt?: string;
  /** In-memory only (images/PDF). Never persist to localStorage. */
  dataBase64?: string;
};

export function normalizeProposalFileRole(raw: unknown): ProposalFileRole {
  if (raw === 'reference' || raw === 'turn' || raw === 'bases') return raw;
  return 'bases';
}

export function hydrateProposalAttachedFiles(raw: unknown): ProposalAttachedFile[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    .map((item) => ({
      name: String(item.name || 'file'),
      size: Number(item.size) || 0,
      type: String(item.type || 'application/octet-stream'),
      uploadedAt: String(item.uploadedAt || ''),
      role: normalizeProposalFileRole(item.role),
      textExcerpt: typeof item.textExcerpt === 'string' ? item.textExcerpt : undefined,
    }));
}

export function persistableProposalFiles(files: ProposalAttachedFile[]): ProposalAttachedFile[] {
  return files
    .filter((f) => f.role !== 'turn')
    .map(({ dataBase64: _omit, ...rest }) => rest);
}

const FILE_ROLE_HEADERS: Record<ProposalFileRole, string> = {
  bases:
    'FICHEIROS — BASES DO EDITAL (norma oficial / formulário do doador. Prevalecem sobre o resto. Não são evidência da org.)',
  reference:
    'FICHEIROS — REFERÊNCIA DA PROPOSTA (CV, relatórios, factos da org. Usar como evidência da candidatura. NUNCA tratar como requisitos do fundo.)',
  turn:
    'FICHEIROS DESTA MENSAGEM (captura / recorte pontual. Segue o formato visível aqui. Não promover a bases nem a biblioteca permanente.)',
};

export function formatProposalFileContext(
  files: Array<{ name: string; role?: string; textExcerpt?: string }>,
): string {
  const buckets: Record<ProposalFileRole, typeof files> = { bases: [], reference: [], turn: [] };
  for (const file of files) {
    buckets[normalizeProposalFileRole(file.role)].push(file);
  }
  const parts: string[] = [];
  for (const role of ['bases', 'reference', 'turn'] as const) {
    const list = buckets[role];
    if (!list.length) continue;
    const body = list
      .map((file) => {
        const excerpt = file.textExcerpt?.trim();
        const cap = role === 'bases' ? 18000 : 6000;
        return `--- ${role.toUpperCase()}: ${file.name} ---\n${
          excerpt
            ? excerpt.slice(0, cap)
            : '(sem texto extraído — NÃO inventes o conteúdo nem uma lista típica. Diz que o ficheiro não foi lido.)'
        }`;
      })
      .join('\n\n');
    parts.push(`${FILE_ROLE_HEADERS[role]}\n${body}`);
  }
  return parts.join('\n\n');
}

export function formatDeadlineLabel(raw: string | Date | null | undefined): string {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('pt-BR');
}

export function buildEditalSummaryFromSeed(seed: ProposalFundSeed): string {
  const amount =
    seed.amount != null && Number.isFinite(Number(seed.amount))
      ? `${seed.currency || 'USD'} ${Number(seed.amount).toLocaleString('pt-BR')}`
      : '';
  const deadline = formatDeadlineLabel(seed.deadline);
  const blocks: Array<[string, string | null | undefined]> = [
    ['Descrição', seed.description || seed.summary],
    ['Quem pode candidatar', seed.whoCanApply],
    ['Elegibilidade', seed.eligibility || seed.eligibilityCriteria],
    ['Requisitos', seed.requirements],
    ['Como candidatar', seed.howToApply],
    ['Riscos / avisos', seed.risksCaveats],
    ['Prazo', deadline],
    ['Países', seed.countries],
    ['Montante', amount],
    ['Tipo', seed.type],
    ['Categoria', seed.category],
    ['Notas', seed.notes],
    ['Encaixe', seed.matchJustification],
    ['Página da convocatória', seed.callUrl || seed.linkOficial],
    [
      'Documentos oficiais',
      seed.documents?.length
        ? seed.documents.map((d) => `${d.title}: ${d.url}`).join('\n')
        : undefined,
    ],
    ['Texto das bases', seed.basesText || seed.sourceExcerpt],
  ];
  return blocks
    .filter(([, value]) => Boolean(String(value ?? '').trim()))
    .map(([label, value]) => `${label}:\n${String(value).trim()}`)
    .join('\n\n');
}

/** Skip the empty "Cole o link do edital" gate when the fund/candidate already has substance. */
export function shouldSkipProposalIntake(opts: {
  fundId?: string | null;
  fund?: ProposalFundSeed | null;
  candidate?: { name?: string | null; linkOficial?: string | null; description?: string | null } | null;
}): boolean {
  const fundId = String(opts.fundId ?? '').trim();
  if (fundId && !fundId.startsWith('adhoc-')) return true;

  const candidate = opts.candidate;
  if (
    candidate?.name?.trim() &&
    (candidate.linkOficial?.trim() || candidate.description?.trim())
  ) {
    return true;
  }

  const fund = opts.fund;
  if (!fund?.id || fund.id.startsWith('adhoc-')) return false;
  return Boolean(
    fund.description?.trim() ||
      fund.linkOficial?.trim() ||
      fund.eligibilityCriteria?.trim() ||
      fund.eligibility?.trim() ||
      fund.whoCanApply?.trim() ||
      fund.summary?.trim(),
  );
}

export function seedFromCandidate(candidate: ProposalFundSeed & { tempId?: string }): ProposalFundSeed {
  const id = candidate.id?.trim() || (candidate.tempId ? `candidate:${candidate.tempId}` : `candidate:${Date.now()}`);
  return { ...candidate, id };
}

export function findReusableDraft(
  drafts: ProposalDraftIndex[],
  fundId: string,
): ProposalDraftIndex | undefined {
  const id = fundId.trim();
  if (!id || id.startsWith('adhoc-')) return undefined;
  return drafts.find((d) => d.fundId === id && d.status === 'draft');
}

export function createProposalWorkspaceId(fundId: string): string {
  return `workspace:${fundId || 'adhoc'}:${Date.now()}`;
}

export function buildProposalIntake(
  workspaceId: string,
  seed: ProposalFundSeed,
  extras?: { notes?: string; files?: ProposalIntakeRecord['attachedFiles']; source?: ProposalIntakeRecord['seedSource'] },
): ProposalIntakeRecord {
  return {
    workspaceId,
    fundId: seed.id,
    fundName: seed.name,
    fundInstitution: seed.institution || '',
    editalLink: seed.callUrl?.trim() || seed.linkOficial?.trim() || '',
    intakeNotes: extras?.notes?.trim() || buildEditalSummaryFromSeed(seed),
    attachedFiles: extras?.files,
    seedSource: extras?.source ?? (seed.id.startsWith('adhoc-') ? 'manual' : seed.id.startsWith('candidate:') ? 'candidate' : 'fund'),
    sourceExcerpt: seed.sourceExcerpt?.trim()?.slice(0, 8000) || undefined,
    basesText: seed.basesText?.trim()?.slice(0, 12_000) || undefined,
    documents: seed.documents,
    stage: 'understand',
  };
}

export function persistProposalIntake(intake: ProposalIntakeRecord): void {
  localStorage.setItem(`proposalIntake:${intake.workspaceId}`, JSON.stringify(intake));
}

export function editorHref(workspaceId: string, fundId?: string | null): string {
  const qs = new URLSearchParams({ workspace: workspaceId });
  if (fundId) qs.set('fundId', fundId);
  return `/hub/fundhub/proposals/editor?${qs.toString()}`;
}

export function sectionsFromMarkdown(md: string): Array<{ id: string; title: string; content: string }> {
  const text = md.replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const parts = text.split(/^##\s+/m);
  const sections: Array<{ id: string; title: string; content: string }> = [];
  const lead = (parts[0] ?? '').trim();
  if (lead && !lead.startsWith('# ') && parts.length === 1) {
    return [{ id: 'section-0', title: 'Proposta', content: lead }];
  }
  if (lead.startsWith('# ')) {
    const title = lead.replace(/^#\s+/, '').split('\n')[0]?.trim() || 'Proposta';
    const rest = lead.split('\n').slice(1).join('\n').trim();
    if (rest) sections.push({ id: 'section-title', title, content: rest });
  }
  parts.slice(1).forEach((block, index) => {
    const nl = block.indexOf('\n');
    const title = (nl === -1 ? block : block.slice(0, nl)).trim() || `Secção ${index + 1}`;
    const content = (nl === -1 ? '' : block.slice(nl + 1)).trim();
    sections.push({ id: `section-${index}`, title, content });
  });
  return sections;
}

/**
 * Strip tool/agent junk before any canvas merge or seed.
 * Chat may still show the raw assistant reply; the living document must not.
 */
export function sanitizeProposalCanvasContent(text: string): string {
  let t = String(text || '').replace(/\r\n/g, '\n');
  if (!t.trim()) return '';

  // Fenced dumps (JSON / code) from ingest or tool paths
  t = t.replace(/```(?:json|javascript|js|ts|typescript|html|xml)?\s*\n[\s\S]*?```/gi, '\n');
  t = t.replace(/```\s*\n\s*\{[\s\S]*?\}\s*\n```/g, '\n');

  const scratchLine =
    /^(?:#{1,3}\s*)?(?:\*\*)?(?:let me\b|based on my research\b|here is the verified\b|transparency notice\b|i must be honest\b|i'?ll search\b|i will search\b|searching for\b|the linkedin\b|linkedin activity\b|looking at the\b|from my (?:search|research)\b|as an ai\b|tool (?:call|result)\b|web[\s-]?search\b|verified json\b|raw json\b|i found that\b|let me dig\b)/i;
  const scratchInline =
    /\b(let me search|based on my research|here is the verified|transparency notice|i must be honest|didn'?t surface|search more specifically|linkedin activity id|urn:li:)\b/i;

  const kept: string[] = [];
  for (const line of t.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      kept.push(line);
      continue;
    }
    if (scratchLine.test(trimmed) || scratchInline.test(trimmed)) continue;
    if (/urn:li:[a-z0-9:_-]+/i.test(trimmed)) continue;
    // Lone JSON object / array lines from ingest
    if (/^[\{\[]/.test(trimmed) && /[\}\]]$/.test(trimmed) && /"[a-z_]+"\s*:/i.test(trimmed)) continue;
    kept.push(line);
  }
  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** True when chat text is an understand / convocatoria briefing — not draft for the note. */
export function looksLikeUnderstandBriefing(text: string): boolean {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/```(?:json)?/i.test(t) && /transparency notice|let me search|verified json/i.test(t)) return true;
  const signals = [
    /situaci[oó]n de partida/i,
    /qu[eé] es este fondo/i,
    /qui[eé]n (?:puede )?postula/i,
    /lectura de la convocatoria/i,
    /leitura do edital/i,
    /call reading|what (?:is|this) (?:fund|call)/i,
    /\b(?:3|tres|três)\s+punt(?:os?|os?)\s+a\s+confirm/i,
    /janela|plazo|deadline|montante|monto\b/i,
  ];
  const hits = signals.filter((re) => re.test(t)).length;
  return hits >= 2 || (hits >= 1 && t.length > 900);
}

/**
 * Understand stage: title + short Lectura placeholder only.
 * The AI briefing stays in chat — never dump analysis / JSON / bases into the canvas.
 * `briefing` is ignored (kept for call-site compatibility).
 */
export function seedUnderstandMarkdown(seed: ProposalFundSeed, briefing?: string, locale?: string | null): string {
  const h = docHead(locale);
  const title = seed.name?.trim() || 'Proposta';
  void briefing;
  return `# ${title}\n\n## ${h.read}\n\n${h.readInChat}\n`;
}

export function appendWriteSections(md: string, locale?: string | null): string {
  const h = docHead(locale);
  const text = md.trim();
  const hasIdea = /^##\s+(Ideia geral|Idea general|General idea)\b/im.test(text);
  const hasDraft = /^##\s+(Rascunho|Borrador|Draft)\b/im.test(text);
  const extra = [hasIdea ? '' : `## ${h.idea}\n\n`, hasDraft ? '' : `## ${h.draft}\n\n`].filter(Boolean).join('\n');
  return extra ? `${text}\n\n${extra}` : text;
}

function splitH2(md: string): { lead: string; sections: Array<{ title: string; content: string }> } {
  const text = md.replace(/\r\n/g, '\n').trim();
  if (!text) return { lead: '', sections: [] };
  const parts = text.split(/^##\s+/m);
  const lead = (parts[0] ?? '').trim();
  const sections = parts
    .slice(1)
    .map((block) => {
      const nl = block.indexOf('\n');
      const title = (nl === -1 ? block : block.slice(0, nl)).trim();
      const content = (nl === -1 ? '' : block.slice(nl + 1)).trim();
      return { title, content };
    })
    .filter((s) => s.title);
  return { lead, sections };
}

/** Leading marker like "c)", "C.", "1.", "1.1" — used to match canvas sections fuzzily. */
export function sectionMarkerKey(title: string): string {
  const m = title
    .trim()
    .toLowerCase()
    .match(/^([a-z]|\d+(?:\.\d+)*)[.)]\s*/);
  return m ? m[1]! : '';
}

export function isMetaProposalSection(title: string): boolean {
  return /leitura|lectura|call reading|chuva|lluvia|ideia geral|idea general|general idea|bases oficial|elegib|rascunho|borrador|^draft$/i.test(
    title,
  );
}

/** True when the canvas already has real form sections (not only briefing meta). */
export function hasEditalFormOutline(md: string): boolean {
  const writable = sectionsFromMarkdown(md).filter(
    (s) => s.title.trim() && !isMetaProposalSection(s.title),
  );
  return writable.length >= 2;
}

/**
 * Pull literal form / annex titles from bases text (a), 1., Sección A — …).
 * Prefer this over generic Idea/Draft when seeding the canvas.
 */
export function extractEditalFormTitles(text: string): string[] {
  const hay = String(text || '').replace(/\r\n/g, '\n');
  if (hay.trim().length < 80) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    let title = raw.replace(/\s+/g, ' ').trim().replace(/[:.\s]+$/u, '');
    title = title.slice(0, 140);
    if (title.length < 4) return;
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    if (
      /^(página|page|http|www\.|tabla|cuadro|figura|ver\b|see\b|nota\b|note\b)/i.test(title)
    ) {
      return;
    }
    seen.add(key);
    out.push(title);
  };

  for (const m of hay.matchAll(
    /^[ \t]*(?:#{1,3}[ \t]*)?((?:[a-zA-Z]|[ivxlcdm]{1,6}|\d{1,2}(?:\.\d+)*)[.)])\s+([^\n]{6,140})/gim,
  )) {
    const marker = m[1]!.replace(/\s/g, '');
    const rest = m[2]!.trim();
    if (/[.!?]{2,}/.test(rest)) continue;
    if (rest.split(/\s+/).length > 20) continue;
    push(`${marker} ${rest}`);
  }

  for (const m of hay.matchAll(
    /\b((?:secci[oó]n|secção|anexo|parte|cap[ií]tulo)\s+[A-Z0-9IVX]+)\s*[-–—:.]\s*([^\n]{4,100})/gi,
  )) {
    push(`${m[1]!.trim()} — ${m[2]!.trim()}`);
  }

  return out.slice(0, 20);
}

/** Append empty ## sections for edital form titles without duplicating. */
export function appendFormTitleSections(md: string, titles: string[]): string {
  if (!titles.length) return md;
  let text = md.trim();
  const extras: string[] = [];
  for (const title of titles) {
    const t = title.trim();
    if (!t) continue;
    const re = new RegExp(`^##\\s+${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'im');
    if (re.test(text)) continue;
    if (text.toLowerCase().includes(`## ${t.toLowerCase()}`)) continue;
    extras.push(`## ${t}\n\n`);
  }
  if (!extras.length) return text;
  return `${text}\n\n${extras.join('\n')}`.trim() + '\n';
}

/**
 * Pick which canvas section a chat message is editing (Gemini/ChatGPT-canvas style).
 * Prefers explicit punto/título matches; on "mejorar/reescribir" falls back to the last real section.
 */
export function resolveCanvasEditTarget(
  documentMarkdown: string,
  userMessage: string,
): { title: string; content: string } | null {
  const sections = sectionsFromMarkdown(documentMarkdown).filter((s) => s.title.trim());
  if (!sections.length) return null;
  const msg = userMessage.trim();
  if (!msg) return null;
  const msgLower = msg.toLowerCase();

  const markerFromMsg =
    msgLower.match(
      /\b(?:punto|punto\s+del\s+formulario|ítem|item|secci[oó]n|campo|letra)\s*([a-z]|\d+(?:\.\d+)*)[.)]?\b/i,
    )?.[1] ||
    msgLower.match(/\b([a-z])\)\s/)?.[1] ||
    '';

  if (markerFromMsg) {
    const hit = sections.find((s) => sectionMarkerKey(s.title) === markerFromMsg.toLowerCase());
    if (hit) return { title: hit.title, content: hit.content };
  }

  let best: { title: string; content: string; score: number } | null = null;
  for (const s of sections) {
    const t = s.title.toLowerCase();
    if (t.length < 4) continue;
    if (msgLower.includes(t)) {
      const score = 100 + t.length;
      if (!best || score > best.score) best = { title: s.title, content: s.content, score };
      continue;
    }
    const words = t.split(/[^a-záéíóúñü0-9]+/i).filter((w) => w.length >= 5);
    const hits = words.filter((w) => msgLower.includes(w)).length;
    if (hits >= 2 || (hits === 1 && words.length === 1)) {
      const score = hits * 20 + Math.min(t.length, 40);
      if (!best || score > best.score) best = { title: s.title, content: s.content, score };
    }
  }
  if (best) return { title: best.title, content: best.content };

  const revise =
    /\b(mejor(a|ar|e)|melhor(a|ar)?|improve|revis(a|ar|e)|reescri|reescrev|reescrit|corrig|ajust|anterior|última\s+respuesta|ultima\s+resposta)\b/i.test(
      msg,
    );
  if (revise) {
    const withContent = [...sections]
      .reverse()
      .find((s) => s.content.trim().length > 40 && !isMetaProposalSection(s.title));
    if (withContent) return { title: withContent.title, content: withContent.content };
  }
  return null;
}

/**
 * Merge AI draft into the canvas: matching ## titles are replaced; new titles are appended.
 * If preferredTitle is set and the draft has no ##, wrap it so the living section is replaced
 * (ChatGPT/Gemini canvas behaviour).
 */
export function mergeDraftIntoMarkdown(
  existing: string,
  draft: string,
  opts?: { preferredTitle?: string | null },
): string {
  let incoming = sanitizeProposalCanvasContent(
    draft
      .trim()
      .replace(
        /^(?:Escrito en el documento\.|Escrito no documento\.|Written into the document\.)\s*/i,
        '',
      )
      .trim(),
  );
  if (!incoming) return existing;

  const preferred = opts?.preferredTitle?.trim();
  if (preferred) {
    const probe = splitH2(incoming);
    if (!probe.sections.length) {
      incoming = `## ${preferred}\n\n${incoming}`;
    } else if (probe.sections.length === 1) {
      // Force the canvas title so fuzzy/exact replace hits the living section.
      incoming = `## ${preferred}\n\n${probe.sections[0]!.content}`;
    }
  }

  const parsedIn = splitH2(incoming);
  const cur = existing.trim();
  if (!parsedIn.sections.length) {
    if (!cur) return incoming;
    return `${cur}\n\n${incoming}\n`;
  }
  if (!cur) {
    const body = parsedIn.sections.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
    return parsedIn.lead ? `${parsedIn.lead}\n\n${body}\n` : `${body}\n`;
  }
  const parsedCur = splitH2(cur);
  const byExact = new Map(parsedIn.sections.map((s) => [s.title.toLowerCase(), s]));
  const byMarker = new Map<string, { title: string; content: string }>();
  for (const s of parsedIn.sections) {
    const marker = sectionMarkerKey(s.title);
    if (marker && !byMarker.has(marker)) byMarker.set(marker, s);
  }
  const seenExact = new Set<string>();
  const seenMarker = new Set<string>();
  const out: Array<{ title: string; content: string }> = [];
  for (const s of parsedCur.sections) {
    const key = s.title.toLowerCase();
    const marker = sectionMarkerKey(s.title);
    const next = byExact.get(key) ?? (marker ? byMarker.get(marker) : undefined) ?? s;
    out.push({ title: s.title, content: next.content });
    seenExact.add(key);
    if (marker) seenMarker.add(marker);
  }
  for (const s of parsedIn.sections) {
    const key = s.title.toLowerCase();
    const marker = sectionMarkerKey(s.title);
    if (seenExact.has(key)) continue;
    if (marker && seenMarker.has(marker)) continue;
    out.push(s);
    seenExact.add(key);
    if (marker) seenMarker.add(marker);
  }
  const lead = parsedCur.lead || parsedIn.lead;
  const body = out.map((s) => `## ${s.title}\n\n${s.content}`).join('\n\n');
  return `${lead ? `${lead}\n\n` : ''}${body}\n`;
}

export function seedDocumentMarkdown(seed: ProposalFundSeed, brainstorm?: string, locale?: string | null): string {
  const h = docHead(locale);
  const title = seed.name?.trim() || 'Proposta';
  const idea = brainstorm?.trim() ? brainstorm.trim() : h.waitingIdea;
  const eligibility = [seed.whoCanApply, seed.eligibility || seed.eligibilityCriteria, seed.requirements, seed.howToApply]
    .filter((s) => Boolean(String(s ?? '').trim()))
    .join('\n\n');
  const bases = String(seed.basesText || seed.sourceExcerpt || '').trim();
  const parts = [`# ${title}`, `## ${h.idea}\n\n${idea}`];
  if (eligibility) parts.push(`## ${h.elig}\n\n${eligibility}`);
  if (bases) {
    const clip = bases.length > 4500 ? `${bases.slice(0, 4500).trim()}…` : bases;
    parts.push(`## ${h.bases}\n\n${clip}`);
  }
  parts.push(`## ${h.draft}\n\n`);
  return parts.join('\n\n');
}
