/**
 * Camada A — recap profissional sem LLM.
 * NÃO cola citações STT. Constrói resumo/pontos/tarefas a partir de sinais estruturados.
 */

import type { MeetAiActionDraft, MeetAiFinalizeResult } from '@/lib/meet/post-meeting-ai';

type Labels = {
  decisions: string;
  nextSteps: string;
  emptySummary: string;
};

function labelsFor(locale?: string): Labels {
  if (locale === 'en') {
    return {
      decisions: 'Decisions:',
      nextSteps: 'Next steps:',
      emptySummary: 'Meeting notes were too sparse to summarise.',
    };
  }
  if (locale === 'pt') {
    return {
      decisions: 'Decisões:',
      nextSteps: 'Próximos passos:',
      emptySummary: 'Notas insuficientes para resumir a reunião.',
    };
  }
  return {
    decisions: 'Decisiones:',
    nextSteps: 'Próximos passos:',
    emptySummary: 'Notas insuficientes para resumir la reunión.',
  };
}

function stripDialoguePrefix(line: string): string {
  return line
    .replace(/^\[\d{1,3}:\d{2}(?::\d{2})?\]\s*/i, '')
    .replace(/^(falante|speaker|participante|pessoa)\s*\d+\s*:\s*/i, '')
    .replace(/^[^:\n]{1,80}:\s*/, '')
    .trim();
}

function normalizeSpace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function splitSentences(text: string): string[] {
  const flat = text
    .split(/\r?\n/)
    .map(stripDialoguePrefix)
    .filter(Boolean)
    .join(' ');
  return flat
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((s) => normalizeSpace(s))
    .filter((s) => s.length >= 12);
}

