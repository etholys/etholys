import type { ReportCanvasState, ReplaceTableRowsPayload, CanvasPatch } from '@/lib/siep/report-canvas-types';
import { applyCopilotCanvasUpdate } from '@/lib/siep/report-canvas-merge';
import { buildCanvasSectionsFromRegions } from '@/lib/siep/report-canvas-layout';
import type { ReportOutputLanguage } from '@/lib/siep/report-copilot-prompts';
import { llmGenerateContent } from '@/lib/llm-client';

export type MonthlyActivityBlock = {
  title: string;
  codesHint: string;
  description: string;
  results: string;
  challenges: string;
  lessons: string;
  comments: string;
};

export type MonthlyMediaItem = {
  dateHint: string;
  description: string;
};

export type ParsedMonthlyStructuredNotes = {
  summary: string;
  activities: MonthlyActivityBlock[];
  mediaIntro: string;
  mediaItems: MonthlyMediaItem[];
};

const DESC_RE =
  /^(?:descripci[oó]n\s+de\s+lo\s+que\s+se\s+hizo|descri[cç][aã]o\s+do\s+que\s+foi\s+feito|description(?:\s+of\s+what\s+was\s+done)?)\s*:\s*/i;
const RESULTS_RE = /^(?:resultados?|results?)\s*:\s*/i;
const CHALLENGES_RE = /^(?:desaf[ií]os?|challenges?)\s*:\s*/i;
const LESSONS_RE =
  /^(?:lecciones?\s+aprendidas?|li[cç][oõ]es?\s+aprendidas?|lessons?(?:\s+learned)?)\s*:\s*/i;
const COMMENTS_RE = /^(?:comentarios?|comments?)\s*:\s*/i;
const MEDIA_HEADER_RE = /^(?:media\s*&\s*press(?:\s+coverage)?|cobertura\s+(?:de\s+)?(?:medios|imprensa))/i;
const SECTION_RE =
  /^\s*(\d+)\.\s+(.+?)(?:\s*\(([^)]*)\))?\s*$/;

/** Detecta notas já organizadas com Descripción + Resultados + … */
export function looksLikeStructuredMonthlyNotes(text: string): boolean {
  const t = text.trim();
  if (t.length < 200) return false;
  const hasNumbered = /^\s*\d+\.\s+\S+/m.test(t);
  const hasDesc = DESC_RE.test(t) || /descripci[oó]n\s+de\s+lo\s+que\s+se\s+hizo\s*:/i.test(t);
  const hasResults = /^(?:resultados?|results?)\s*:/im.test(t);
  return hasNumbered && hasDesc && hasResults;
}

function normalizeMeCodes(hint: string): string {
  const raw = hint.trim();
  if (!raw) return '';
  if (/gesti[oó]n|gest[aã]o|project\s*management|sin\s+c[oó]digo/i.test(raw)) {
    return 'Project management';
  }
  const codes = [...raw.matchAll(/\bA?\s*(\d+(?:\.\d+)*[a-z]?)\b/gi)].map((m) => {
    const n = m[1];
    return n.toUpperCase().startsWith('A') ? n : `A${n}`;
  });
  if (codes.length) return [...new Set(codes)].join(', ');
  return raw;
}

function takeField(lines: string[], start: number, labelRe: RegExp): { text: string; next: number } {
  if (start >= lines.length || !labelRe.test(lines[start])) {
    return { text: '', next: start };
  }
  const first = lines[start].replace(labelRe, '').trim();
  const parts: string[] = first ? [first] : [];
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (
      SECTION_RE.test(line) ||
      MEDIA_HEADER_RE.test(line) ||
      DESC_RE.test(line) ||
      RESULTS_RE.test(line) ||
      CHALLENGES_RE.test(line) ||
      LESSONS_RE.test(line) ||
      COMMENTS_RE.test(line)
    ) {
      break;
    }
    if (line.trim()) parts.push(line.trim());
    i += 1;
  }
  return { text: parts.join(' ').replace(/\s+/g, ' ').trim(), next: i };
}

