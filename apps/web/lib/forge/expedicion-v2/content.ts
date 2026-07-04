import microCasos from '@/lib/forge/expedicion-v2/data/micro-casos.json';
import eventCards from '@/lib/forge/expedicion-v2/data/event-cards.json';
import quizMaturidade from '@/lib/forge/expedicion-v2/data/quiz-maturidade.json';
import capsulas from '@/lib/forge/expedicion-v2/data/capsulas-tecnicas.json';
import { CAPSULAS_TECNICAS } from '@/lib/forge/expedicion-v2/capsulas-content';
import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';

export type MicroCaso = {
  id: string;
  station: string;
  prompt: string;
  validationRubric: string;
};

export type EventCard = {
  id: string;
  kind: 'action' | 'crisis';
  title: string;
  effect: string;
  tag: string;
  fineEco?: number;
};

export function getMicroCasosForStation(station: ExpedicionStationSlug): MicroCaso[] {
  return (microCasos as MicroCaso[]).filter((c) => c.station === station);
}

export function getMicroCasoById(id: string): MicroCaso | undefined {
  return (microCasos as MicroCaso[]).find((c) => c.id === id);
}

export function drawRandomMicroCaso(station: ExpedicionStationSlug, exclude: string[] = []): MicroCaso | null {
  const pool = getMicroCasosForStation(station).filter((c) => !exclude.includes(c.id));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

export function getActionCards(): EventCard[] {
  return eventCards.actions as EventCard[];
}

export function getCrisisCards(): EventCard[] {
  return eventCards.crises as EventCard[];
}

export function getMaturityQuiz() {
  return quizMaturidade as { pre: unknown[]; post: unknown[] };
}

export function getCapsulaForStation(station: ExpedicionStationSlug) {
  const rich = CAPSULAS_TECNICAS.find((c) => c.station === station);
  if (rich) return rich;
  return (capsulas as Array<{ station: string; title: string; body: string }>).find(
    (c) => c.station === station
  );
}
