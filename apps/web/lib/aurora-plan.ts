/**
 * Plano de melhoria AURORA.
 * Nasce do diagnóstico, o técnico ajusta, e só depois a empresa atendida vê o que foi revisto em conjunto.
 */

import type { AuroraLocale } from './aurora-interview';
import { AURORA_DIAG_BLOCKS, type AuroraDiagBlockId, type AuroraDiagnosticState } from './aurora-diagnostic';

export const AURORA_PLAN_KEY = '__auroraPlan';

export type AuroraPlanOffer = 'purchase' | 'radar' | 'forge' | 'partner' | 'fundhub' | 'practice';
export type AuroraPlanStatus = 'proposed' | 'adjusted' | 'reviewed' | 'bought' | 'dropped';

export type AuroraPlanAction = {
  id: string;
  blockId: AuroraDiagBlockId;
  title: string;
  detail: string;
  approxCost: number | null;
  currency: string;
  offer: AuroraPlanOffer;
  status: AuroraPlanStatus;
  purchasedAt: string | null;
};

const OFFERS: AuroraPlanOffer[] = ['purchase', 'radar', 'forge', 'partner', 'fundhub', 'practice'];
const STATUSES: AuroraPlanStatus[] = ['proposed', 'adjusted', 'reviewed', 'bought', 'dropped'];