export function parseStructuredMonthlyNotes(text: string): ParsedMonthlyStructuredNotes | null {
  if (!looksLikeStructuredMonthlyNotes(text)) return null;

  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let summary = '';
  const activities: MonthlyActivityBlock[] = [];
  let mediaIntro = '';
  const mediaItems: MonthlyMediaItem[] = [];

  let i = 0;
  // Intro até ao primeiro "1."
  while (i < lines.length && !SECTION_RE.test(lines[i]) && !MEDIA_HEADER_RE.test(lines[i])) {
    summary = summary ? `${summary} ${lines[i]}` : lines[i];
    i += 1;
  }

  while (i < lines.length) {
    if (MEDIA_HEADER_RE.test(lines[i])) {
      i += 1;
      const introParts: string[] = [];
      while (i < lines.length && !/^publicaci[oó]n\s*\d+/i.test(lines[i]) && !SECTION_RE.test(lines[i])) {
        introParts.push(lines[i]);
        i += 1;
      }
      mediaIntro = introParts.join(' ').replace(/\s+/g, ' ').trim();
      while (i < lines.length) {
        const m = lines[i].match(/^publicaci[oó]n\s*(\d+)\s*(?:\(([^)]*)\))?\s*:\s*(.*)$/i);
        if (!m) {
          if (SECTION_RE.test(lines[i])) break;
          i += 1;
          continue;
        }
        const dateHint = (m[2] || '').trim();
        let desc = (m[3] || '').trim();
        i += 1;
        while (
          i < lines.length &&
          !/^publicaci[oó]n\s*\d+/i.test(lines[i]) &&
          !SECTION_RE.test(lines[i]) &&
          !MEDIA_HEADER_RE.test(lines[i])
        ) {
          desc = `${desc} ${lines[i]}`.trim();
          i += 1;
        }
        mediaItems.push({ dateHint, description: desc.replace(/\s+/g, ' ').trim() });
      }
      continue;
    }

    const sm = lines[i].match(SECTION_RE);
    if (!sm) {
      i += 1;
      continue;
    }
    const title = sm[2].trim();
    const codesHint = (sm[3] || '').trim();
    i += 1;

    let description = '';
    let results = '';
    let challenges = '';
    let lessons = '';
    let comments = '';

    while (i < lines.length && !SECTION_RE.test(lines[i]) && !MEDIA_HEADER_RE.test(lines[i])) {
      if (DESC_RE.test(lines[i])) {
        const got = takeField(lines, i, DESC_RE);
        description = got.text;
        i = got.next;
        continue;
      }
      if (RESULTS_RE.test(lines[i])) {
        const got = takeField(lines, i, RESULTS_RE);
        results = got.text;
        i = got.next;
        continue;
      }
      if (CHALLENGES_RE.test(lines[i])) {
        const got = takeField(lines, i, CHALLENGES_RE);
        challenges = got.text;
        i = got.next;
        continue;
      }
      if (LESSONS_RE.test(lines[i])) {
        const got = takeField(lines, i, LESSONS_RE);
        lessons = got.text;
        i = got.next;
        continue;
      }
      if (COMMENTS_RE.test(lines[i])) {
        const got = takeField(lines, i, COMMENTS_RE);
        comments = got.text;
        i = got.next;
        continue;
      }
      i += 1;
    }

    if (description || results) {
      activities.push({
        title,
        codesHint,
        description,
        results,
        challenges,
        lessons,
        comments,
      });
    }
  }

  if (activities.length < 1) return null;
  return { summary: summary.trim(), activities, mediaIntro, mediaItems };
}

export function isActivityLikeColumn(label: string | undefined): boolean {
  if (!label) return false;
  return /activit|actividad|descripci|descri[cç][aã]o|what\s+was\s+done/i.test(label);
}

export function isDateLikeColumn(label: string | undefined): boolean {
  if (!label) return false;
  return /^(date|fecha|data)\b/i.test(label.trim()) || /\bdate\b/i.test(label);
}

export function isOutcomeLikeColumn(label: string | undefined): boolean {
  if (!label) return false;
  if (/^(results?|resultados?)\b/i.test(label.trim())) return false;
  return /\boutcome\b|\boutput\b/i.test(label);
}

