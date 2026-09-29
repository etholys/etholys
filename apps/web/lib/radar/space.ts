import { RADAR_MODULES, type RadarModuleId } from '@/lib/etholys-products';

export const RADAR_SPACE_KINDS: Record<
  RadarModuleId,
  { unitKind: string; unitLabel: { pt: string; es: string; en: string } }
> = {
  agriculture: {
    unitKind: 'parcel',
    unitLabel: { pt: 'Parcela', es: 'Parcela', en: 'Plot' },
  },
  agroindustry: {
    unitKind: 'lot',
    unitLabel: { pt: 'Lote / planta', es: 'Lote / planta', en: 'Lot / plant' },
  },
  livestock: {
    unitKind: 'herd',
    unitLabel: { pt: 'Rebanho', es: 'Rebaño', en: 'Herd' },
  },
  carbon: {
    unitKind: 'generic',
    unitLabel: { pt: 'Espaço de leitura', es: 'Espacio de lectura', en: 'Reading space' },
  },
};

export function isRadarModuleId(v: string): v is RadarModuleId {
  return RADAR_MODULES.some((m) => m.id === v);
}

export function moduleMeta(id: RadarModuleId) {
  return RADAR_MODULES.find((m) => m.id === id)!;
}
