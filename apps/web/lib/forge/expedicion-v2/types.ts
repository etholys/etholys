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

export type GamePhase = 'lobby' | 'pre_quiz' | 'playing' | 'post_quiz' | 'finished';

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
  /** Beneficios activos de cartas Acción */
  benefits?: {
    halfInvestmentAny?: boolean;
    halfInvestmentAlquimia?: boolean;
    doubleMetricMercado?: boolean;
  };
  /** Micro-caso enviado, pendiente de validación del facilitador */
  pendingMicroCaso?: {
    microCasoId: string;
    station: ExpedicionStationSlug;
    answer: string;
    submittedAt: string;
    submittedBy?: string;
  } | null;
  /** Micro-casos ya resueltos (evita repetir) */
  completedMicroCasos?: string[];
  /** Pitch Feria de Negocios pendiente de validación */
  pendingFeriaPitch?: {
    pitch: string;
    submittedAt: string;
    submittedBy?: string;
  } | null;
  /** Premio Feria ya entregado (+300 Eco) */
  feriaAwarded?: boolean;
  /** Puntos de Impacto (validaciones facilitador + tablero) */
  impactPoints?: number;
  /** Eco ganados por ayudar a colegas (modo mesa) */
  peerCredits?: Record<string, number>;
};

export type SustainabilityScoreBreakdown = {
  /** Eco × 0,6 (fórmula PPT slide 9) */
  ecoComponent: number;
  /** Puntos de Impacto × 10 × 0,4 */
  impactComponent: number;
  total: number;
  finalEcoBalance: number;
  impactPoints: number;
  /** Detalhe auxiliar do mapa (referência) */
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