export function isDeliverableLikeColumn(label: string | undefined): boolean {
  if (!label) return false;
  return /deliverable|entregable/i.test(label);
}

export function isResultsLikeColumnLabel(label: string | undefined): boolean {
  if (!label) return false;
  return /^(results?|resultados?)\b/i.test(label.trim()) || /result|challenge|lesson|comment|desaf|li[cç][aã]o|coment/i.test(label);
}

export type ActivityTableCols = {
  date?: number;
  outcome?: number;
  activity?: number;
  results?: number;
  deliverable?: number;
};

export function resolveActivityTableColumns(columns: string[]): ActivityTableCols {
  const out: ActivityTableCols = {};
  columns.forEach((label, idx) => {
    if (out.activity == null && isActivityLikeColumn(label)) out.activity = idx;
    else if (out.results == null && isResultsLikeColumnLabel(label)) out.results = idx;
    else if (out.date == null && isDateLikeColumn(label)) out.date = idx;
    else if (out.outcome == null && isOutcomeLikeColumn(label)) out.outcome = idx;
    else if (out.deliverable == null && isDeliverableLikeColumn(label)) out.deliverable = idx;
  });
  // Fallback típico do formulário mensal EN: Date | Outcome | Activity | Results | …
  if (out.activity == null && columns.length >= 3) out.activity = 2;
  if (out.results == null && columns.length >= 4) out.results = 3;
  if (out.date == null && columns.length >= 1) out.date = 0;
  return out;
}

function findSection(
  canvas: ReportCanvasState,
  patterns: RegExp[],
): { id: string; title: string; columns: string[]; kind: string } | null {
  const sections = canvas.sections?.length
    ? canvas.sections
    : buildCanvasSectionsFromRegions(canvas.regions);
  for (const s of sections) {
    const title = s.title || '';
    if (patterns.some((p) => p.test(title))) {
      return { id: s.id, title, columns: s.columns || [], kind: s.kind };
    }
  }
  return null;
}

export function buildActivityCellText(block: MonthlyActivityBlock): string {
  const codes = normalizeMeCodes(block.codesHint);
  const body = block.description.trim();
  const head = block.title.trim();
  const parts: string[] = [];
  if (head) parts.push(head + (codes ? ` (${codes})` : ''));
  else if (codes) parts.push(`(${codes})`);
  if (body) parts.push(body);
  return parts.join('\n\n').trim();
}

export function buildResultsCellText(block: MonthlyActivityBlock, lang: ReportOutputLanguage): string {
  const L =
    lang === 'es'
      ? { r: 'Resultados', c: 'Desafíos', l: 'Lecciones aprendidas', o: 'Comentarios' }
      : lang === 'pt'
        ? { r: 'Resultados', c: 'Desafios', l: 'Lições aprendidas', o: 'Comentários' }
        : { r: 'Results', c: 'Challenges', l: 'Lessons learned', o: 'Comments' };

  const chunks: string[] = [];
  if (block.results.trim()) chunks.push(`${L.r}:\n${block.results.trim()}`);
  if (block.challenges.trim()) chunks.push(`${L.c}:\n- ${block.challenges.trim()}`);
  if (block.lessons.trim()) chunks.push(`${L.l}:\n- ${block.lessons.trim()}`);
  if (block.comments.trim()) chunks.push(`${L.o}:\n${block.comments.trim()}`);
  return chunks.join('\n\n');
}

type FillDraft = {
  summary: string;
  activityRows: Array<{ date: string; outcome: string; activity: string; results: string; deliverable: string }>;
  mediaIntro: string;
  mediaRows: Array<{ date: string; description: string }>;
};

function buildFillDraft(parsed: ParsedMonthlyStructuredNotes): FillDraft {
  return {
    summary: parsed.summary,
    activityRows: parsed.activities.map((b) => ({
      date: '',
      outcome: normalizeMeCodes(b.codesHint) || b.title,
      activity: buildActivityCellText(b),
      results: buildResultsCellText(b, 'en'), // labels em EN; corpo ainda no idioma fonte até traduzir
      deliverable: '',
    })),
    mediaIntro: parsed.mediaIntro,
    mediaRows: parsed.mediaItems.map((m) => ({
      date: m.dateHint,
      description: m.description,
    })),
  };
}

