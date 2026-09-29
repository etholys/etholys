/**
 * AURORA — diagnóstico dinâmico (escalável).
 * Metodologia das matrizes Etholys (maturidade 1–5 + situação real + brecha/potencial),
 * sem planilha nem quiz de cartões.
 */

import type { AuroraLocale, AuroraMessage } from './aurora-interview';

export const AURORA_DIAGNOSTIC_KEY = '__auroraDiagnostic';

export type AuroraMaturity = 1 | 2 | 3 | 4 | 5;

export type AuroraDiagBlockId =
  | 'governance'
  | 'finance'
  | 'operations'
  | 'people'
  | 'commercial'
  | 'systems';

export type AuroraDiagBlockDef = {
  id: AuroraDiagBlockId;
  label: Record<AuroraLocale, string>;
  /** O que o diálogo deve explorar neste bloco (não são opções de quiz). */
  focus: Record<AuroraLocale, string[]>;
  opening: Record<AuroraLocale, string>;
};

/** Escala das matrizes: caos → padronizado (não Likert). */
export const AURORA_MATURITY: Record<
  AuroraMaturity,
  { short: Record<AuroraLocale, string>; line: Record<AuroraLocale, string> }
> = {
  1: {
    short: { es: 'Caos', pt: 'Caos', en: 'Chaos' },
    line: {
      es: '1 — Caos / inexistente: reactivo, sin registros, apaga incendios.',
      pt: '1 — Caos / inexistente: reativo, sem registos, apaga fogos.',
      en: '1 — Chaos / missing: reactive, no records, firefighting.',
    },
  },
  2: {
    short: { es: 'Informal', pt: 'Informal', en: 'Informal' },
    line: {
      es: '2 — Informal / reactivo: oral, en la cabeza de alguien, sin método.',
      pt: '2 — Informal / reativo: oral, na cabeça de alguém, sem método.',
      en: '2 — Informal / reactive: oral, in someone’s head, no method.',
    },
  },
  3: {
    short: { es: 'Depende del dueño', pt: 'Depende do dono', en: 'Owner-dependent' },
    line: {
      es: '3 — Funciona, pero depende de los dueños o de una persona clave.',
      pt: '3 — Funciona, mas depende dos donos ou de uma pessoa-chave.',
      en: '3 — It works, but depends on the owners or one key person.',
    },
  },
  4: {
    short: { es: 'Estructurado', pt: 'Estruturado', en: 'Structured' },
    line: {
      es: '4 — Estructurado / documentado: hay método, se puede medir.',
      pt: '4 — Estruturado / documentado: há método, dá para medir.',
      en: '4 — Structured / documented: there is a method, it can be measured.',
    },
  },
  5: {
    short: { es: 'Estandarizado', pt: 'Padronizado', en: 'Standardized' },
    line: {
      es: '5 — Estandarizado / optimizado: replica sin el dueño encima.',
      pt: '5 — Padronizado / otimizado: replica sem o dono em cima.',
      en: '5 — Standardized / optimized: runs without the owner on top.',
    },
  },
};

