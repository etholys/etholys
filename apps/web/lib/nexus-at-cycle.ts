/**
 * Ciclo real de assistência técnica NEXUS.
 *
 * 1) Setor económico + o que se vende (produto / serviço / ambos)
 * 2) Diagnóstico 360 do perfil (brechas, potenciais, maturidade)
 * 3) Análise quantitativa + qualitativa → documento
 * 4) Plano de desenvolvimento (ações, contratações, compras, datas, indicadores)
 * 5) O contrato decide se o ciclo fecha ou volta: permanente / projeto / pontual
 *
 * Quadrantes 360 (e as falhas clássicas desta visão):
 * - Estruturação — formalização, modelo, decisão. Falta frequentemente governança e território.
 * - Gestão interna — financeiro, contabilístico, pessoas. Falta informação/decisão e compras.
 * - Produção — primária, secundária e terciária (serviço). Tratar «produção» como um bloco é o buraco.
 * - Comercial — canais, preço, pós-venda. Falta relação contínua vs venda pontual.
 */

import type { DxLocale } from './nexus-sector-diagnostic';

export type AtOfferKind = 'product' | 'service' | 'both';

/** O contrato — não o diagnóstico — decide se o processo faz loop. */
export type AtContractKind = 'permanent' | 'project' | 'punctual';

export type AtQuadId = 'structuring' | 'management' | 'production' | 'commercial';

export type AtQuadScore = {
  id: AtQuadId;
  score: number;
  answered: number;
  reading: string;
};

export type AtCycleStepId =
  | 'sector_offer'
  | 'diagnosis_360'
  | 'document'
  | 'development_plan'
  | 'execute'
  | 'annual_or_close';

export const AT_CYCLE_STEPS: Array<{
  id: AtCycleStepId;
  es: string;
  pt: string;
  en: string;
}> = [
  { id: 'sector_offer', es: 'Sector y oferta', pt: 'Setor e oferta', en: 'Sector and offer' },
  { id: 'diagnosis_360', es: 'Diagnóstico 360', pt: 'Diagnóstico 360', en: '360 diagnosis' },
  { id: 'document', es: 'Documento (quanti + quali)', pt: 'Documento (quanti + quali)', en: 'Document (quanti + quali)' },
  { id: 'development_plan', es: 'Plan de desarrollo', pt: 'Plano de desenvolvimento', en: 'Development plan' },
  { id: 'execute', es: 'Ejecución / módulo', pt: 'Execução / módulo', en: 'Execution / module' },
  { id: 'annual_or_close', es: 'Ciclo anual o cierre', pt: 'Ciclo anual ou fecho', en: 'Annual cycle or close' },
];

export const AT_CONTRACT_LABELS: Record<
  AtContractKind,
  { es: string; pt: string; en: string; desc: { es: string; pt: string; en: string } }
> = {
  permanent: {
    es: 'Cliente directo / permanente',
    pt: 'Cliente direto / permanente',
    en: 'Direct / permanent client',
    desc: {
      es: 'Cada año: análisis del año + plan anual. De vez en cuando se repite el diagnóstico 360.',
      pt: 'Cada ano: análise do ano + plano anual. De vez em quando repete-se o diagnóstico 360.',
      en: 'Each year: year review + annual plan. Periodically repeat the 360 diagnosis.',
    },
  },
  project: {
    es: 'Proyecto (plazo)',
    pt: 'Projeto (prazo)',
    en: 'Project (time-boxed)',
    desc: {
      es: 'Diagnóstico → documento → plan de desarrollo → entrega. Cierra al cumplir el contrato.',
      pt: 'Diagnóstico → documento → plano de desenvolvimento → entrega. Fecha ao cumprir o contrato.',
      en: 'Diagnosis → document → development plan → delivery. Closes when the contract is met.',
    },
  },
  punctual: {
    es: 'Servicio puntual',
    pt: 'Serviço pontual',
    en: 'One-off service',
    desc: {
      es: 'Una pasada: diagnóstico + plan. No hay loop salvo nuevo contrato.',
      pt: 'Uma passagem: diagnóstico + plano. Sem loop salvo novo contrato.',
      en: 'One pass: diagnosis + plan. No loop unless a new contract.',
    },
  },
};

