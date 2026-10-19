/**
 * Perguntas fechadas do diagnóstico AURORA.
 * Cada resposta abre só a pergunta seguinte. O bloco fecha com situação, nível, brecha e potencial.
 */

import type { AuroraLocale } from './aurora-interview';

export type AuroraScriptBlockId =
  | 'governance'
  | 'finance'
  | 'operations'
  | 'people'
  | 'commercial'
  | 'systems';

export type AuroraScriptMaturity = 1 | 2 | 3 | 4 | 5;

type L = Record<AuroraLocale, string>;

export type AuroraScriptStep = {
  id: string;
  kind: 'yesno' | 'text' | 'number' | 'years' | 'choice';
  prompt: L;
  options?: { id: string; label: L }[];
};

const yn = (pt: string, es: string, en: string): L => ({ pt, es, en });

const FINANCE: AuroraScriptStep[] = [
  {
    id: 'makes_money',
    kind: 'yesno',
    prompt: yn(
      'A empresa já ganha dinheiro?',
      '¿La empresa ya gana dinero?',
      'Does the business already make money?',
    ),
  },
  {
    id: 'years',
    kind: 'years',
    prompt: yn(
      'Marca os anos em que sabes o faturamento e coloca o valor de cada um.',
      'Marcá los años en los que sabés la facturación y poné el valor de cada uno.',
      'Mark the years you know the revenue for and enter each amount.',
    ),
  },
  {
    id: 'controls',
    kind: 'yesno',
    prompt: yn(
      'Controlas o dinheiro que entra e o que sai?',
      '¿Controlás el dinero que entra y el que sale?',
      'Do you control the money coming in and going out?',
    ),
  },
  {
    id: 'how',
    kind: 'text',
    prompt: yn(
      'Como controlas? Caderno, cabeça, planilha, sistema — diz como é hoje.',
      '¿Cómo lo controlás? Cuaderno, cabeza, planilla, sistema — contá cómo es hoy.',
      'How do you control it? Notebook, memory, spreadsheet, a system — say how it works today.',
    ),
  },
];

const GOVERNANCE: AuroraScriptStep[] = [
  {
    id: 'plan_12',
    kind: 'yesno',
    prompt: yn(
      'Há um plano escrito para os próximos 12 meses?',
      '¿Hay un plan escrito para los próximos 12 meses?',
      'Is there a written plan for the next 12 months?',
    ),
  },
  {
    id: 'who',
    kind: 'text',
    prompt: yn(
      'Quem decide o que se faz esta semana, e onde isso trava?',
      '¿Quién decide lo que se hace esta semana, y dónde se traba?',
      'Who decides what gets done this week, and where does it get stuck?',
    ),
  },
  {
    id: 'away',
    kind: 'yesno',
    prompt: yn(
      'O negócio aguenta uma semana sem o dono no comando?',
      '¿El negocio aguanta una semana sin el dueño al mando?',
      'Can the business run a week without the owner in charge?',
    ),
  },
];

const OPERATIONS: AuroraScriptStep[] = [
  {
    id: 'deliver',
    kind: 'text',
    prompt: yn(
      'O que vendem e como isso sai até o cliente?',
      '¿Qué venden y cómo llega eso al cliente?',
      'What do they sell, and how does it reach the customer?',
    ),
  },
  {
    id: 'loss',
    kind: 'text',
    prompt: yn(
      'Onde se perde produto, tempo ou dinheiro nesse caminho?',
      '¿Dónde se pierde producto, tiempo o dinero en ese camino?',
      'Where are product, time or money lost along the way?',
    ),
  },
  {
    id: 'written',
    kind: 'yesno',
    prompt: yn(
      'Esse processo está escrito, ou só na cabeça de alguém?',
      '¿Ese proceso está escrito, o solo en la cabeza de alguien?',
      'Is that process written down, or only in someone’s head?',
    ),
  },
];

const PEOPLE: AuroraScriptStep[] = [
  {
    id: 'headcount',
    kind: 'number',
    prompt: yn(
      'Quantas pessoas trabalham, além de quem decide?',
      '¿Cuántas personas trabajan, además de quien decide?',
      'How many people work, besides the person who decides?',
    ),
  },
  {
    id: 'stops',
    kind: 'yesno',
    prompt: yn(
      'Se uma pessoa falta amanhã, o negócio para?',
      'Si falta una persona mañana, ¿el negocio se para?',
      'If one person is absent tomorrow, does the business stop?',
    ),
  },
  {
    id: 'roles',
    kind: 'yesno',
    prompt: yn(
      'Cada pessoa tem uma função escrita?',
      '¿Cada persona tiene una función escrita?',
      'Does each person have a written role?',
    ),
  },
];