/** Reescreve o draft Results com rótulos no idioma pedido (corpo ainda fonte). */
function localizeResultsLabels(draft: FillDraft, lang: ReportOutputLanguage, parsed: ParsedMonthlyStructuredNotes): FillDraft {
  return {
    ...draft,
    activityRows: parsed.activities.map((b, i) => ({
      ...draft.activityRows[i],
      results: buildResultsCellText(b, lang),
    })),
  };
}

async function translateFillDraft(
  draft: FillDraft,
  outputLanguage: ReportOutputLanguage,
  model: string,
): Promise<FillDraft> {
  if (outputLanguage !== 'en' && outputLanguage !== 'es' && outputLanguage !== 'pt') return draft;
  // Se o documento for EN e o texto já parecer EN, ainda assim pedimos tradução profissional.
  const target =
    outputLanguage === 'en' ? 'English' : outputLanguage === 'es' ? 'Spanish' : 'Portuguese';

  const payload = {
    summary: draft.summary,
    activities: draft.activityRows.map((r) => ({
      activity: r.activity,
      results: r.results,
      outcome: r.outcome,
    })),
    mediaIntro: draft.mediaIntro,
    media: draft.mediaRows.map((m) => ({ date: m.date, description: m.description })),
  };

  const prompt = `You translate monthly reimbursement report content for a donor form.
Target language: ${target}.
Return ONLY valid JSON with the SAME keys/structure. Do not omit fields.

CRITICAL RULES:
1. "activity" fields are FULL narrative descriptions of what was done (who/where/when). Translate them COMPLETELY. Never replace them with only an M&E code or a short title.
2. Keep all facts, names, places, dates. Do not invent new content.
3. Preserve line breaks (\\n) in "results" blocks (Results / Challenges / Lessons learned / Comments).
4. Translate section labels inside "results" to ${target} equivalents if needed.

INPUT:
${JSON.stringify(payload)}`;

  const result = await llmGenerateContent({
    systemInstruction:
      'You are a precise translator for donor monthly reports. Output only JSON. Never shorten Activity narratives to codes.',
    userText: prompt,
    maxOutputTokens: 12000,
    model,
    temperature: 0.1,
  });

  const raw = result.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return draft;
    const parsed = JSON.parse(raw.slice(start, end + 1)) as {
      summary?: string;
      activities?: Array<{ activity?: string; results?: string; outcome?: string }>;
      mediaIntro?: string;
      media?: Array<{ date?: string; description?: string }>;
    };

    const next: FillDraft = {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : draft.summary,
      activityRows: draft.activityRows.map((row, i) => {
        const a = parsed.activities?.[i];
        const activity =
          typeof a?.activity === 'string' && a.activity.trim().length >= 40 ? a.activity.trim() : row.activity;
        return {
          ...row,
          outcome: typeof a?.outcome === 'string' && a.outcome.trim() ? a.outcome.trim() : row.outcome,
          activity,
          results: typeof a?.results === 'string' && a.results.trim() ? a.results.trim() : row.results,
        };
      }),
      mediaIntro:
        typeof parsed.mediaIntro === 'string' && parsed.mediaIntro.trim()
          ? parsed.mediaIntro.trim()
          : draft.mediaIntro,
      mediaRows: draft.mediaRows.map((row, i) => {
        const m = parsed.media?.[i];
        return {
          date: typeof m?.date === 'string' && m.date.trim() ? m.date.trim() : row.date,
          description:
            typeof m?.description === 'string' && m.description.trim()
              ? m.description.trim()
              : row.description,
        };
      }),
    };
    return next;
  } catch {
    return draft;
  }
}