export const AURORA_DIAG_BLOCKS: AuroraDiagBlockDef[] = [
  {
    id: 'governance',
    label: { es: 'Dirección', pt: 'Direção', en: 'Direction' },
    focus: {
      es: [
        'plan o rumbo a 12 meses',
        'quién decide y dónde se traba',
        'si el negocio puede operar unos días sin el dueño encima',
      ],
      pt: [
        'plano ou rumo a 12 meses',
        'quem decide e onde trava',
        'se o negócio aguenta dias sem o dono em cima',
      ],
      en: [
        '12-month plan or direction',
        'who decides and where it bottlenecks',
        'whether it can run a few days without the owner',
      ],
    },
    opening: {
      es: 'Contame cómo se decide el rumbo del negocio: ¿hay un plan, o se vive del día a día?',
      pt: 'Conta como se decide o rumo do negócio: há um plano, ou vive-se o dia a dia?',
      en: 'Tell me how the business sets direction: is there a plan, or is it day-to-day?',
    },
  },
  {
    id: 'finance',
    label: { es: 'Dinero', pt: 'Dinheiro', en: 'Money' },
    focus: {
      es: ['cómo registran ingresos y gastos', 'si conocen costos y margen', 'flujo de caja y cuentas separadas'],
      pt: ['como registam receitas e despesas', 'se conhecem custos e margem', 'fluxo de caixa e contas separadas'],
      en: ['how they record income and costs', 'whether they know unit cost and margin', 'cash flow and separate accounts'],
    },
    opening: {
      es: 'Hablemos del dinero: ¿cómo saben si el mes da o no da? Contame en sus palabras.',
      pt: 'Falemos do dinheiro: como sabem se o mês dá ou não? Conta nas palavras deles.',
      en: 'Let’s talk money: how do they know if the month works? In their words.',
    },
  },
  {
    id: 'operations',
    label: { es: 'Operación', pt: 'Operação', en: 'Operations' },
    focus: {
      es: ['cómo producen o entregan', 'calidad y mermas', 'si el proceso está solo en una cabeza'],
      pt: ['como produzem ou entregam', 'qualidade e perdas', 'se o processo está só numa cabeça'],
      en: ['how they produce or deliver', 'quality and waste', 'whether the process lives in one head'],
    },
    opening: {
      es: '¿Cómo sale el producto o el servicio al cliente? ¿Qué se rompe o se pierde en el camino?',
      pt: 'Como sai o produto ou o serviço ao cliente? O que se parte ou se perde pelo caminho?',
      en: 'How does the product or service reach the customer? What breaks or gets lost along the way?',
    },
  },
  {
    id: 'people',
    label: { es: 'Personas', pt: 'Pessoas', en: 'People' },
    focus: {
      es: ['roles claros', 'cómo entra gente nueva', 'rotación e incentivos'],
      pt: ['papéis claros', 'como entra gente nova', 'rotação e incentivos'],
      en: ['clear roles', 'how new people join', 'turnover and incentives'],
    },
    opening: {
      es: '¿Quién hace qué? ¿Si alguien falta mañana, el negocio se para?',
      pt: 'Quem faz o quê? Se alguém faltar amanhã, o negócio para?',
      en: 'Who does what? If someone is missing tomorrow, does the business stop?',
    },
  },
  {
    id: 'commercial',
    label: { es: 'Clientes', pt: 'Clientes', en: 'Customers' },
    focus: {
      es: ['de dónde vienen los clientes', 'canales de venta', 'si miden satisfacción o solo esperan'],
      pt: ['de onde vêm os clientes', 'canais de venda', 'se medem satisfação ou só esperam'],
      en: ['where customers come from', 'sales channels', 'whether they measure satisfaction or just wait'],
    },
    opening: {
      es: '¿De dónde salen las ventas? ¿Cómo encuentran y retienen clientes?',
      pt: 'De onde saem as vendas? Como encontram e retêm clientes?',
      en: 'Where do sales come from? How do they find and keep customers?',
    },
  },
  {
    id: 'systems',
    label: { es: 'Datos', pt: 'Dados', en: 'Data' },
    focus: {
      es: ['herramientas que usan (cuaderno, Excel, app)', 'si usan números para decidir', 'trazabilidad básica'],
      pt: ['ferramentas que usam (caderno, Excel, app)', 'se usam números para decidir', 'rastreio básico'],
      en: ['tools they use (notebook, Excel, app)', 'whether numbers drive decisions', 'basic traceability'],
    },
    opening: {
      es: '¿Dónde vive la información del negocio? ¿Cuaderno, cabeza, Excel, sistema?',
      pt: 'Onde vive a informação do negócio? Caderno, cabeça, Excel, sistema?',
      en: 'Where does business information live? Notebook, someone’s head, Excel, a system?',
    },
  },
];

export type AuroraDiagPending = {
  reply: string;
  ready: boolean;
  level: AuroraMaturity | null;
  situation: string;
  gap: string;
  potential: string;
};

export type AuroraDiagBlockState = {
  id: AuroraDiagBlockId;
  status: 'empty' | 'active' | 'done';
  level: AuroraMaturity | null;
  situation: string;
  gap: string;
  potential: string;
  messages: AuroraMessage[];
  pending: AuroraDiagPending | null;
  confirmedAt: string | null;
};

export type AuroraDiagnosticState = {
  version: 1;
  activeBlockId: AuroraDiagBlockId | null;
  blocks: Record<AuroraDiagBlockId, AuroraDiagBlockState>;
  updatedAt: string;
};

const THREAD_CAP = 16;

export function emptyDiagBlock(id: AuroraDiagBlockId): AuroraDiagBlockState {
  return {
    id,
    status: 'empty',
    level: null,
    situation: '',
    gap: '',
    potential: '',
    messages: [],
    pending: null,
    confirmedAt: null,
  };
}

export function emptyAuroraDiagnostic(): AuroraDiagnosticState {
  const blocks = {} as Record<AuroraDiagBlockId, AuroraDiagBlockState>;
  for (const def of AURORA_DIAG_BLOCKS) blocks[def.id] = emptyDiagBlock(def.id);
  return {
    version: 1,
    activeBlockId: null,
    blocks,
    updatedAt: new Date().toISOString(),
  };
}