const COMMERCIAL: AuroraScriptStep[] = [
  {
    id: 'channel',
    kind: 'choice',
    prompt: yn(
      'De onde vem a maior parte das vendas?',
      '¿De dónde sale la mayor parte de las ventas?',
      'Where do most sales come from?',
    ),
    options: [
      { id: 'direct', label: yn('Venda direta', 'Venta directa', 'Direct sales') },
      { id: 'fair', label: yn('Feira ou mercado', 'Feria o mercado', 'Market or fair') },
      { id: 'middle', label: yn('Intermediário', 'Intermediario', 'Middleman') },
      { id: 'contract', label: yn('Contrato fixo', 'Contrato fijo', 'Fixed contract') },
    ],
  },
  {
    id: 'knows_count',
    kind: 'yesno',
    prompt: yn(
      'Sabem quantos clientes compraram no último mês?',
      '¿Saben cuántos clientes compraron el último mes?',
      'Do they know how many customers bought last month?',
    ),
  },
  {
    id: 'count',
    kind: 'text',
    prompt: yn(
      'Quantos foram, e como é que contam isso?',
      '¿Cuántos fueron, y cómo lo cuentan?',
      'How many, and how do they count them?',
    ),
  },
];

const SYSTEMS: AuroraScriptStep[] = [
  {
    id: 'where',
    kind: 'choice',
    prompt: yn(
      'Onde vive a informação do negócio?',
      '¿Dónde vive la información del negocio?',
      'Where does the business information live?',
    ),
    options: [
      { id: 'head', label: yn('Na cabeça', 'En la cabeza', 'In someone’s head') },
      { id: 'notebook', label: yn('Caderno', 'Cuaderno', 'Notebook') },
      { id: 'sheet', label: yn('Planilha', 'Planilla', 'Spreadsheet') },
      { id: 'system', label: yn('Sistema', 'Sistema', 'System') },
    ],
  },
  {
    id: 'decide',
    kind: 'yesno',
    prompt: yn(
      'Usam esses números para decidir?',
      '¿Usan esos números para decidir?',
      'Do they use those numbers to decide?',
    ),
  },
];

const SCRIPTS: Record<AuroraScriptBlockId, AuroraScriptStep[]> = {
  finance: FINANCE,
  governance: GOVERNANCE,
  operations: OPERATIONS,
  people: PEOPLE,
  commercial: COMMERCIAL,
  systems: SYSTEMS,
};

export function scriptSteps(blockId: AuroraScriptBlockId): AuroraScriptStep[] {
  return SCRIPTS[blockId];
}

export function scriptStep(blockId: AuroraScriptBlockId, stepId: string | null | undefined): AuroraScriptStep | null {
  if (!stepId) return null;
  return SCRIPTS[blockId].find((s) => s.id === stepId) || null;
}

export function firstScriptStep(blockId: AuroraScriptBlockId): AuroraScriptStep {
  return SCRIPTS[blockId][0]!;
}

function yes(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (['yes', 'sim', 'sí', 'si', 's', 'true', '1'].includes(v)) return true;
  if (['no', 'não', 'nao', 'n', 'false', '0'].includes(v)) return false;
  return null;
}

function clip(value: string, max: number) {
  return value.trim().slice(0, max);
}

export type AuroraScriptFacts = Record<string, string>;

export type AuroraScriptAdvance = {
  facts: AuroraScriptFacts;
  nextStep: string | null;
  echo: string;
  reply: string;
  ready: boolean;
  level: AuroraScriptMaturity | null;
  situation: string;
  gap: string;
  potential: string;
  error: string | null;
};

function t(locale: AuroraLocale, pt: string, es: string, en: string) {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

function optionLabel(step: AuroraScriptStep, id: string, locale: AuroraLocale) {
  return step.options?.find((o) => o.id === id)?.label[locale] || id;
}

function revenueLines(raw: string): Array<{ year: string; amount: string }> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    return Object.entries(parsed as Record<string, unknown>)
      .map(([year, amount]) => ({ year: year.trim(), amount: String(amount ?? '').trim() }))
      .filter((row) => /^\d{4}$/.test(row.year) && row.amount.length > 0)
      .slice(0, 8);
  } catch {
    return [];
  }
}

