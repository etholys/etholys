import type { GameSpecV1 } from '@/lib/forge/schemas/game-spec-v1';
import { stationForSpace } from '@/lib/forge/board-spaces';

type Card = NonNullable<GameSpecV1['cards']>[number];

/** Estações do jogo físico (5 mazos). */
export const EXPEDICION_STATION_SLUGS = [
  'raices',
  'tierra',
  'alquimia',
  'mercado',
  'futuro',
] as const;

export type ExpedicionStationSlug = (typeof EXPEDICION_STATION_SLUGS)[number];

const STATION_NAME_TO_SLUG: Record<string, ExpedicionStationSlug> = {
  Raíces: 'raices',
  Tierra: 'tierra',
  Alquimia: 'alquimia',
  Mercado: 'mercado',
  Futuro: 'futuro',
};

export function stationSlugForSpace(position: number): ExpedicionStationSlug | null {
  const name = stationForSpace(position).name;
  return STATION_NAME_TO_SLUG[name] ?? null;
}

export function stationSlugFromCardId(cardId: string): ExpedicionStationSlug | null {
  const prefix = cardId.split('-')[0]?.toLowerCase();
  if (prefix && (EXPEDICION_STATION_SLUGS as readonly string[]).includes(prefix)) {
    return prefix as ExpedicionStationSlug;
  }
  const head = cardId.replace(/[0-9].*$/, '').toLowerCase();
  const map: Record<string, ExpedicionStationSlug> = {
    r: 'raices',
    t: 'tierra',
    a: 'alquimia',
    m: 'mercado',
    f: 'futuro',
  };
  return map[head] ?? null;
}

export function cardsForStation(cards: Card[], slug: ExpedicionStationSlug): Card[] {
  const deck = cards.filter((c) => stationSlugFromCardId(c.id) === slug);
  if (deck.length > 0) return deck;
  return cards.filter((c) => c.type === 'event' || c.type === 'bonus' || c.id.startsWith('desafio'));
}

export function drawCardForPosition(
  cards: Card[],
  position: number,
  usedIds: string[] = []
): Card | null {
  if (!cards.length) return null;
  const slug = stationSlugForSpace(position);
  const pool = slug ? cardsForStation(cards, slug) : cards;
  const fresh = pool.filter((c) => !usedIds.includes(c.id));
  const pickFrom = fresh.length > 0 ? fresh : pool;
  if (!pickFrom.length) return null;
  return pickFrom[Math.floor(Math.random() * pickFrom.length)]!;
}
