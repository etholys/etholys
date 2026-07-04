import type { EventCard } from '@/lib/forge/expedicion-v2/content';
import { removePostIt } from '@/lib/forge/expedicion-v2/construction-map';
import { appendLedgerEntry } from '@/lib/forge/expedicion-v2/ledger';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type {
  ExpedicionV2PlayerState,
  PostItType,
} from '@/lib/forge/expedicion-v2/types';

export type CrisisResolveMode = 'pay_fine' | 'rewrite';

function firstPostItId(
  v2: ExpedicionV2PlayerState,
  station: ExpedicionStationSlug,
  type: PostItType
): string | null {
  return v2.constructionMap.postIts.find((p) => p.station === station && p.type === type)?.id ?? null;
}

function removeFirstPostIt(
  v2: ExpedicionV2PlayerState,
  station: ExpedicionStationSlug,
  type: PostItType
): ExpedicionV2PlayerState {
  const id = firstPostItId(v2, station, type);
  if (!id) return v2;
  return { ...v2, constructionMap: removePostIt(v2.constructionMap, id) };
}

export type EventCardResult = {
  v2: ExpedicionV2PlayerState;
  message: string;
};

/** Aplica carta de Acción V2 al estado (mapa + ledger + beneficios). */
export function applyActionEventCard(v2: ExpedicionV2PlayerState, card: EventCard): EventCardResult {
  const benefits = { ...(v2.benefits ?? {}) };

  switch (card.id) {
    case 'action-1':
      benefits.halfInvestmentAny = true;
      return {
        v2: { ...v2, benefits },
        message: 'Próxima Inversión en cualquier columna: −50% Eco.',
      };
    case 'action-2': {
      const next = removeFirstPostIt(v2, 'tierra', 'inversion');
      return {
        v2: next,
        message: "Se eliminó la ficha 'Inversión' en Tierra (o no había ninguna).",
      };
    }
    case 'action-3':
      benefits.doubleMetricMercado = true;
      return {
        v2: { ...v2, benefits },
        message: "La ficha 'Métrica' en Mercado cuenta doble en el score.",
      };
    case 'action-4':
      benefits.halfInvestmentAlquimia = true;
      return {
        v2: { ...v2, benefits },
        message: "Inversión en Alquimia: −50% Eco en la próxima compra.",
      };
    case 'action-5': {
      const ledger = appendLedgerEntry(v2.ledger, card.title, 'E', 100, {
        kind: 'v2_action',
        cardId: card.id,
      });
      return { v2: { ...v2, ledger }, message: '+100 Eco-Créditos.' };
    }
    default:
      return { v2, message: 'Carta aplicada.' };
  }
}

/** Aplica carta de Desafío — pagar multa o reescribir (eliminar post-it). */
export function applyCrisisEventCard(
  v2: ExpedicionV2PlayerState,
  card: EventCard,
  mode: CrisisResolveMode
): EventCardResult {
  const fine = card.fineEco ?? 200;

  if (mode === 'pay_fine') {
    const ledger = appendLedgerEntry(v2.ledger, card.title, 'S', fine, {
      kind: 'v2_crisis',
      cardId: card.id,
      mode: 'pay_fine',
    });
    return { v2: { ...v2, ledger }, message: `Multa de ${fine} Eco pagada.` };
  }

  let next = v2;
  switch (card.id) {
    case 'crisis-1':
      next = removeFirstPostIt(v2, 'tierra', 'accion');
      break;
    case 'crisis-2':
      next = removeFirstPostIt(v2, 'alquimia', 'accion');
      break;
    case 'crisis-3':
      next = removeFirstPostIt(v2, 'mercado', 'accion');
      break;
    case 'crisis-4':
      next = removeFirstPostIt(v2, 'raices', 'inversion');
      break;
    case 'crisis-5':
      next = removeFirstPostIt(v2, 'futuro', 'accion');
      break;
    default:
      break;
  }

  const removed = next !== v2;
  return {
    v2: next,
    message: removed
      ? 'Ficha eliminada — reescríbela en el mapa.'
      : 'No había ficha que eliminar; añade la acción corregida en el mapa.',
  };
}

/** Calcula coste de inversión con beneficios activos de cartas Acción. */
export function investmentCostWithBenefits(
  benefits: ExpedicionV2PlayerState['benefits'],
  station: ExpedicionStationSlug,
  baseCost: number
): { cost: number; benefitUsed?: string } {
  if (benefits?.halfInvestmentAny) {
    return { cost: Math.round(baseCost / 2), benefitUsed: 'halfInvestmentAny' };
  }
  if (station === 'alquimia' && benefits?.halfInvestmentAlquimia) {
    return { cost: Math.round(baseCost / 2), benefitUsed: 'halfInvestmentAlquimia' };
  }
  return { cost: baseCost };
}

/** Consume beneficio de descuento tras usarlo en una compra. */
export function consumeInvestmentBenefit(
  v2: ExpedicionV2PlayerState,
  benefitUsed?: string
): ExpedicionV2PlayerState {
  if (!benefitUsed || !v2.benefits) return v2;
  const benefits = { ...v2.benefits };
  if (benefitUsed === 'halfInvestmentAny') delete benefits.halfInvestmentAny;
  if (benefitUsed === 'halfInvestmentAlquimia') delete benefits.halfInvestmentAlquimia;
  return { ...v2, benefits: Object.keys(benefits).length ? benefits : undefined };
}
