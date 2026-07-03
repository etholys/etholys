/** La Expedición Sostenible V2 — tipos centrais */

import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';

export type PostItType = 'diagnostico' | 'accion' | 'inversion' | 'metrica';

export type ConstructionPostIt = {
  id: string;
  station: ExpedicionStationSlug;
  type: PostItType;
  text: string;
  x: number;
  y: number;
  createdAt: string;
};

export type ConstructionConnection = {
  id: string;
  fromPostItId: string;
  toPostItId: string;
};

export type ConstructionMapState = {
  postIts: ConstructionPostIt[];
  connections: ConstructionConnection[];
};

export type LedgerEntryType = 'E' | 'S';

export type LedgerEntry = {
  id: string;
  seq: number;
  description: string;
  type: LedgerEntryType;
  amount: number;
  balance: number;
  at: string;
  meta?: Record<string, unknown>;
};

export type EcoLedgerState = {
  entries: LedgerEntry[];
  balance: number;
  greenLoanTaken: boolean;
  greenLoanDebt: number;
};

export type GamePhase = 'pre_quiz' | 'playing' | 'post_quiz' | 'finished';

export type MaturityQuizAnswers = Record<string, string | number>;

export type ExpedicionV2PlayerState = {
  phase: GamePhase;
  cyclesCompleted: number;
  maxCycles: number;
  constructionMap: ConstructionMapState;
  ledger: EcoLedgerState;
  preQuizAnswers?: MaturityQuizAnswers;
  postQuizAnswers?: MaturityQuizAnswers;
  preQuizCompletedAt?: string;
  postQuizCompletedAt?: string;
  finalScore?: number;
  finalScoreBreakdown?: SustainabilityScoreBreakdown;
};

export type SustainabilityScoreBreakdown = {
  ecoComponent: number;
  postItComponent: number;
  moduleCompleteComponent: number;
  connectionComponent: number;
  total: number;
  finalEcoBalance: number;
  postItCount: number;
  modulesComplete: number;
  connectionCount: number;
};

export type ConsultancyOptionId =
  | 'ia_capsula'
  | 'companero'
  | 'grupo'
  | 'facilitador';

export const INITIAL_ECO_BALANCE = 500;
export const GREEN_LOAN_AMOUNT = 300;
export const GREEN_LOAN_DEBT = 330;
export const MAX_GAME_CYCLES = 3;
