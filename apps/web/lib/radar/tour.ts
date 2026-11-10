/**
 * RADAR first-run coach-mark tour — step ids, copy, localStorage progress.
 * MVP: per user+company in localStorage (no migration).
 */

import { radarT, type RadarLoc } from '@/lib/radar/i18n';

export const RADAR_TOUR_VERSION = 1;

export type RadarTourStepId =
  | 'home-create'
  | 'name-property'
  | 'pin-map'
  | 'create-space'
  | 'place-space'
  | 'add-crop'
  | 'caderno'
  | 'sensors-auto'
  | 'assistant';

export type RadarTourProgress = {
  v: typeof RADAR_TOUR_VERSION;
  /** Completed or skipped — do not auto-start. */
  done: boolean;
  /** Current step index when active. */
  stepIndex: number;
  /** Flow started from empty home vs property. */
  mode: 'home' | 'property';
  updatedAt: string;
};

export type RadarTourStepDef = {
  id: RadarTourStepId;
  /** CSS selector for spotlight target (`[data-radar-tour="…"]`). */
  target: string;
  /** Prefer opening this panel/tool before highlighting. */
  open?: 'characterize' | 'geolocate' | 'space' | 'crops' | 'sensors' | null;
  /** Route hint — home steps only on /hub/radar; property steps need /properties/. */
  scope: 'home' | 'property' | 'any';
  title: (loc: RadarLoc) => string;
  body: (loc: RadarLoc) => string;
};

export const RADAR_TOUR_STEPS: RadarTourStepDef[] = [
  {
    id: 'home-create',
    target: '[data-radar-tour="home-create"]',
    scope: 'home',
    title: (loc) => radarT(loc, 'Cria o primeiro lugar', 'Creá el primer lugar', 'Create the first place'),
    body: (loc) =>
      radarT(
        loc,
        'Um espaço = uma fazenda, horta ou planta. Sem isto o mapa fica vazio.',
        'Un espacio = una finca, huerta o planta. Sin esto el mapa queda vacío.',
        'A place = a farm, garden or plant. Without it the map stays empty.',
      ),
  },
  {
    id: 'name-property',
    target: '[data-radar-tour="settings"]',
    open: 'characterize',
    scope: 'property',
    title: (loc) => radarT(loc, 'Nomeia e caracteriza', 'Nombrá y caracterizá', 'Name and characterize'),
    body: (loc) =>
      radarT(
        loc,
        'Abre Ajustes: nome, módulo (agricultura…) e área. Isto alimenta o funil do sítio.',
        'Abrí Ajustes: nombre, módulo (agricultura…) y área. Esto alimenta el embudo del sitio.',
        'Open Settings: name, module (agriculture…) and area. This feeds the site funnel.',
      ),
  },
  {
    id: 'pin-map',
    target: '[data-radar-tour="geolocate"]',
    open: 'geolocate',
    scope: 'property',
    title: (loc) => radarT(loc, 'Marca no mapa', 'Marcá en el mapa', 'Pin on the map'),
    body: (loc) =>
      radarT(
        loc,
        'Geolocaliza o sítio (OSM). Sem pin, os espaços não têm onde pousar.',
        'Geolocalizá el sitio (OSM). Sin pin, los espacios no tienen dónde posarse.',
        'Geolocate the site (OSM). Without a pin, spaces have nowhere to land.',
      ),
  },
  {
    id: 'create-space',
    target: '[data-radar-tour="new-space"]',
    open: 'space',
    scope: 'property',
    title: (loc) => radarT(loc, 'Cria o primeiro espaço', 'Creá el primer espacio', 'Create the first space'),
    body: (loc) =>
      radarT(
        loc,
        'Parcela, canteiro ou linha — a unidade onde vais medir e anotar.',
        'Parcela, cantero o línea — la unidad donde vas a medir y anotar.',
        'Parcel, bed or row — the unit where you measure and log.',
      ),
  },
  {
    id: 'place-space',
    target: '[data-radar-tour="place-space"]',
    scope: 'property',
    title: (loc) => radarT(loc, 'Coloca no mapa', 'Colocá en el mapa', 'Place on the map'),
    body: (loc) =>
      radarT(
        loc,
        'Com o espaço seleccionado, usa «Colocar no mapa» e toca o sítio. Depois podes mover e rodar.',
        'Con el espacio seleccionado, usá «Colocar en el mapa» y tocá el sitio. Después podés mover y girar.',
        'With the space selected, use “Place on map” and tap the site. Then you can move and rotate.',
      ),
  },
  {
    id: 'add-crop',
    target: '[data-radar-tour="crops"]',
    open: 'crops',
    scope: 'property',
    title: (loc) => radarT(loc, 'Adiciona um cultivo', 'Agregá un cultivo', 'Add a crop'),
    body: (loc) =>
      radarT(
        loc,
        'Cultivos do sítio ligam-se aos espaços e ao Caderno (plantio, colheita…).',
        'Los cultivos del sitio se ligan a los espacios y al Cuaderno (siembra, cosecha…).',
        'Site crops link to spaces and the Notebook (planting, harvest…).',
      ),
  },
  {
    id: 'caderno',
    target: '[data-radar-tour="caderno"]',
    scope: 'property',
    title: (loc) => radarT(loc, 'Regista no Caderno', 'Registrá en el Cuaderno', 'Log in the Notebook'),
    body: (loc) =>
      radarT(
        loc,
        'O gesto diário: irrigação, insumos, pragas, colheita. Sem Caderno o Assistente não tem contexto.',
        'El gesto diario: riego, insumos, plagas, cosecha. Sin Cuaderno el Asistente no tiene contexto.',
        'The daily gesture: irrigation, inputs, pests, harvest. Without Notebook the Assistant has no context.',
      ),
  },
  {
    id: 'sensors-auto',
    target: '[data-radar-tour="sensors"]',
    open: 'sensors',
    scope: 'property',
    title: (loc) => radarT(loc, 'Sensores e automatização', 'Sensores y automatización', 'Sensors and automation'),
    body: (loc) =>
      radarT(
        loc,
        'Liga uma sonda ao espaço. Em Automatização podes amarrar humidade → regra / válvula.',
        'Conectá una sonda al espacio. En Automatización podés amarrar humedad → regla / válvula.',
        'Bind a probe to the space. In Automation you can wire moisture → rule / valve.',
      ),
  },
  {
    id: 'assistant',
    target: '[data-radar-tour="assistant"]',
    scope: 'any',
    title: (loc) => radarT(loc, 'Pergunta ao Assistente', 'Preguntá al Asistente', 'Ask the Assistant'),
    body: (loc) =>
      radarT(
        loc,
        'Com dados no sítio, o Assistente sugere o próximo passo (irrigar, PHI, percorrer).',
        'Con datos en el sitio, el Asistente sugiere el próximo paso (regar, PHI, recorrer).',
        'With site data, the Assistant suggests the next step (irrigate, PHI, scout).',
      ),
  },
];