function patchLongFieldByTitle(
  canvas: ReportCanvasState,
  titlePatterns: RegExp[],
  text: string,
): CanvasPatch | null {
  if (!text.trim()) return null;
  const sections = canvas.sections?.length
    ? canvas.sections
    : buildCanvasSectionsFromRegions(canvas.regions);
  const byId = new Map(canvas.regions.map((r) => [r.id, r]));
  for (const s of sections) {
    if (!titlePatterns.some((p) => p.test(s.title || ''))) continue;
    for (const id of s.regionIds) {
      const r = byId.get(id);
      if (!r) continue;
      if (r.kind === 'tableCell' || r.kind === 'cell') continue;
      return { regionId: r.id, text };
    }
  }
  // Fallback: região cujo label bate
  for (const r of canvas.regions) {
    if (r.kind === 'tableCell' || r.kind === 'cell') continue;
    const label = `${r.label || ''} ${r.tableTitle || ''}`;
    if (titlePatterns.some((p) => p.test(label))) {
      return { regionId: r.id, text };
    }
  }
  return null;
}

function buildActivityReplaceRows(
  sectionId: string,
  columns: string[],
  draft: FillDraft,
): ReplaceTableRowsPayload {
  const cols = resolveActivityTableColumns(columns);
  const rows = draft.activityRows.map((row) => {
    const cells: Array<{ tableCol: number; text?: string }> = [];
    for (let ci = 0; ci < Math.max(columns.length, 4); ci += 1) {
      let text = '';
      if (ci === cols.date) text = row.date;
      else if (ci === cols.outcome) text = row.outcome;
      else if (ci === cols.activity) text = row.activity;
      else if (ci === cols.results) text = row.results;
      else if (ci === cols.deliverable) text = row.deliverable;
      cells.push({ tableCol: ci, text });
    }
    // Garantir Activity mesmo se o índice falhar
    if (cols.activity != null) {
      const cell = cells.find((c) => c.tableCol === cols.activity);
      if (cell) cell.text = row.activity;
    }
    if (cols.results != null) {
      const cell = cells.find((c) => c.tableCol === cols.results);
      if (cell) cell.text = row.results;
    }
    return { cells };
  });
  return { sectionId, rows };
}

function buildMediaReplaceRows(
  sectionId: string,
  columns: string[],
  draft: FillDraft,
): ReplaceTableRowsPayload | null {
  if (!draft.mediaRows.length && !draft.mediaIntro) return null;
  const dateCol = columns.findIndex((c) => isDateLikeColumn(c));
  const descCol = columns.findIndex((c) =>
    /event|article|descri|coverage|titulo|t[ií]tulo|media|press|link|url/i.test(c),
  );
  const dIdx = dateCol >= 0 ? dateCol : 0;
  const tIdx = descCol >= 0 ? descCol : Math.min(1, Math.max(0, columns.length - 1));

  const rows = draft.mediaRows.map((m) => {
    const cells: Array<{ tableCol: number; text?: string }> = [];
    for (let ci = 0; ci < Math.max(columns.length, 2); ci += 1) {
      let text = '';
      if (ci === dIdx) text = m.date;
      else if (ci === tIdx) text = m.description;
      cells.push({ tableCol: ci, text });
    }
    return { cells };
  });

  if (draft.mediaIntro && rows.length) {
    // Prefixo na primeira descrição
    const first = rows[0].cells.find((c) => c.tableCol === tIdx);
    if (first) {
      first.text = `${draft.mediaIntro}\n\n${first.text || ''}`.trim();
    }
  }

  return { sectionId, rows };
}

export type StructuredMonthlyFillResult = {
  canvas: ReportCanvasState;
  applied: boolean;
  reply: string;
  tablesReplaced: number;
  patchesApplied: number;
};

/**
 * Preenche o canvas a partir de notas estruturadas (Descripción / Resultados / …)
 * sem depender do chat livre — a coluna Activity recebe a narrativa completa.
 */