export function getDiagBlockDef(id: AuroraDiagBlockId): AuroraDiagBlockDef {
  return AURORA_DIAG_BLOCKS.find((b) => b.id === id) || AURORA_DIAG_BLOCKS[0]!;
}

export function diagProgress(state: AuroraDiagnosticState): {
  done: number;
  total: number;
  complete: boolean;
  gaps: string[];
  potentials: string[];
  avgLevel: number | null;
} {
  const total = AURORA_DIAG_BLOCKS.length;
  const doneBlocks = AURORA_DIAG_BLOCKS.map((b) => state.blocks[b.id]).filter((b) => b?.status === 'done');
  const levels = doneBlocks.map((b) => b.level).filter((n): n is AuroraMaturity => n != null);
  const avgLevel = levels.length ? Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 10) / 10 : null;
  return {
    done: doneBlocks.length,
    total,
    complete: doneBlocks.length >= total,
    gaps: doneBlocks.map((b) => b.gap).filter(Boolean).slice(0, 5),
    potentials: doneBlocks.map((b) => b.potential).filter(Boolean).slice(0, 3),
    avgLevel,
  };
}

function asMaturity(raw: unknown): AuroraMaturity | null {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return null;
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function asMessage(raw: unknown): AuroraMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const role = (raw as { role?: unknown }).role;
  const text = clip((raw as { text?: unknown }).text, 4000);
  if ((role !== 'user' && role !== 'assistant') || !text) return null;
  return { role, text };
}

export function readAuroraDiagnostic(interviewJson: unknown): AuroraDiagnosticState {
  const base = emptyAuroraDiagnostic();
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return base;
  const raw = (interviewJson as Record<string, unknown>)[AURORA_DIAGNOSTIC_KEY];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;
  const active = o.activeBlockId;
  const activeBlockId =
    typeof active === 'string' && AURORA_DIAG_BLOCKS.some((b) => b.id === active)
      ? (active as AuroraDiagBlockId)
      : null;
  const rawBlocks = o.blocks && typeof o.blocks === 'object' && !Array.isArray(o.blocks) ? (o.blocks as Record<string, unknown>) : {};
  for (const def of AURORA_DIAG_BLOCKS) {
    const b = rawBlocks[def.id];
    if (!b || typeof b !== 'object') continue;
    const row = b as Record<string, unknown>;
    const status = row.status === 'active' || row.status === 'done' || row.status === 'empty' ? row.status : 'empty';
    const pendingRaw = row.pending && typeof row.pending === 'object' ? (row.pending as Record<string, unknown>) : null;
    base.blocks[def.id] = {
      id: def.id,
      status,
      level: asMaturity(row.level),
      situation: clip(row.situation, 2000),
      gap: clip(row.gap, 400),
      potential: clip(row.potential, 400),
      messages: Array.isArray(row.messages)
        ? row.messages.map(asMessage).filter((m): m is AuroraMessage => Boolean(m)).slice(-THREAD_CAP)
        : [],
      pending: pendingRaw
        ? {
            reply: clip(pendingRaw.reply, 800),
            ready: pendingRaw.ready === true,
            level: asMaturity(pendingRaw.level),
            situation: clip(pendingRaw.situation, 2000),
            gap: clip(pendingRaw.gap, 400),
            potential: clip(pendingRaw.potential, 400),
          }
        : null,
      confirmedAt: clip(row.confirmedAt, 40) || null,
    };
  }
  base.activeBlockId = activeBlockId;
  base.updatedAt = clip(o.updatedAt, 40) || base.updatedAt;
  return base;
}

export function auroraDiagnosticPatch(state: AuroraDiagnosticState): Record<string, unknown> {
  return {
    [AURORA_DIAGNOSTIC_KEY]: {
      ...state,
      updatedAt: new Date().toISOString(),
    },
  };
}

export function normalizeDiagPending(raw: unknown, locale: AuroraLocale): AuroraDiagPending {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const level = asMaturity(o.level);
  const situation = clip(o.situation, 2000);
  const ready = o.ready === true && level != null && situation.length >= 24;
  const fallback =
    locale === 'es'
      ? 'Contame un ejemplo concreto de cómo funciona hoy — sin teoría.'
      : locale === 'en'
        ? 'Give one concrete example of how it works today — no theory.'
        : 'Dá um exemplo concreto de como funciona hoje — sem teoria.';
  return {
    reply: clip(o.reply, 800) || fallback,
    ready,
    level: ready ? level : level,
    situation,
    gap: clip(o.gap, 400),
    potential: clip(o.potential, 400),
  };
}