export function tourStorageKey(companyId: string, userId?: string | null): string {
  return `radar.tour.v${RADAR_TOUR_VERSION}.${userId || 'anon'}.${companyId}`;
}

export function readTourProgress(companyId: string, userId?: string | null): RadarTourProgress | null {
  if (typeof window === 'undefined' || !companyId) return null;
  try {
    const raw = localStorage.getItem(tourStorageKey(companyId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RadarTourProgress;
    if (!parsed || parsed.v !== RADAR_TOUR_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeTourProgress(
  companyId: string,
  progress: RadarTourProgress,
  userId?: string | null,
): void {
  if (typeof window === 'undefined' || !companyId) return;
  try {
    localStorage.setItem(tourStorageKey(companyId, userId), JSON.stringify(progress));
  } catch {
    /* quota / private mode */
  }
}

export function clearTourProgress(companyId: string, userId?: string | null): void {
  if (typeof window === 'undefined' || !companyId) return;
  try {
    localStorage.removeItem(tourStorageKey(companyId, userId));
  } catch {
    /* ignore */
  }
}

export function startTourProgress(mode: 'home' | 'property'): RadarTourProgress {
  return {
    v: RADAR_TOUR_VERSION,
    done: false,
    /** Index into `stepsForMode(mode)` — always starts at 0. */
    stepIndex: 0,
    mode,
    updatedAt: new Date().toISOString(),
  };
}

export function stepsForMode(mode: 'home' | 'property'): RadarTourStepDef[] {
  if (mode === 'home') return RADAR_TOUR_STEPS;
  return RADAR_TOUR_STEPS.filter((s) => s.id !== 'home-create');
}

/** Custom event — layout listens and opens the coach. */
export const RADAR_TOUR_EVENT = 'radar-tour:control';

export type RadarTourControlDetail =
  | { action: 'start'; mode?: 'home' | 'property' }
  | { action: 'restart' }
  | { action: 'stop' };

export function dispatchTourControl(detail: RadarTourControlDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(RADAR_TOUR_EVENT, { detail }));
}

/** Query helpers used after create / first visit. */
export function shouldAutoStartTour(progress: RadarTourProgress | null): boolean {
  return !progress || (!progress.done && progress.stepIndex >= 0);
}