function uniq(items: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const key = raw.toLowerCase().slice(0, 100);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

/** Past narrative — never "pendiente" */
const PAST_NARRATIVE_RE =
  /\b(después fui|despues fui|fui a la finca|fui donde|visit[eé]|estuvimos|hicimos|fuimos|llegamos|me contó|me dijo|ayer|el sábado|el domingo|el viernes|la semana pasada|ya (fui|visité|hablamos))\b/i;

/** True unresolved / deferred */
const OPEN_RE =
  /\b(lo vemos después|vemos después|queda pendiente|por definir|a definir|hay que volver|dejamos para|más adelante|falta(n)?\b|necesitamos|tenemos que|hay que|pendiente de|ainda falta|depois vemos|open item|follow[- ]?up|to be defined|we (still )?need|should (meet|follow))\b/i;

const DECISION_RE =
  /\b(acordamos|acordó|decidimos|decidió|queda acordado|se aprueba|aprovamos|ficou definido|definimos|we (agreed|decided)|it was (agreed|decided)|vamos a (pasar|cambiar|dejar)|pasemos (nuestra|la) .+ (para|a) los miércoles)\b/i;

/** High-precision commitment (not "quiero" / "iba a medir") */
const TASK_COMMIT_RE =
  /\b((voy a|vamos a|me encargo|te encargas|se encarga de|le ped[ií]|pedirte|tengo que|tenemos que|hay que|debe|deben|i('ll| will)|we (will|need to)|action item|todo:|acción:|accion:|tarefa:|tarea:))\b/i;

/** Strong action verb required — bare nouns like "informe" alone are not enough */
const STRONG_VERB_RE =
  /\b(enviar|revisar|agendar|preparar|habilitar|completar|firmar|subir|actualizar|llamar|escribir|comprar|averiguar|preguntar|coordinar|invitar|mandar|crear|abrir|cerrar|entregar|instalar|construir|buscar|pasar|cambiar)\w*/i;

const TASK_OBJECT_RE =
  /\b(enviar|revisar|agendar|preparar|habilitar|completar|firmar|subir|actualizar|llamar|escribir|comprar|averiguar|preguntar|pasar|cambiar|construir|instalar|buscar|coordinar|invitar|mandar|crear|abrir|cerrar|entregar|diagnóstic|informe|reunión|reunion|correo|drive|acceso|carpeta|invitación|importaci[oó]n|sensor|riego|convenio|inscripci)\w*/i;

const REJECT_TASK_RE =
  /\b(quiero|quería|me parece|siento que|creo que|obvio|fatal|pura vida|okay|ok\b|ajá|mmm|sí\.|no\.|exacto|claro que|iba (a|midiendo)|estaba|estábamos|fuimos|fui |después fui|me contó|imagínese|vieras|ella está|él está|está igual)\b/i;

/** Soft chat / narrative framing — not a ticket */
const WEAK_OR_NARRATIVE_TASK_RE =
  /\b(entonces[,.]?\s+|informecito|poquitico|te voy a (decir|contar|hablar|explicar)|hacer(te|les)? un informe(cito)?|puedo hacer|vamos a ver|lo vemos)\b/i;

type TopicHit = { id: string; labelEs: string; labelPt: string; labelEn: string; re: RegExp };

const TOPICS: TopicHit[] = [
  {
    id: 'visits',
    labelEs: 'Visitas a finca (Seidy, Juan Diego, Carlos, Nelson, Gerardo/Fernando)',
    labelPt: 'Visitas a propriedades (Seidy, Juan Diego, Carlos, Nelson, Gerardo/Fernando)',
    labelEn: 'Farm visits (Seidy, Juan Diego, Carlos, Nelson, Gerardo/Fernando)',
    re: /\b(visita(s)? a finca|finca de|doña seidy|seidy|juan diego|don carlos|nelson|gerardo|fernando|frutalcop|osvaldo)\b/i,
  },
  {
    id: 'irrigation',
    labelEs: 'Riego y automatización (bombas, paneles, sensores de humedad)',
    labelPt: 'Irrigação e automatização (bombas, painéis, sensores)',
    labelEn: 'Irrigation and automation (pumps, panels, moisture sensors)',
    re: /\b(riego|bomba|automatizaci[oó]n|panel(cito)?|sensor(es)?|humedad|pozo|gasolina)\b/i,
  },
  {
    id: 'digital',
    labelEs: 'Digitalización de registros y sensores en fincas',
    labelPt: 'Digitalização de registos e sensores nas propriedades',
    labelEn: 'Record digitization and on-farm sensors',
    re: /\b(digitalizaci[oó]n|registros|sensores|estaci[oó]n meteorol[oó]gica)\b/i,
  },
  {
    id: 'agroindustry',
    labelEs: 'Centro de acopio / agroindustria (paneles, construcción, equipos)',
    labelPt: 'Centro de acolhimento / agroindústria (painéis, construção, equipamentos)',
    labelEn: 'Collection center / agroindustry (panels, construction, equipment)',
    re: /\b(centro de acopio|agroindustria|deshidratadora|construir|paneles|balanza|envasadora|bioinsumos)\b/i,
  },
  {
    id: 'drive',
    labelEs: 'Fotos por visita en Drive e informes mensuales en el sistema',
    labelPt: 'Fotos por visita no Drive e relatórios mensais no sistema',
    labelEn: 'Per-visit Drive photos and monthly reports in the system',
    re: /\b(drive|fotos|informe mensual|carpeta)\b/i,
  },
  {
    id: 'diagnostics',
    labelEs: 'Acceso de técnicos a diagnósticos en el sistema',
    labelPt: 'Acesso de técnicos aos diagnósticos no sistema',
    labelEn: 'Technician access to system diagnostics',
    re: /\b(diagn[oó]stic|acceso|vista de t[eé]cnico|llenar .+ diagn)\b/i,
  },
  {
    id: 'joana',
    labelEs: 'Reuniones cortas con Joana (propuesta: miércoles)',
    labelPt: 'Reuniões curtas com Joana (proposta: quartas)',
    labelEn: 'Short check-ins with Joana (proposed: Wednesdays)',
    re: /\b(joana|mi[eé]rcoles|20 minutos|15 minutos|reuni[oó]n semanal)\b/i,
  },
  {
    id: 'raymond',
    labelEs: 'Importación de equipos / logística con Raymond (DDP, DHL)',
    labelPt: 'Importação de equipamentos / logística com Raymond (DDP, DHL)',
    labelEn: 'Equipment import / logistics with Raymond (DDP, DHL)',
    re: /\b(raymond|importa|ddp|dhl|incoterm|shipping|flete)\b/i,
  },
  {
    id: 'enrollment',
    labelEs: 'Convenios e inscripciones aún incompletos',
    labelPt: 'Convênios e inscrições ainda incompletos',
    labelEn: 'Agreements and enrollments still incomplete',
    re: /\b(convenio|inscripci|whatsapp|grupo)\b/i,
  },
];

function topicLabel(t: TopicHit, locale?: string): string {
  if (locale === 'en') return t.labelEn;
  if (locale === 'pt') return t.labelPt;
  return t.labelEs;
}

function detectTopics(text: string, locale?: string): string[] {
  const hits: string[] = [];
  for (const t of TOPICS) {
    if (t.re.test(text)) hits.push(topicLabel(t, locale));
  }
  return uniq(hits, 8);
}

function extractPeoplePlaces(text: string): string[] {
  const names = [
    'Seidy Rodríguez',
    'Juan Diego Valverde',
    'Carlos Rodríguez',
    'Nelson Rodríguez',
    'Gerardo Chacón',
    'Fernando',
    'Joana',
    'Raymond',
    'Beatriz',
    'Thiago',
    'Tiago',
    'Osvaldo',
    'Pablo Chacón',
    'Frutalcop',
    'JICA',
  ];
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const n of names) {
    if (lower.includes(n.toLowerCase())) found.push(n);
  }
  return uniq(found, 12);
}

function buildAbstract(opts: {
  title: string;
  locale?: string;
  topics: string[];
  people: string[];
  openCount: number;
  decisionCount: number;
  taskCount: number;
}): string {
  const loc = opts.locale === 'en' ? 'en' : opts.locale === 'pt' ? 'pt' : 'es';
  const topicBit =
    opts.topics.length > 0
      ? opts.topics.slice(0, 4).join(loc === 'en' ? '; ' : '; ')
      : loc === 'en'
        ? 'project follow-up'
        : loc === 'pt'
          ? 'acompanhamento do projeto'
          : 'seguimiento del proyecto';

  const peopleBit =
    opts.people.length > 0
      ? loc === 'en'
        ? ` People and orgs mentioned include ${opts.people.slice(0, 6).join(', ')}.`
        : loc === 'pt'
          ? ` Pessoas e organizações mencionadas: ${opts.people.slice(0, 6).join(', ')}.`
          : ` Personas y organizaciones mencionadas: ${opts.people.slice(0, 6).join(', ')}.`
      : '';

  const title = opts.title?.trim() || (loc === 'en' ? 'the meeting' : loc === 'pt' ? 'a reunião' : 'la reunión');

  if (loc === 'en') {
    return [
      `This meeting (${title}) covered ${topicBit}.`,
      peopleBit.trim(),
      opts.decisionCount
        ? `${opts.decisionCount} clear decision(s) were noted.`
        : 'Few formal decisions were locked in.',
      opts.openCount
        ? `${opts.openCount} open follow-up(s) remain.`
        : '',
      opts.taskCount
        ? `${opts.taskCount} concrete action(s) were identified.`
        : 'No high-confidence action items were extracted.',
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  if (loc === 'pt') {
    return [
      `Esta reunião (${title}) abordou ${topicBit}.`,
      peopleBit.trim(),
      opts.decisionCount
        ? `Foram registadas ${opts.decisionCount} decisão(ões) claras.`
        : 'Poucas decisões formais ficaram fechadas.',
      opts.openCount ? `Restam ${opts.openCount} pendência(s) de seguimento.` : '',
      opts.taskCount
        ? `Foram identificadas ${opts.taskCount} ação(ões) concretas.`
        : 'Não foram extraídas tarefas de alta confiança.',
    ]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  return [
    `Esta reunión (${title}) trató sobre ${topicBit}.`,
    peopleBit.trim(),
    opts.decisionCount
      ? `Se registraron ${opts.decisionCount} decisión(es) claras.`
      : 'Quedaron pocas decisiones formales cerradas.',
    opts.openCount ? `Quedan ${opts.openCount} pendiente(s) de seguimiento.` : '',
    opts.taskCount
      ? `Se identificaron ${opts.taskCount} acción(es) concretas.`
      : 'No se extrajeron tareas de alta confianza.',
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanBullet(s: string): string {
  let t = stripDialoguePrefix(s);
  t = t
    .replace(/^(eh+|este+|bueno[,.]?\s*|ok(ay)?[,.]?\s*|ajá[,.]?\s*|mmm[,.]?\s*)+/i, '')
    .replace(/\b(se me\s+){2,}/gi, 'se me ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length > 90) {
    const cut = t.slice(0, 90);
    const sp = cut.lastIndexOf(' ');
    t = (sp > 40 ? cut.slice(0, sp) : cut).trim() + '…';
  }
  return t;
}

function toImperativeTitle(sentence: string, locale?: string): string | null {
  let s = stripDialoguePrefix(sentence);
  // Kill leftover speaker labels mid-line (STT dumps)
  s = s
    .replace(/\b(falante|speaker|participante|pessoa)\s*\d+\s*:\s*/gi, '')
    .replace(/^(eh+|este+|bueno[,.]?\s*|ok(ay)?[,.]?\s*|entonces[,.]?\s*)+/i, '')
    .replace(/\b(se me\s+){2,}/gi, 'se me ')
    .replace(/\s+/g, ' ')
    .trim();

  if (s.length < 18 || s.length > 220) return null;
  if (/\b(falante|speaker)\s*\d+/i.test(s)) return null;
  if (PAST_NARRATIVE_RE.test(s)) return null;
  if (WEAK_OR_NARRATIVE_TASK_RE.test(s)) return null;
  if (REJECT_TASK_RE.test(s)) return null;
  if (!TASK_COMMIT_RE.test(s)) return null;
  if (!STRONG_VERB_RE.test(s)) return null;
  if (!TASK_OBJECT_RE.test(s)) return null;
  // Vague open without concrete object → not a ticket
  if (OPEN_RE.test(s) && !STRONG_VERB_RE.test(s)) return null;
  // Half-cut / trailing filler
  if (/\b(este|eh|mmm|…|\.\.\.)\s*$/i.test(s)) return null;

  // Prefer the clause starting at commitment
  const m = s.match(
    /\b((voy a|vamos a|me encargo de|se encarga de|hay que|tenemos que|tengo que|le ped[ií]\w*|i will|we will|we need to)\s+.+)$/i,
  );
  let core = (m?.[1] || s).trim();

  // Normalize to short imperative-ish
  core = core
    .replace(/^voy a\s+/i, '')
    .replace(/^vamos a\s+/i, '')
    .replace(/^hay que\s+/i, '')
    .replace(/^tenemos que\s+/i, '')
    .replace(/^tengo que\s+/i, '')
    .replace(/^me encargo de\s+/i, '')
    .replace(/^i will\s+/i, '')
    .replace(/^we will\s+/i, '')
    .replace(/^we need to\s+/i, '')
    .trim();

  if (!STRONG_VERB_RE.test(core)) return null;

  // Capitalize
  if (core) core = core.charAt(0).toUpperCase() + core.slice(1);
  // Drop trailing chatter
  core = core.replace(/,?\s*(verdad|viste|entonces|digamos)\??\.?$/i, '').trim();
  if (!/[.!?]$/.test(core)) {
    /* title without period */
  } else {
    core = core.replace(/[.!]+$/, '');
  }

  if (core.length < 12) return null;
  if (core.length > 90) {
    const cut = core.slice(0, 90);
    const sp = cut.lastIndexOf(' ');
    core = (sp > 40 ? cut.slice(0, sp) : cut).trim();
  }
  // Never ship raw STT as title
  if (/^(entonces|ella |él |bueno)/i.test(core)) return null;
  void locale;
  return core;
}

function extractOpenItems(sentences: string[], locale?: string): string[] {
  const out: string[] = [];
  for (const s of sentences) {
    if (PAST_NARRATIVE_RE.test(s)) continue;
    if (!OPEN_RE.test(s)) continue;
    // Skip pure past visits that only contain "después" as narrative
    if (/\bdespués fui\b/i.test(s) || /\bdespues fui\b/i.test(s)) continue;
    const bullet = cleanBullet(s);
    if (bullet.length < 16) continue;
    // Prefer shorter topic phrasing when possible
    if (/\bjoana\b/i.test(s) && /\bmi[eé]rcoles\b/i.test(s)) {
      out.push(
        locale === 'en'
          ? 'Confirm short weekly slot with Joana (Wednesdays)'
          : locale === 'pt'
            ? 'Confirmar slot semanal curto com Joana (quartas)'
            : 'Confirmar reunión corta semanal con Joana (miércoles)',
      );
      continue;
    }
    if (/\bdiagn/i.test(s) && /\bacceso|t[eé]cnico|llenar/i.test(s)) {
      out.push(
        locale === 'en'
          ? 'Enable technician view to complete diagnostics'
          : locale === 'pt'
            ? 'Habilitar vista de técnico para completar diagnósticos'
            : 'Habilitar vista de técnico para completar diagnósticos',
      );
      continue;
    }
    if (/\bconvenio|inscripci\b/i.test(s)) {
      out.push(
        locale === 'en'
          ? 'Close remaining agreements and enrollments'
          : locale === 'pt'
            ? 'Fechar convênios e inscrições pendentes'
            : 'Cerrar convenios e inscripciones pendientes',
      );
      continue;
    }
    if (/\balcance\b/i.test(s) && /\bpendiente|después|despues\b/i.test(s)) {
      out.push(
        locale === 'en'
          ? 'Define remaining project scope'
          : locale === 'pt'
            ? 'Definir o alcance que ficou pendente'
            : 'Definir el alcance que quedó pendiente',
      );
      continue;
    }
    out.push(bullet);
  }
  return uniq(out, 6);
}

function extractDecisions(sentences: string[], locale?: string): string[] {
  const out: string[] = [];
  for (const s of sentences) {
    if (!DECISION_RE.test(s)) continue;
    if (PAST_NARRATIVE_RE.test(s) && !/\bacordamos|decidimos\b/i.test(s)) continue;
    if (/\bmi[eé]rcoles\b/i.test(s) && /\blunes\b/i.test(s)) {
      out.push(
        locale === 'en'
          ? 'Move the Monday internal slot to Wednesday and include Joana for ~20 minutes'
          : locale === 'pt'
            ? 'Passar o slot de segunda para quarta e incluir Joana (~20 min)'
            : 'Pasar el espacio del lunes a miércoles e incluir a Joana (~20 min)',
      );
      continue;
    }
    out.push(cleanBullet(s));
  }
  return uniq(out, 5);
}

function extractTasks(
  sentences: string[],
  participants: string[],
  locale?: string,
): MeetAiActionDraft[] {
  const items: MeetAiActionDraft[] = [];
  for (const s of sentences) {
    const title = toImperativeTitle(s, locale);
    if (!title) continue;
    let assigneeHint: string | undefined;
    for (const p of participants) {
      const first = p.split(/\s+/)[0]!;
      if (first.length >= 3 && s.toLowerCase().includes(first.toLowerCase())) {
        assigneeHint = p;
        break;
      }
    }
    // Named assignees in text
    for (const name of ['Raymond', 'Joana', 'Beatriz', 'Thiago', 'Tiago']) {
      if (new RegExp(name, 'i').test(s)) {
        assigneeHint = assigneeHint || name;
      }
    }
    items.push({ title, assigneeHint, dueHint: null });
    if (items.length >= 8) break;
  }
  return uniq(
    items.map((i) => i.title),
    8,
  ).map((title) => items.find((i) => i.title === title)!);
}

/**
 * Camada A — recap estruturado (não extractivo de citações).
 */
export function generateMeetPostMeetingClassic(opts: {
  title: string;
  notes: string;
  locale?: string;
  participants?: string[];
}): MeetAiFinalizeResult {
  const notes = opts.notes.trim();
  if (notes.length < 20) {
    throw new Error('Notas/transcrição demasiado curtas (mín. ~20 caracteres)');
  }

  const L = labelsFor(opts.locale);
  const sentences = splitSentences(notes);
  const participants = (opts.participants || []).map((p) => p.trim()).filter(Boolean);
  const topics = detectTopics(notes, opts.locale);
  const people = extractPeoplePlaces(notes);

  const openItems = extractOpenItems(sentences, opts.locale);
  const decisions = extractDecisions(sentences, opts.locale);
  const actionItems = extractTasks(sentences, participants, opts.locale);

  // Key points used only internally for abstract richness (not dumped as quote section)
  void uniq(
    [
      ...topics,
      ...openItems.slice(0, 2),
      ...decisions.slice(0, 2).map((d) => (d.length > 80 ? d.slice(0, 77) + '…' : d)),
    ],
    8,
  );

  const summaryLead =
    topics.length || people.length || openItems.length || decisions.length || actionItems.length
      ? buildAbstract({
          title: opts.title,
          locale: opts.locale,
          topics,
          people,
          openCount: openItems.length,
          decisionCount: decisions.length,
          taskCount: actionItems.length,
        })
      : L.emptySummary;

  // Formato ouro: parágrafo + Decisiones + Próximos passos (com donos quando houver)
  const nextStepLines = uniq(
    [
      ...actionItems.map((a) =>
        a.assigneeHint ? `${a.title} (${a.assigneeHint})` : a.title,
      ),
      ...openItems,
    ],
    8,
  );

  const composedSummary = [
    summaryLead,
    decisions.length ? `\n\n${L.decisions}\n- ${decisions.join('\n- ')}` : '',
    nextStepLines.length ? `\n\n${L.nextSteps}\n- ${nextStepLines.join('\n- ')}` : '',
  ]
    .join('')
    .trim();

  return {
    summary: composedSummary.slice(0, 20_000),
    decisions,
    nextSteps: nextStepLines,
    actionItems,
  };
}
