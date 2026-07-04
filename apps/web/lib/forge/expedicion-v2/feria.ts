import { countModulesWithFourSteps } from '@/lib/forge/expedicion-v2/construction-map';
import type { ConstructionMapState } from '@/lib/forge/expedicion-v2/types';

export const FERIA_ECO_PRIZE = 300;
export const FERIA_MIN_STATIONS = 3;

/** Elegível: 3+ módulos com 4 passos OU post-its em 3+ colunas. */
export function feriaEligible(map: ConstructionMapState): boolean {
  if (countModulesWithFourSteps(map) >= FERIA_MIN_STATIONS) return true;
  const stations = new Set(map.postIts.map((p) => p.station));
  return stations.size >= FERIA_MIN_STATIONS;
}

export function feriaEligibilityHint(map: ConstructionMapState): string {
  const modules = countModulesWithFourSteps(map);
  const stations = new Set(map.postIts.map((p) => p.station)).size;
  return `${modules}/3 módulos completos · ${stations}/3 columnas con post-its`;
}
