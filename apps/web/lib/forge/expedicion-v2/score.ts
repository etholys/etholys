import { countModulesWithFourSteps } from '@/lib/forge/expedicion-v2/construction-map';
import type {
  ConstructionMapState,
  EcoLedgerState,
  SustainabilityScoreBreakdown,
} from '@/lib/forge/expedicion-v2/types';

export function computeSustainabilityScore(
  ledger: EcoLedgerState,
  map: ConstructionMapState
): SustainabilityScoreBreakdown {
  const finalEcoBalance = ledger.balance;
  const postItCount = map.postIts.length;
  const modulesComplete = countModulesWithFourSteps(map);
  const connectionCount = map.connections.length;

  const ecoComponent = finalEcoBalance * 0.1;
  const postItComponent = postItCount * 1;
  const moduleCompleteComponent = modulesComplete * 5;
  const connectionComponent = connectionCount * 1.5;
  const total = ecoComponent + postItComponent + moduleCompleteComponent + connectionComponent;

  return {
    ecoComponent,
    postItComponent,
    moduleCompleteComponent,
    connectionComponent,
    total: Math.round(total * 10) / 10,
    finalEcoBalance,
    postItCount,
    modulesComplete,
    connectionCount,
  };
}
