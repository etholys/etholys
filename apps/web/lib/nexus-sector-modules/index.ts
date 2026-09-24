import { getEconomicSector, normalizeEconomicSectorId } from '../nexus-economic-sectors';
import { AGRICULTURE_MODULE } from './agriculture';
import { AGROINDUSTRY_MODULE } from './agroindustry';
import { APICULTURE_MODULE } from './apiculture';
import { GENERIC_MODULE } from './generic';
import { LIVESTOCK_MODULE } from './livestock';
import { POULTRY_MODULE } from './poultry';
import type { FieldEntryKind, ModuleLocale, SectorModule } from './types';
import { L } from './types';

export * from './types';
export * from './alerts';
export * from './dx-bridge';
export { AGRICULTURE_MODULE } from './agriculture';
export { AGROINDUSTRY_MODULE } from './agroindustry';
export { APICULTURE_MODULE } from './apiculture';
export { GENERIC_MODULE } from './generic';
export { LIVESTOCK_MODULE } from './livestock';
export { POULTRY_MODULE } from './poultry';

const MODULES: SectorModule[] = [
  AGRICULTURE_MODULE,
  LIVESTOCK_MODULE,
  POULTRY_MODULE,
  APICULTURE_MODULE,
  AGROINDUSTRY_MODULE,
  GENERIC_MODULE,
];

const BY_SECTOR = new Map<string, SectorModule>();
for (const mod of MODULES) {
  for (const sid of mod.sectorIds) BY_SECTOR.set(sid, mod);
}

export function getSectorModule(sectorId: string | null | undefined): SectorModule {
  const norm = normalizeEconomicSectorId(sectorId);
  if (norm && BY_SECTOR.has(norm)) return BY_SECTOR.get(norm)!;
  return GENERIC_MODULE;
}

export function resolveSectorModule(sectorIds: string[] | null | undefined): SectorModule {
  const ids = (sectorIds || []).map((id) => normalizeEconomicSectorId(id)).filter(Boolean) as string[];
  for (const id of ids) {
    const mod = getSectorModule(id);
    if (mod.moduleId !== 'generic') return mod;
  }
  return getSectorModule(ids[0] || null);
}

export function isAgricultureModule(sectorId: string | null | undefined): boolean {
  return getSectorModule(sectorId).moduleId === 'agriculture';
}

export function fieldEntryKindLabel(kind: FieldEntryKind, locale: ModuleLocale): string {
  const map: Record<FieldEntryKind, { es: string; pt: string; en: string }> = {
    planting: { es: 'Siembra', pt: 'Sementeira', en: 'Planting' },
    input: { es: 'Insumo', pt: 'Insumo', en: 'Input' },
    irrigation: { es: 'Riego', pt: 'Irrigação', en: 'Irrigation' },
    pest: { es: 'Plaga / MIP', pt: 'Praga / MIP', en: 'Pest / IPM' },
    harvest: { es: 'Cosecha / despacho', pt: 'Colheita / expedição', en: 'Harvest / dispatch' },
    observation: { es: 'Observación', pt: 'Observação', en: 'Observation' },
    visit: { es: 'Visita AT', pt: 'Visita AT', en: 'TA visit' },
    note: { es: 'Nota', pt: 'Nota', en: 'Note' },
    health: { es: 'Sanidad', pt: 'Sanidade', en: 'Health' },
    feed: { es: 'Alimentación', pt: 'Alimentação', en: 'Feed' },
    milking: { es: 'Ordeño', pt: 'Ordenha', en: 'Milking' },
    egg: { es: 'Postura / huevos', pt: 'Postura / ovos', en: 'Laying / eggs' },
    biosecurity: { es: 'Bioseguridad', pt: 'Biossegurança', en: 'Biosecurity' },
    hive_inspect: { es: 'Inspección de colmena', pt: 'Inspeção de colmeia', en: 'Hive inspection' },
    process: { es: 'Proceso / corrida', pt: 'Processo / corrida', en: 'Process / run' },
    hygiene: { es: 'Higiene', pt: 'Higiene', en: 'Hygiene' },
    qc: { es: 'Calidad / QC', pt: 'Qualidade / QC', en: 'Quality / QC' },
  };
  return L(map[kind], locale);
}

export function moduleSkinLabel(sectorId: string | null | undefined, locale: ModuleLocale): string {
  const sector = getEconomicSector(sectorId);
  const mod = getSectorModule(sectorId);
  if (sector) return sector.label[locale] || sector.label.es;
  return L(mod.bookLabel, locale);
}
