/** Client-safe helpers to open a FundHub proposal from a known fund or a manual edital. */

import type { Locale } from '@/lib/i18n';

const DOC_HEAD: Record<
  Locale,
  { read: string; idea: string; draft: string; elig: string; bases: string; waitingRead: string; waitingIdea: string }
> = {
  es: {
    read: 'Lectura de la convocatoria',
    idea: 'Idea general',
    draft: 'Borrador',
    elig: 'Elegibilidad y requisitos',
    bases: 'Bases oficiales (citar; no inventar)',
    waitingRead: 'La IA está leyendo la convocatoria oficial. La postulación empieza solo después de esta lectura.',
    waitingIdea: 'La IA está preparando una idea general para este fondo y el perfil de la organización.',
  },
  pt: {
    read: 'Leitura do edital',
    idea: 'Ideia geral',
    draft: 'Rascunho',
    elig: 'Elegibilidade e requisitos',
    bases: 'Bases oficiais (citar; não inventar)',
    waitingRead: 'A IA está a ler a convocatória oficial. A postulação começa só depois desta leitura.',
    waitingIdea: 'A IA está a preparar uma ideia geral para este fundo e o perfil da organização.',
  },
  en: {
    read: 'Call reading',
    idea: 'General idea',
    draft: 'Draft',
    elig: 'Eligibility and requirements',
    bases: 'Official guidelines (quote; do not invent)',
    waitingRead: 'The AI is reading the official call. Writing starts only after this briefing.',
    waitingIdea: 'The AI is preparing a general idea for this fund and the organisation profile.',
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
  status: 'draft' | 'submitted' | 'archived';
};

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

export function seedUnderstandMarkdown(seed: ProposalFundSeed, briefing?: string, locale?: string | null): string {
  const h = docHead(locale);
  const title = seed.name?.trim() || 'Proposta';
  const brief = briefing?.trim() ? briefing.trim() : h.waitingRead;
  const eligibility = [seed.whoCanApply, seed.eligibility || seed.eligibilityCriteria, seed.requirements, seed.howToApply]
    .filter((s) => Boolean(String(s ?? '').trim()))
    .join('\n\n');
  const bases = String(seed.basesText || seed.sourceExcerpt || '').trim();
  const parts = [`# ${title}`, `## ${h.read}\n\n${brief}`];
  if (eligibility) parts.push(`## ${h.elig}\n\n${eligibility}`);
  if (bases) {
    const clip = bases.length > 4500 ? `${bases.slice(0, 4500).trim()}…` : bases;
    parts.push(`## ${h.bases}\n\n${clip}`);
  }
  return parts.join('\n\n');
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
  let incoming = draft
    .trim()
    .replace(
      /^(?:Escrito en el documento\.|Escrito no documento\.|Written into the document\.)\s*/i,
      '',
    )
    .trim();
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
