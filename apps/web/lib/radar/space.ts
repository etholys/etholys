import { RADAR_MODULES, type RadarModuleId } from '@/lib/etholys-products';

export type Loc = 'pt' | 'es' | 'en';

export const RADAR_SPACE_KINDS: Record<
  RadarModuleId,
  {
    unitKind: string;
    unitLabel: { pt: string; es: string; en: string };
    unitLabelPlural: { pt: string; es: string; en: string };
    /** Secondary field (crop / product / herd / indicator). */
    secondaryLabel: { pt: string; es: string; en: string };
    hint: { pt: string; es: string; en: string };
    exampleName: { pt: string; es: string; en: string };
    drawTitle: { pt: string; es: string; en: string };
    areaUnit: { pt: string; es: string; en: string };
  }
> = {
  agriculture: {
    unitKind: 'parcel',
    unitLabel: { pt: 'Parcela', es: 'Parcela', en: 'Plot' },
    unitLabelPlural: { pt: 'Parcelas', es: 'Parcelas', en: 'Plots' },
    secondaryLabel: { pt: 'Cultura', es: 'Cultivo', en: 'Crop' },
    hint: {
      pt: 'Um pedaço de terra no mapa para cultivar.',
      es: 'Un pedazo de tierra en el mapa para cultivar.',
      en: 'A plot of land on the map to cultivate.',
    },
    exampleName: { pt: 'ex.: Lavoura Norte', es: 'ej.: Lote Norte', en: 'e.g. North field' },
    drawTitle: { pt: 'Desenhar planta', es: 'Dibujar planta', en: 'Draw plant' },
    areaUnit: { pt: 'ha', es: 'ha', en: 'ha' },
  },
  agroindustry: {
    unitKind: 'lot',
    unitLabel: { pt: 'Sala / linha', es: 'Sala / línea', en: 'Room / line' },
    unitLabelPlural: { pt: 'Salas e linhas', es: 'Salas y líneas', en: 'Rooms & lines' },
    secondaryLabel: { pt: 'Produto', es: 'Producto', en: 'Product' },
    hint: {
      pt: 'Uma sala, esteira ou zona dentro da planta.',
      es: 'Una sala, cinta o zona dentro de la planta.',
      en: 'A room, line or zone inside the plant.',
    },
    exampleName: { pt: 'ex.: Empacotamento', es: 'ej.: Empaque', en: 'e.g. Packing' },
    drawTitle: { pt: 'Desenhar planta industrial', es: 'Dibujar planta industrial', en: 'Draw plant layout' },
    areaUnit: { pt: 'm²', es: 'm²', en: 'm²' },
  },
  livestock: {
    unitKind: 'herd',
    unitLabel: { pt: 'Rebanho / curral', es: 'Rebaño / corral', en: 'Herd / pen' },
    unitLabelPlural: { pt: 'Rebanhos', es: 'Rebaños', en: 'Herds' },
    secondaryLabel: { pt: 'Espécie', es: 'Especie', en: 'Species' },
    hint: {
      pt: 'Um grupo de animais ou um curral no mapa.',
      es: 'Un grupo de animales o un corral en el mapa.',
      en: 'A herd or pen on the map.',
    },
    exampleName: { pt: 'ex.: Curral 2', es: 'ej.: Corral 2', en: 'e.g. Pen 2' },
    drawTitle: { pt: 'Desenhar sítios', es: 'Dibujar sitios', en: 'Draw sites' },
    areaUnit: { pt: 'ha', es: 'ha', en: 'ha' },
  },
  carbon: {
    unitKind: 'generic',
    unitLabel: { pt: 'Ponto de leitura', es: 'Punto de lectura', en: 'Reading point' },
    unitLabelPlural: { pt: 'Pontos de leitura', es: 'Puntos de lectura', en: 'Reading points' },
    secondaryLabel: { pt: 'Indicador', es: 'Indicador', en: 'Indicator' },
    hint: {
      pt: 'Um ponto onde medimos ou registamos carbono.',
      es: 'Un punto donde medimos o registramos carbono.',
      en: 'A point where we measure or log carbon.',
    },
    exampleName: { pt: 'ex.: Sequestro A', es: 'ej.: Secuestro A', en: 'e.g. Sink A' },
    drawTitle: { pt: 'Desenhar pontos', es: 'Dibujar puntos', en: 'Draw points' },
    areaUnit: { pt: 'ha', es: 'ha', en: 'ha' },
  },
};

export function isRadarModuleId(v: string): v is RadarModuleId {
  return RADAR_MODULES.some((m) => m.id === v);
}

export function moduleMeta(id: RadarModuleId) {
  return RADAR_MODULES.find((m) => m.id === id)!;
}

export function spaceKindMeta(moduleId: string | null | undefined) {
  if (moduleId && isRadarModuleId(moduleId)) return RADAR_SPACE_KINDS[moduleId];
  return RADAR_SPACE_KINDS.agriculture;
}