export function parseAuroraDiagJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('invalid');
  return JSON.parse(cleaned.slice(start, end + 1));
}

export function auroraDiagSystemPrompt(locale: AuroraLocale): string {
  const lang = locale === 'es' ? 'espanhol' : locale === 'en' ? 'inglês' : 'português';
  return `És o diagnóstico dinâmico Etholys (AURORA com técnico, ou POLARIS com o negócio sozinho).

Objetivo: radiografar UM bloco do negócio com maturidade 1–5 (caos → padronizado), evidência real, uma brecha e um potencial.
NÃO és um formulário Likert, NÃO dás opções A/B/C, NÃO inventas score /100.

Regras:
- Reply em ${lang}, máximo 45 palavras: uma pergunta de follow-up OU um espelho curto do que ouviste.
- ready=true só quando já há evidência concreta (24+ caracteres) e podes propor level 1–5.
- Sem inventar factos. Se faltar evidência, ready=false e pergunta mais.
- gap e potential: uma frase cada, só com evidência da conversa; podem ir vazios até ready.
- Máximo 2 voltas de pergunta antes de propor nível, se já houver matéria suficiente.
- Fala na segunda pessoa com quem está na conversa (técnico ou dono).

JSON só:
{"reply":"","ready":false,"level":null,"situation":"","gap":"","potential":""}`;
}

export function auroraDiagUserPayload(input: {
  companyName: string;
  activity: string;
  locale: AuroraLocale;
  block: AuroraDiagBlockDef;
  blockState: AuroraDiagBlockState;
  message: string;
}): string {
  const loc = input.locale;
  const focus = input.block.focus[loc].map((f, i) => `${i + 1}. ${f}`).join('\n');
  const ladder = ([1, 2, 3, 4, 5] as AuroraMaturity[]).map((n) => AURORA_MATURITY[n].line[loc]).join('\n');
  const talk = [...input.blockState.messages, { role: 'user' as const, text: input.message }]
    .map((m) => `${m.role === 'assistant' ? 'AURORA' : 'Eles'}: ${m.text}`)
    .join('\n');
  return [
    `Empresa: ${input.companyName || '—'}`,
    input.activity ? `Atividade: ${input.activity}` : '',
    `Bloco: ${input.block.label[loc]} (${input.block.id})`,
    `Foco do bloco:\n${focus}`,
    `Escala:\n${ladder}`,
    `Conversa deste bloco:\n${talk}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function startDiagBlock(state: AuroraDiagnosticState, blockId: AuroraDiagBlockId, locale: AuroraLocale): AuroraDiagnosticState {
  const next = structuredClone(state) as AuroraDiagnosticState;
  for (const def of AURORA_DIAG_BLOCKS) {
    const b = next.blocks[def.id];
    if (b.status === 'active' && def.id !== blockId) b.status = b.level ? 'done' : 'empty';
  }
  const block = next.blocks[blockId];
  const opening = getDiagBlockDef(blockId).opening[locale];
  block.status = 'active';
  block.pending = null;
  if (!block.messages.length) {
    block.messages = [{ role: 'assistant', text: opening }];
  }
  next.activeBlockId = blockId;
  return next;
}

export function applyDiagTurn(
  state: AuroraDiagnosticState,
  blockId: AuroraDiagBlockId,
  userText: string,
  pending: AuroraDiagPending,
): AuroraDiagnosticState {
  const next = structuredClone(state) as AuroraDiagnosticState;
  const block = next.blocks[blockId];
  block.status = 'active';
  block.messages = [
    ...block.messages,
    { role: 'user', text: userText.slice(0, 4000) },
    { role: 'assistant', text: pending.reply },
  ].slice(-THREAD_CAP);
  block.pending = pending;
  next.activeBlockId = blockId;
  return next;
}

export function confirmDiagBlock(
  state: AuroraDiagnosticState,
  blockId: AuroraDiagBlockId,
  input: { level: AuroraMaturity; situation: string; gap: string; potential: string },
): AuroraDiagnosticState {
  const next = structuredClone(state) as AuroraDiagnosticState;
  const block = next.blocks[blockId];
  block.status = 'done';
  block.level = input.level;
  block.situation = input.situation.slice(0, 2000);
  block.gap = input.gap.slice(0, 400);
  block.potential = input.potential.slice(0, 400);
  block.pending = null;
  block.confirmedAt = new Date().toISOString();
  next.activeBlockId = blockId;
  return next;
}

export function nextEmptyBlockId(state: AuroraDiagnosticState): AuroraDiagBlockId | null {
  for (const def of AURORA_DIAG_BLOCKS) {
    if (state.blocks[def.id]?.status !== 'done') return def.id;
  }
  return null;
}