export const AT_QUAD_LABELS: Record<AtQuadId, { es: string; pt: string; en: string }> = {
  structuring: { es: 'Estructuración', pt: 'Estruturação', en: 'Structuring' },
  management: { es: 'Gestión interna', pt: 'Gestão interna', en: 'Internal management' },
  production: { es: 'Producción (1ª / 2ª / 3ª)', pt: 'Produção (1ª / 2ª / 3ª)', en: 'Production (1st / 2nd / 3rd)' },
  commercial: { es: 'Comercial', pt: 'Comercial', en: 'Commercial' },
};

export function inferOfferKind(answerIds: Record<string, string> | null | undefined): AtOfferKind | null {
  const raw = String(answerIds?.core_offer || '').trim();
  if (raw === 'product' || raw === 'service' || raw === 'both') return raw;
  return null;
}

export function contractLoops(kind: AtContractKind): {
  loops: boolean;
  annualReview: boolean;
  rediagnoseAfterMonths: number | null;
} {
  if (kind === 'permanent') return { loops: true, annualReview: true, rediagnoseAfterMonths: 12 };
  if (kind === 'project') return { loops: false, annualReview: false, rediagnoseAfterMonths: null };
  return { loops: false, annualReview: false, rediagnoseAfterMonths: null };
}

export function quadForQuestion(q: { id: string; section?: string; pillarSlug?: string }): AtQuadId {
  const id = q.id || '';
  if (q.section === 'commercial' || q.pillarSlug === 'commercial') return 'commercial';
  if (/sales|market|b2b|precio|venta|com_/.test(id)) return 'commercial';
  if (q.section === 'production' || id.startsWith('prod_')) return 'production';
  if (q.section === 'sector' && !/sales|market|b2b|precio|venta/.test(id)) return 'production';
  if (
    q.pillarSlug === 'finance' ||
    q.pillarSlug === 'people' ||
    q.pillarSlug === 'digital' ||
    id.startsWith('lvl_cash') ||
    id.startsWith('lvl_account') ||
    id.startsWith('lvl_margin') ||
    id.startsWith('lvl_people') ||
    id.startsWith('lvl_records') ||
    id.startsWith('lvl_dependency')
  ) {
    return 'management';
  }
  return 'structuring';
}

function L(es: string, pt: string, en: string, locale: DxLocale) {
  if (locale === 'pt') return pt;
  if (locale === 'en') return en;
  return es;
}