function closeFinance(facts: AuroraScriptFacts, locale: AuroraLocale): Pick<AuroraScriptAdvance, 'level' | 'situation' | 'gap' | 'potential'> {
  const money = facts.makes_money === 'yes';
  const controls = facts.controls === 'yes';
  const how = facts.how || '';
  const years = revenueLines(facts.years || '');
  const yearText = years.map((r) => `${r.year}: ${r.amount}`).join('; ');
  const structured = /excel|planilha|planilla|sistema|software|app|folha/i.test(how);
  let level: AuroraScriptMaturity = 2;
  if (!money && !controls) level = 1;
  else if (money && !controls) level = 2;
  else if (controls && structured) level = 4;
  else if (controls) level = 3;

  const situation = money
    ? t(
        locale,
        `Já fatura${yearText ? ` (${yearText})` : ''}. ${controls ? `Controla entradas e saídas: ${how || 'sem detalhe'}.` : 'Não controla o que entra e o que sai.'}`,
        `Ya factura${yearText ? ` (${yearText})` : ''}. ${controls ? `Controla entradas y salidas: ${how || 'sin detalle'}.` : 'No controla lo que entra y lo que sale.'}`,
        `Already earns${yearText ? ` (${yearText})` : ''}. ${controls ? `Controls in and out: ${how || 'no detail'}.` : 'Does not control money in and out.'}`,
      )
    : t(
        locale,
        `Ainda não fatura. ${controls ? `Mesmo assim controla o que entra e sai: ${how || 'sem detalhe'}.` : 'Não controla o que entra e o que sai.'}`,
        `Todavía no factura. ${controls ? `Igual controla lo que entra y sale: ${how || 'sin detalle'}.` : 'No controla lo que entra y lo que sale.'}`,
        `Does not earn yet. ${controls ? `Still controls in and out: ${how || 'no detail'}.` : 'Does not control money in and out.'}`,
      );

  const gap = !controls
    ? t(locale, 'Não há controlo do que entra e do que sai.', 'No hay control de lo que entra y lo que sale.', 'There is no control of money in and out.')
    : structured
      ? t(locale, 'O controlo existe, mas ainda depende de quem o faz.', 'El control existe, pero todavía depende de quien lo hace.', 'Control exists, but it still depends on who does it.')
      : t(locale, 'O controlo é informal e não chega para decidir com número.', 'El control es informal y no alcanza para decidir con número.', 'Control is informal and not enough to decide with numbers.');

  const potential = years.length
    ? t(locale, 'Já há anos com valor — dá para ver se o negócio cresce.', 'Ya hay años con valor — se puede ver si el negocio crece.', 'Some years already have amounts — growth can be seen.')
    : controls
      ? t(locale, 'Quem controla o caixa pode passar isso a um registo estável.', 'Quien controla la caja puede pasarlo a un registro estable.', 'Whoever controls cash can move that into a stable record.')
      : t(locale, 'Separar o que entra e o que sai é o primeiro passo, mesmo sem faturar.', 'Separar lo que entra y lo que sale es el primer paso, aunque no facture.', 'Separating money in and out is the first step, even without revenue.');

  return { level, situation: clip(situation, 2000), gap: clip(gap, 400), potential: clip(potential, 400) };
}

function closeGeneric(
  blockId: AuroraScriptBlockId,
  facts: AuroraScriptFacts,
  locale: AuroraLocale,
): Pick<AuroraScriptAdvance, 'level' | 'situation' | 'gap' | 'potential'> {
  const bits = Object.entries(facts)
    .filter(([, v]) => v && v !== 'yes' && v !== 'no')
    .map(([, v]) => v)
    .join(' · ');
  const yesCount = Object.values(facts).filter((v) => v === 'yes').length;
  const noCount = Object.values(facts).filter((v) => v === 'no').length;
  let level: AuroraScriptMaturity = 3;
  if (noCount >= 2 && yesCount === 0) level = 1;
  else if (noCount > yesCount) level = 2;
  else if (yesCount >= 2) level = 4;
  else level = 3;

  const label =
    blockId === 'governance'
      ? t(locale, 'Direção', 'Dirección', 'Direction')
      : blockId === 'operations'
        ? t(locale, 'Operação', 'Operación', 'Operations')
        : blockId === 'people'
          ? t(locale, 'Pessoas', 'Personas', 'People')
          : blockId === 'commercial'
            ? t(locale, 'Clientes', 'Clientes', 'Customers')
            : t(locale, 'Dados', 'Datos', 'Data');

  const situation = clip(`${label}: ${bits || t(locale, 'respostas registadas no diálogo.', 'respuestas registradas en el diálogo.', 'answers recorded in the dialogue.')}`, 2000);
  const gap =
    level <= 2
      ? t(locale, `${label} ainda depende de improviso.`, `${label} todavía depende de improvisación.`, `${label} still depends on improvisation.`)
      : t(locale, `${label} funciona, mas ainda não está estável sem uma pessoa.`, `${label} funciona, pero todavía no es estable sin una persona.`, `${label} works, but it is not yet stable without one person.`);
  const potential = t(
    locale,
    `Há matéria concreta em ${label.toLowerCase()} para um passo do plano.`,
    `Hay materia concreta en ${label.toLowerCase()} para un paso del plan.`,
    `There is concrete material in ${label.toLowerCase()} for one plan step.`,
  );
  return { level, situation, gap: clip(gap, 400), potential: clip(potential, 400) };
}