export async function applyStructuredMonthlyFill(opts: {
  canvas: ReportCanvasState;
  userMessage: string;
  outputLanguage: ReportOutputLanguage;
  locale: 'pt' | 'es' | 'en';
  model: string;
}): Promise<StructuredMonthlyFillResult | null> {
  const parsed = parseStructuredMonthlyNotes(opts.userMessage);
  if (!parsed) return null;

  let draft = localizeResultsLabels(buildFillDraft(parsed), opts.outputLanguage, parsed);
  draft = await translateFillDraft(draft, opts.outputLanguage, opts.model);

  // Segurança: Activity nunca pode ficar só com código/título curto
  draft.activityRows = draft.activityRows.map((row, i) => {
    if (row.activity.trim().length >= 80) return row;
    const fallback = buildActivityCellText(parsed.activities[i]);
    return { ...row, activity: fallback.length >= row.activity.length ? fallback : row.activity };
  });

  const replaceTableRows: ReplaceTableRowsPayload[] = [];
  const patches: CanvasPatch[] = [];

  const activitiesSec = findSection(opts.canvas, [
    /monthly\s+relevant\s+activit/i,
    /actividades?\s+relevantes/i,
    /actividades?\s+do\s+m[eê]s/i,
  ]);
  if (activitiesSec) {
    replaceTableRows.push(
      buildActivityReplaceRows(activitiesSec.id, activitiesSec.columns, draft),
    );
  }

  const mediaSec = findSection(opts.canvas, [
    /media\s*[&\/]?\s*press/i,
    /cobertura\s+(de\s+)?(medios|imprensa|prensa)/i,
  ]);
  if (mediaSec) {
    const mediaRows = buildMediaReplaceRows(mediaSec.id, mediaSec.columns, draft);
    if (mediaRows) replaceTableRows.push(mediaRows);
  }

  const paymentPatch = patchLongFieldByTitle(
    opts.canvas,
    [/payment\s+justification/i, /justificaci[oó]n\s+(del\s+)?pago/i, /justifica(ç|c)[aã]o\s+(do\s+)?pagamento/i],
    draft.summary,
  );
  if (paymentPatch) patches.push(paymentPatch);

  if (!replaceTableRows.length && !patches.length) return null;

  const canvas = applyCopilotCanvasUpdate(
    opts.canvas,
    patches,
    [],
    [],
    [],
    replaceTableRows,
  );

  // Verificar se Activity ficou preenchida
  let activityOk = true;
  if (activitiesSec) {
    const sections = canvas.sections?.length
      ? canvas.sections
      : buildCanvasSectionsFromRegions(canvas.regions);
    const sec = sections.find((s) => s.id === activitiesSec.id);
    const byId = new Map(canvas.regions.map((r) => [r.id, r]));
    const cols = resolveActivityTableColumns(sec?.columns || activitiesSec.columns);
    if (cols.activity != null && sec) {
      const activityCells = sec.regionIds
        .map((id) => byId.get(id))
        .filter((r) => r && r.tableCol === cols.activity);
      activityOk = activityCells.some((r) => (r?.text || '').trim().length >= 60);
    }
  }

  const replyEs = activityOk
    ? `Listo: reescribí la tabla MONTHLY RELEVANT ACTIVITIES con la descripción completa en la columna Activity (qué se hizo, con quién, dónde y cuándo), y Results/Challenges/Lessons/Comments en la columna Results. También actualicé Payment Justification Summary y Media & Press cuando existían en la plantilla.`
    : `Apliqué tu texto estructurado, pero revisa la columna Activity en el canvas: debe mostrar la narración completa, no solo el código M&E.`;

  const replyPt = activityOk
    ? `Pronto: reescrevi a tabela MONTHLY RELEVANT ACTIVITIES com a descrição completa na coluna Activity (o que foi feito, com quem, onde e quando), e Results/Challenges/Lessons/Comments na coluna Results. Também atualizei Payment Justification Summary e Media & Press quando existiam no modelo.`
    : `Apliquei o teu texto estruturado, mas confere a coluna Activity no canvas: deve mostrar a narrativa completa, não só o código M&E.`;

  const replyEn = activityOk
    ? `Done: I rewrote MONTHLY RELEVANT ACTIVITIES with the full narrative in the Activity column (what/who/where/when), and Results/Challenges/Lessons/Comments in the Results column. I also updated Payment Justification Summary and Media & Press when present.`
    : `I applied your structured text, but please check the Activity column: it must show the full narrative, not only the M&E code.`;

  const reply = opts.locale === 'es' ? replyEs : opts.locale === 'en' ? replyEn : replyPt;

  return {
    canvas,
    applied: true,
    reply,
    tablesReplaced: replaceTableRows.length,
    patchesApplied: patches.length,
  };
}
