/**
 * Módulo operacional NEXUS por setor — catálogo em código (client-safe).
 */

export type ModuleLocale = 'es' | 'pt' | 'en';

export type L3 = { es: string; pt: string; en: string };

export type OpsUnitKind = 'parcel' | 'herd' | 'flock' | 'hive' | 'lot' | 'generic';

export type FieldEntryKind =
  | 'planting'
  | 'input'
  | 'irrigation'
  | 'pest'
  | 'harvest'
  | 'observation'
  | 'visit'
  | 'note'
  | 'health'
  | 'feed'
  | 'milking'
  | 'egg'
  | 'biosecurity'
  | 'hive_inspect'
  | 'process'
  | 'hygiene'
  | 'qc';

export type ProtocolRule =
  | { type: 'phi'; days: number }
  | { type: 'withdrawal'; days: number }
  | { type: 'moisture_threshold'; metric: 'soil_moisture'; below: number }
  | { type: 'metric_threshold'; metric: string; below?: number; above?: number }
  | { type: 'stale_book'; days: number };

export type ModuleHref = 'campo' | 'monitor';

export type SectorProtocol = {
  id: string;
  title: L3;
  summary: L3;
  entryKinds: FieldEntryKind[];
  rules: ProtocolRule[];
  /** Perguntas do diagnóstico que disparam este protocolo. */
  dxQuestionIds?: string[];
};

export type OpsPlanKind = 'ops_unit' | 'field_book' | 'sensor' | 'protocol';

export type ModulePlanSeed = {
  id: string;
  title: L3;
  description: L3;
  pillar: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  kind: OpsPlanKind;
  estimatedHours: number;
  href?: ModuleHref;
  protocolId?: string;
  dxQuestionIds?: string[];
};

export type MonitorMetric = {
  id: string;
  label: L3;
  unit: string;
};

export type SectorModuleId =
  | 'agriculture'
  | 'livestock'
  | 'poultry'
  | 'apiculture'
  | 'agroindustry'
  | 'generic';

export type SectorModule = {
  /** Chave do módulo — não é o id do setor. */
  moduleId: SectorModuleId;
  sectorIds: string[];
  unitKind: OpsUnitKind;
  unitLabel: L3;
  bookLabel: L3;
  monitorLabel: L3;
  intro: L3;
  namePlaceholder: L3;
  showAreaHa?: boolean;
  qtyLabel?: L3;
  cropLabel?: L3;
  entryKinds: FieldEntryKind[];
  metrics: MonitorMetric[];
  protocols: SectorProtocol[];
  planSeeds: ModulePlanSeed[];
};

export function L(row: L3, locale: ModuleLocale): string {
  return row[locale] || row.es;
}