function nextId(blockId: AuroraScriptBlockId, stepId: string, facts: AuroraScriptFacts): string | null {
  if (blockId === 'finance') {
    if (stepId === 'makes_money') return facts.makes_money === 'yes' ? 'years' : 'controls';
    if (stepId === 'years') return 'controls';
    if (stepId === 'controls') return facts.controls === 'yes' ? 'how' : null;
    return null;
  }
  if (blockId === 'commercial') {
    if (stepId === 'channel') return 'knows_count';
    if (stepId === 'knows_count') return facts.knows_count === 'yes' ? 'count' : null;
    return null;
  }
  const steps = SCRIPTS[blockId];
  const idx = steps.findIndex((s) => s.id === stepId);
  if (idx < 0 || idx >= steps.length - 1) return null;
  return steps[idx + 1]!.id;
}

export function answerDiagScript(input: {
  blockId: AuroraScriptBlockId;
  stepId: string;
  facts: AuroraScriptFacts;
  answer: string;
  locale: AuroraLocale;
}): AuroraScriptAdvance {
  const step = scriptStep(input.blockId, input.stepId);
  const baseFacts = { ...input.facts };
  if (!step) {
    return {
      facts: baseFacts,
      nextStep: null,
      echo: '',
      reply: '',
      ready: false,
      level: null,
      situation: '',
      gap: '',
      potential: '',
      error: 'step',
    };
  }

  const raw = input.answer.trim();
  let stored = '';
  let echo = '';

  if (step.kind === 'yesno') {
    const v = yes(raw);
    if (v == null) {
      return fail(baseFacts, step.id, t(input.locale, 'Responde sim ou não.', 'Respondé sí o no.', 'Answer yes or no.'));
    }
    stored = v ? 'yes' : 'no';
    echo = v ? t(input.locale, 'Sim', 'Sí', 'Yes') : t(input.locale, 'Não', 'No', 'No');
  } else if (step.kind === 'years') {
    const rows = revenueLines(raw);
    if (!rows.length) {
      return fail(
        baseFacts,
        step.id,
        t(input.locale, 'Marca pelo menos um ano e o valor.', 'Marcá al menos un año y el valor.', 'Mark at least one year and the amount.'),
      );
    }
    stored = JSON.stringify(Object.fromEntries(rows.map((r) => [r.year, r.amount.slice(0, 40)])));
    echo = rows.map((r) => `${r.year}: ${r.amount}`).join('; ');
  } else if (step.kind === 'number') {
    if (!/^\d{1,6}$/.test(raw)) {
      return fail(baseFacts, step.id, t(input.locale, 'Indica o número.', 'Indicá el número.', 'Enter the number.'));
    }
    stored = String(Number(raw));
    echo = stored;
  } else if (step.kind === 'choice') {
    const opt = step.options?.find((o) => o.id === raw);
    if (!opt) return fail(baseFacts, step.id, t(input.locale, 'Escolhe uma opção.', 'Elegí una opción.', 'Pick one option.'));
    stored = opt.id;
    echo = opt.label[input.locale];
  } else {
    if (raw.length < 2) {
      return fail(baseFacts, step.id, t(input.locale, 'Escreve como é, em poucas palavras.', 'Escribí cómo es, en pocas palabras.', 'Write how it is, in a few words.'));
    }
    stored = clip(raw, 500);
    echo = stored;
  }

  const facts = { ...baseFacts, [step.id]: stored };
  if (step.kind === 'choice') facts[`${step.id}_label`] = echo;
  const next = nextId(input.blockId, step.id, facts);
  if (next) {
    const nxt = scriptStep(input.blockId, next)!;
    return {
      facts,
      nextStep: next,
      echo,
      reply: nxt.prompt[input.locale],
      ready: false,
      level: null,
      situation: '',
      gap: '',
      potential: '',
      error: null,
    };
  }

  const closed = input.blockId === 'finance' ? closeFinance(facts, input.locale) : closeGeneric(input.blockId, facts, input.locale);
  return {
    facts,
    nextStep: null,
    echo,
    reply: t(
      input.locale,
      'Com isto fecho o bloco. Confirma o nível e a situação — podes corrigir antes de seguir.',
      'Con esto cierro el bloque. Confirmá el nivel y la situación — podés corregir antes de seguir.',
      'This closes the block. Confirm the level and the situation — you can correct them before continuing.',
    ),
    ready: true,
    ...closed,
    error: null,
  };
}

function fail(facts: AuroraScriptFacts, stepId: string, reply: string): AuroraScriptAdvance {
  return {
    facts,
    nextStep: stepId,
    echo: '',
    reply,
    ready: false,
    level: null,
    situation: '',
    gap: '',
    potential: '',
    error: 'invalid',
  };
}

export function recentRevenueYears(now = new Date()): number[] {
  const y = now.getFullYear();
  return [y - 4, y - 3, y - 2, y - 1, y];
}