export function qualitativeQuadReading(id: AtQuadId, score: number, locale: DxLocale): string {
  const weak = score < 50;
  const mid = score < 72;
  switch (id) {
    case 'structuring':
      return weak
        ? L(
            'Cualitativo: el negocio existe más en la cabeza del dueño que en una estructura. Formalización, roles y modelo aún son frágiles.',
            'Qualitativo: o negócio existe mais na cabeça do dono do que numa estrutura. Formalização, papéis e modelo ainda são frágeis.',
            'Qualitative: the business lives more in the owner’s head than in a structure. Formalization, roles and model are still fragile.',
            locale
          )
        : mid
          ? L(
              'Cualitativo: hay base de empresa, pero la estructuración no aguanta un año sin el técnico o el dueño.',
              'Qualitativo: há base de empresa, mas a estruturação não aguenta um ano sem o técnico ou o dono.',
              'Qualitative: there is a company base, but structuring will not last a year without the technician or owner.',
              locale
            )
          : L(
              'Cualitativo: hay empresa — el salto es gobernanza (quién decide, con qué dato) y no más formularios.',
              'Qualitativo: há empresa — o salto é governança (quem decide, com que dado) e não mais formulários.',
              'Qualitative: there is a company — the leap is governance (who decides, with what data), not more forms.',
              locale
            );
    case 'management':
      return weak
        ? L(
            'Cualitativo: caja, contabilidad y gente se manejan por urgencia. Sin registro, el plan anual es adivinanza.',
            'Qualitativo: caixa, contabilidade e gente gerem-se por urgência. Sem registo, o plano anual é adivinhação.',
            'Qualitative: cash, accounts and people run on urgency. Without records, the annual plan is a guess.',
            locale
          )
        : mid
          ? L(
              'Cualitativo: hay hábitos (caja, márgen a ojo). Falta el vínculo entre finanzas, personas y decisiones semanales.',
              'Qualitativo: há hábitos (caixa, margem a olho). Falta o vínculo entre finanças, pessoas e decisões semanais.',
              'Qualitative: there are habits (cash, margin by feel). The link between finance, people and weekly decisions is missing.',
              locale
            )
          : L(
              'Cualitativo: la gestión interna ya permite un plan anual con indicadores — no solo un listado de tareas.',
              'Qualitativo: a gestão interna já permite um plano anual com indicadores — não só uma lista de tarefas.',
              'Qualitative: internal management already allows an annual plan with indicators — not just a task list.',
              locale
            );
    case 'production':
      return weak
        ? L(
            'Cualitativo: la producción (primaria, transformación o servicio) no está medida. El módulo sectorial es el primer instrumento, no un extra.',
            'Qualitativo: a produção (primária, transformação ou serviço) não está medida. O módulo setorial é o primeiro instrumento, não um extra.',
            'Qualitative: production (primary, processing or service) is unmeasured. The sector module is the first instrument, not an extra.',
            locale
          )
        : mid
          ? L(
              'Cualitativo: hay oficio, poco cuaderno. Primaria / secundaria / terciaria se mezclan y se pierden mermas y calidad.',
              'Qualitativo: há ofício, pouco caderno. Primária / secundária / terciária misturam-se e perdem-se perdas e qualidade.',
              'Qualitative: there is craft, little book. Primary / secondary / tertiary blur and waste and quality are lost.',
              locale
            )
          : L(
              'Cualitativo: hay control de lo que se produce o atiende. El salto es umbral + lote + evidencia para vender mejor.',
              'Qualitativo: há controlo do que se produz ou atende. O salto é limiar + lote + evidência para vender melhor.',
              'Qualitative: what is produced or served is under control. The leap is threshold + lot + evidence to sell better.',
              locale
            );
    case 'commercial':
      return weak
        ? L(
            'Cualitativo: se vende cuando aparece un comprador. Sin canal, precio con costo y postventa, el plan comercial es un deseo.',
            'Qualitativo: vende-se quando aparece um comprador. Sem canal, preço com custo e pós-venda, o plano comercial é um desejo.',
            'Qualitative: sales happen when a buyer appears. Without channel, cost-based price and after-sales, the commercial plan is a wish.',
            locale
          )
        : mid
          ? L(
              'Cualitativo: hay canal habitual, pero el precio y la relación no están escritos. El volumen no se puede planear.',
              'Qualitativo: há canal habitual, mas o preço e a relação não estão escritos. O volume não se pode planear.',
              'Qualitative: there is a habitual channel, but price and relationship are unwritten. Volume cannot be planned.',
              locale
            )
          : L(
              'Cualitativo: hay rutina comercial. El salto es contrato / frecuencia / margen por canal — no más ferias sueltas.',
              'Qualitativo: há rotina comercial. O salto é contrato / frequência / margem por canal — não mais feiras soltas.',
              'Qualitative: there is a commercial routine. The leap is contract / frequency / margin by channel — not more one-off fairs.',
              locale
            );
  }
}

export function scoreAtQuads(
  rows: Array<{ questionId: string; score: number; pillarSlug?: string; section?: string }>,
  locale: DxLocale
): AtQuadScore[] {
  const acc = new Map<AtQuadId, { w: number; n: number }>();
  for (const id of Object.keys(AT_QUAD_LABELS) as AtQuadId[]) acc.set(id, { w: 0, n: 0 });
  for (const r of rows) {
    const qid = r.questionId;
    const quad = quadForQuestion({ id: qid, section: r.section, pillarSlug: r.pillarSlug });
    const cur = acc.get(quad)!;
    cur.w += r.score;
    cur.n += 1;
  }
  return (Object.keys(AT_QUAD_LABELS) as AtQuadId[]).map((id) => {
    const cur = acc.get(id)!;
    const score = cur.n > 0 ? Math.round(cur.w / cur.n) : 0;
    return {
      id,
      score,
      answered: cur.n,
      reading: qualitativeQuadReading(id, score, locale),
    };
  });
}

export function atCycleStepLabel(id: AtCycleStepId, locale: DxLocale): string {
  const row = AT_CYCLE_STEPS.find((s) => s.id === id);
  if (!row) return id;
  return locale === 'pt' ? row.pt : locale === 'en' ? row.en : row.es;
}