function t(locale: AuroraLocale, pt: string, es: string, en: string) {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

function action(
  blockId: AuroraDiagBlockId,
  offer: AuroraPlanOffer,
  locale: AuroraLocale,
  title: L3,
  detail: L3,
  approxCost: number | null,
): AuroraPlanAction {
  return {
    id: `plan_${blockId}_${offer}`,
    blockId,
    title: t(locale, title.pt, title.es, title.en),
    detail: t(locale, detail.pt, detail.es, detail.en),
    approxCost,
    currency: 'USD',
    offer,
    status: 'proposed',
    purchasedAt: null,
  };
}

type L3 = { pt: string; es: string; en: string };

export function draftAuroraPlan(diagnostic: AuroraDiagnosticState, locale: AuroraLocale): AuroraPlanAction[] {
  const out: AuroraPlanAction[] = [];
  for (const def of AURORA_DIAG_BLOCKS) {
    const block = diagnostic.blocks[def.id];
    if (block?.status !== 'done' || block.level == null || block.level > 3) continue;
    const facts = block.facts || {};
    if (def.id === 'finance') {
      if (facts.controls !== 'yes') {
        out.push(
          action(
            def.id,
            'practice',
            locale,
            {
              pt: 'Separar o que entra e o que sai',
              es: 'Separar lo que entra y lo que sale',
              en: 'Separate money in and money out',
            },
            {
              pt: 'Registo simples, mesmo em caderno, com data, valor e se é entrada ou saída. Estimativa: sem compra.',
              es: 'Registro simple, aunque sea en cuaderno, con fecha, valor y si es entrada o salida. Estimación: sin compra.',
              en: 'A simple record, even a notebook, with date, amount and whether it is in or out. Estimate: no purchase.',
            },
            0,
          ),
        );
      }
      out.push(
        action(
          def.id,
          'fundhub',
          locale,
          {
            pt: 'Se faltar capital, procurar fundo a partir deste plano',
            es: 'Si falta capital, buscar fondo a partir de este plan',
            en: 'If capital is missing, look for funding from this plan',
          },
          {
            pt: 'O FundHub escreve o projeto com o que a empresa precisa, não com um texto genérico.',
            es: 'FundHub escribe el proyecto con lo que la empresa necesita, no con un texto genérico.',
            en: 'FundHub writes the project from what the business needs, not from a generic text.',
          },
          0,
        ),
      );
    } else if (def.id === 'systems') {
      out.push(
        action(
          def.id,
          'radar',
          locale,
          {
            pt: 'Digitalizar a operação na finca',
            es: 'Digitalizar la operación en la finca',
            en: 'Digitize the farm operation',
          },
          {
            pt: 'RADAR: mapa da propriedade, registo de campo e alertas. O custo fecha quando o técnico valida o plano.',
            es: 'RADAR: mapa de la propiedad, registro de campo y alertas. El costo se cierra cuando el técnico valida el plan.',
            en: 'RADAR: property map, field log and alerts. Cost is set when the technician validates the plan.',
          },
          null,
        ),
      );
    } else if (def.id === 'people') {
      out.push(
        action(
          def.id,
          'forge',
          locale,
          {
            pt: 'Curso público para a função que falta',
            es: 'Curso público para la función que falta',
            en: 'A public course for the missing role',
          },
          {
            pt: 'FORGE: curso aberto, pago ou gratuito, escolhido a partir da função que hoje para o negócio.',
            es: 'FORGE: curso abierto, pago o gratuito, elegido a partir de la función que hoy frena el negocio.',
            en: 'FORGE: an open course, paid or free, chosen from the role that currently stops the business.',
          },
          null,
        ),
      );
    } else if (def.id === 'commercial') {
      out.push(
        action(
          def.id,
          'partner',
          locale,
          {
            pt: 'Serviço externo de identidade ou canal',
            es: 'Servicio externo de identidad o canal',
            en: 'External identity or channel service',
          },
          {
            pt: 'Pode ser o fornecedor que a empresa já usa, ou um parceiro indicado. Estimativa inicial, o técnico ajusta.',
            es: 'Puede ser el proveedor que la empresa ya usa, o un socio indicado. Estimación inicial, el técnico ajusta.',
            en: 'It can be the provider the business already uses, or a recommended partner. Initial estimate, the technician adjusts.',
          },
          800,
        ),
      );
    } else if (def.id === 'operations') {
      out.push(
        action(
          def.id,
          'purchase',
          locale,
          {
            pt: 'Compra de insumo ou ferramenta da operação',
            es: 'Compra de insumo o herramienta de la operación',
            en: 'Purchase of an input or operations tool',
          },
          {
            pt: 'Lista do que comprar, com custo aproximado. A empresa marca quando comprou. Estimativa inicial.',
            es: 'Lista de lo que comprar, con costo aproximado. La empresa marca cuándo compró. Estimación inicial.',
            en: 'A buy list with an approximate cost. The business marks when it was bought. Initial estimate.',
          },
          500,
        ),
      );
    } else if (def.id === 'governance') {
      out.push(
        action(
          def.id,
          'practice',
          locale,
          {
            pt: 'Um plano de 12 meses numa página',
            es: 'Un plan de 12 meses en una página',
            en: 'A one-page 12-month plan',
          },
          {
            pt: 'Quem decide, o que se faz neste trimestre e o que fica de fora. Sem compra.',
            es: 'Quién decide, qué se hace este trimestre y qué queda afuera. Sin compra.',
            en: 'Who decides, what happens this quarter and what stays out. No purchase.',
          },
          0,
        ),
      );
    }
  }
  return out;
}

function asOffer(raw: unknown): AuroraPlanOffer {
  return OFFERS.includes(raw as AuroraPlanOffer) ? (raw as AuroraPlanOffer) : 'practice';
}

function asStatus(raw: unknown): AuroraPlanStatus {
  return STATUSES.includes(raw as AuroraPlanStatus) ? (raw as AuroraPlanStatus) : 'proposed';
}

export function readAuroraPlan(interviewJson: unknown): AuroraPlanAction[] {
  if (!interviewJson || typeof interviewJson !== 'object' || Array.isArray(interviewJson)) return [];
  const raw = (interviewJson as Record<string, unknown>)[AURORA_PLAN_KEY];
  if (!Array.isArray(raw)) return [];
  const out: AuroraPlanAction[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === 'string' ? o.id.trim().slice(0, 80) : '';
    const title = typeof o.title === 'string' ? o.title.trim().slice(0, 200) : '';
    const blockId = AURORA_DIAG_BLOCKS.some((b) => b.id === o.blockId) ? (o.blockId as AuroraDiagBlockId) : null;
    if (!id || !title || !blockId) continue;
    const cost = typeof o.approxCost === 'number' && Number.isFinite(o.approxCost) ? Math.max(0, o.approxCost) : null;
    out.push({
      id,
      blockId,
      title,
      detail: typeof o.detail === 'string' ? o.detail.trim().slice(0, 800) : '',
      approxCost: cost,
      currency: typeof o.currency === 'string' && o.currency.trim() ? o.currency.trim().slice(0, 8) : 'USD',
      offer: asOffer(o.offer),
      status: asStatus(o.status),
      purchasedAt: typeof o.purchasedAt === 'string' ? o.purchasedAt.slice(0, 40) : null,
    });
  }
  return out.slice(0, 24);
}

/** Mantém o que o técnico já ajustou. Acrescenta propostas novas do diagnóstico. */
export function mergeAuroraPlan(existing: AuroraPlanAction[], drafted: AuroraPlanAction[]): AuroraPlanAction[] {
  const kept = existing.filter((a) => a.status !== 'proposed');
  const keptIds = new Set(kept.map((a) => a.id));
  const proposed = drafted.filter((a) => !keptIds.has(a.id));
  return [...kept, ...proposed].slice(0, 24);
}

export function patchAuroraPlan(existing: AuroraPlanAction[], patch: Partial<AuroraPlanAction> & { id: string }): AuroraPlanAction[] {
  return existing.map((row) => {
    if (row.id !== patch.id) return row;
    const next = { ...row };
    if (typeof patch.title === 'string' && patch.title.trim()) next.title = patch.title.trim().slice(0, 200);
    if (typeof patch.detail === 'string') next.detail = patch.detail.trim().slice(0, 800);
    if (patch.approxCost === null) next.approxCost = null;
    else if (typeof patch.approxCost === 'number' && Number.isFinite(patch.approxCost)) next.approxCost = Math.max(0, patch.approxCost);
    if (patch.offer) next.offer = asOffer(patch.offer);
    if (patch.status) next.status = asStatus(patch.status);
    else if (next.status === 'proposed') next.status = 'adjusted';
    if (next.status === 'bought') next.purchasedAt = next.purchasedAt || new Date().toISOString();
    else if (patch.status) next.purchasedAt = null;
    return next;
  });
}

export function auroraPlanPatch(actions: AuroraPlanAction[]): Record<string, unknown> {
  return { [AURORA_PLAN_KEY]: actions };
}

export function auroraPlanOfferLabel(offer: AuroraPlanOffer, locale: AuroraLocale): string {
  const map: Record<AuroraPlanOffer, L3> = {
    purchase: { pt: 'Compra', es: 'Compra', en: 'Purchase' },
    radar: { pt: 'RADAR', es: 'RADAR', en: 'RADAR' },
    forge: { pt: 'Curso FORGE', es: 'Curso FORGE', en: 'FORGE course' },
    partner: { pt: 'Parceiro', es: 'Socio', en: 'Partner' },
    fundhub: { pt: 'FundHub', es: 'FundHub', en: 'FundHub' },
    practice: { pt: 'Prática', es: 'Práctica', en: 'Practice' },
  };
  const row = map[offer];
  return t(locale, row.pt, row.es, row.en);
}
