/**
 * Elegibilidade territorial, carbono e corredor.
 * A supressão pós-2008 e as camadas de exclusão são o veredito registado a partir das bases oficiais
 * (CAR, SIGEF, FUNAI, unidades de conservação). O sistema bloqueia a finca quando esse veredito falha.
 */

import { haversineMeters, type GeoPoint } from './aurora-visit';

export type TerritorialCompliance = {
  stateUf: string;
  municipality: string;
  fiscalModules: number | null;
  carCode: string;
  sigefCode: string;
  inIndigenousLand: boolean;
  inConservationUnit: boolean;
  inLitigation: boolean;
  deforestationAfter2008: boolean;
  womenLed: boolean;
  youthLed: boolean;
  notes: string;
};

export const EMPTY_COMPLIANCE: TerritorialCompliance = {
  stateUf: '',
  municipality: '',
  fiscalModules: null,
  carCode: '',
  sigefCode: '',
  inIndigenousLand: false,
  inConservationUnit: false,
  inLitigation: false,
  deforestationAfter2008: false,
  womenLed: false,
  youthLed: false,
  notes: '',
};

/** Estimativa inicial de SAF de cacau até a metodologia do projeto ser fechada na imersão. tCO2e por hectare e por ano. */
export const CACAU_SAF_TCO2E_PER_HA_YEAR = 5;

const ALLOWED_UF = new Set(['PA', 'BA']);

function bool(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === 'yes' || raw === 'sim';
}

export function readCompliance(raw: unknown): TerritorialCompliance {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const modules = Number(o.fiscalModules);
  return {
    stateUf: String(o.stateUf || '').trim().toUpperCase().slice(0, 2),
    municipality: String(o.municipality || '').trim().slice(0, 120),
    fiscalModules: Number.isFinite(modules) && modules > 0 ? modules : null,
    carCode: String(o.carCode || '').trim().slice(0, 80),
    sigefCode: String(o.sigefCode || '').trim().slice(0, 80),
    inIndigenousLand: bool(o.inIndigenousLand),
    inConservationUnit: bool(o.inConservationUnit),
    inLitigation: bool(o.inLitigation),
    deforestationAfter2008: bool(o.deforestationAfter2008),
    womenLed: bool(o.womenLed),
    youthLed: bool(o.youthLed),
    notes: String(o.notes || '').trim().slice(0, 500),
  };
}

export function territorialEligibility(input: TerritorialCompliance): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!ALLOWED_UF.has(input.stateUf)) reasons.push('Fora do Pará e da Bahia.');
  if (!input.municipality) reasons.push('Falta o município.');
  if (input.fiscalModules == null) reasons.push('Faltam os módulos fiscais.');
  else if (input.fiscalModules > 4) reasons.push('Acima de 4 módulos fiscais.');
  if (!input.carCode) reasons.push('Falta o código do CAR.');
  if (!input.sigefCode) reasons.push('Falta o código do SIGEF.');
  if (input.inIndigenousLand) reasons.push('Sobrepõe terra indígena.');
  if (input.inConservationUnit) reasons.push('Sobrepõe unidade de conservação.');
  if (input.inLitigation) reasons.push('Área em litígio fundiário.');
  if (input.deforestationAfter2008) reasons.push('Supressão de vegetação depois de 22 de julho de 2008.');
  return { eligible: reasons.length === 0, reasons };
}

export function carbonTonnesTo2030(areaHa: number, now = new Date()): number {
  if (!Number.isFinite(areaHa) || areaHa <= 0) return 0;
  const years = Math.max(0, 2030 - now.getFullYear());
  return Math.round(areaHa * CACAU_SAF_TCO2E_PER_HA_YEAR * years * 10) / 10;
}

export function corridorGroups(points: Array<{ id: string; lat: number; lng: number }>, maxMeters = 5000) {
  const connected = new Set<string>();
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const a = points[i]!;
      const b = points[j]!;
      if (haversineMeters(a, b) <= maxMeters) {
        connected.add(a.id);
        connected.add(b.id);
      }
    }
  }
  return {
    connected: points.filter((p) => connected.has(p.id)).map((p) => p.id),
    isolated: points.filter((p) => !connected.has(p.id)).map((p) => p.id),
  };
}

export function ringCentroid(ring: GeoPoint[]): GeoPoint | null {
  if (!ring.length) return null;
  const lat = ring.reduce((s, p) => s + p.lat, 0) / ring.length;
  const lng = ring.reduce((s, p) => s + p.lng, 0) / ring.length;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}
