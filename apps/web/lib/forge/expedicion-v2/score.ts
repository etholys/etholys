import { countModulesWithFourSteps } from '@/lib/forge/expedicion-v2/construction-map';
import type {
  ConstructionMapState,
  EcoLedgerState,
  SustainabilityScoreBreakdown,
} from '@/lib/forge/expedicion-v2/types';

/** Fórmula oficial PPT slide 9: (Eco × 0,6) + (Impacto × 10 × 0,4) */
export const ECO_SCORE_WEIGHT = 0.6;
export const IMPACT_SCORE_WEIGHT = 0.4;
export const IMPACT_POINT_MULTIPLIER = 10;

export function computeSustainabilityScore(
  ledger: EcoLedgerState,
  map: ConstructionMapState,
  impactPoints = 0
): SustainabilityScoreBreakdown {
  const finalEcoBalance = ledger.balance;
  const postItCount = map.postIts.length;
  const modulesComplete = countModulesWithFourSteps(map);
  const connectionCount = map.connections.length;

  const ecoComponent = finalEcoBalance * ECO_SCORE_WEIGHT;
  const impactComponent = impactPoints * IMPACT_POINT_MULTIPLIER * IMPACT_SCORE_WEIGHT;
  const total = ecoComponent + impactComponent;

  return {
    ecoComponent: Math.round(ecoComponent * 10) / 10,
    impactComponent: Math.round(impactComponent * 10) / 10,
    total: Math.round(total * 10) / 10,
    finalEcoBalance,
    impactPoints,
    postItCount,
    modulesComplete,
    connectionCount,
  };
}
