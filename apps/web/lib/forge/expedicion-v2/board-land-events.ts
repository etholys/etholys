import { stationForSpace } from '@/lib/forge/board-spaces';
import { stationSlugForSpace } from '@/lib/forge/expedicion-station-decks';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import { getActionCards, getCrisisCards, type EventCard } from '@/lib/forge/expedicion-v2/content';

export type BoardLandKind = 'salida' | 'meta' | 'estacion' | 'accion' | 'desafio' | 'otro';

export type BoardLandEvent = {
  kind: BoardLandKind;
  position: number;
  station: ExpedicionStationSlug | null;
  cellName: string;
  actionCard?: EventCard;
  crisisCard?: EventCard;
};

let actionIdx = 0;
let crisisIdx = 0;
const usedActions = new Set<string>();
const usedCrises = new Set<string>();

function pickCard(pool: EventCard[], used: Set<string>): EventCard | undefined {
  const fresh = pool.filter((c) => !used.has(c.id));
  const list = fresh.length ? fresh : pool;
  if (!list.length) return undefined;
  const card = list[Math.floor(Math.random() * list.length)]!;
  used.add(card.id);
  return card;
}

export function resolveBoardLandEvent(position: number, spaces = 20): BoardLandEvent {
  const cell = stationForSpace(position);
  const name = cell.name;
  const station = stationSlugForSpace(position);

  if (position === 0) {
    return { kind: 'salida', position, station: null, cellName: name };
  }
  if (position >= spaces - 1) {
    return { kind: 'meta', position, station: null, cellName: name };
  }
  if (name === 'Acción') {
    const actionCard = pickCard(getActionCards(), usedActions) ?? getActionCards()[actionIdx++ % 5];
    return { kind: 'accion', position, station: null, cellName: name, actionCard };
  }
  if (name === 'Desafío') {
    const crisisCard = pickCard(getCrisisCards(), usedCrises) ?? getCrisisCards()[crisisIdx++ % 5];
    return { kind: 'desafio', position, station: null, cellName: name, crisisCard };
  }
  if (station) {
    return { kind: 'estacion', position, station, cellName: name };
  }
  return { kind: 'otro', position, station: null, cellName: name };
}

export function resetBoardLandDecks() {
  usedActions.clear();
  usedCrises.clear();
  actionIdx = 0;
  crisisIdx = 0;
}

/** Eco automático das cartas de ação V2 */
export function actionCardEcoBonus(card: EventCard): number {
  if (/100\s*Eco/i.test(card.effect)) return 100;
  return 0;
}

export function crisisCardEcoFine(card: EventCard): number {
  return card.fineEco ?? 200;
}
