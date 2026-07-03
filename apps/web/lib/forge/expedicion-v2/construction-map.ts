import type { ExpedicionStationSlug } from '@/lib/forge/expedicion-station-decks';
import type {
  ConstructionConnection,
  ConstructionMapState,
  ConstructionPostIt,
  PostItType,
} from '@/lib/forge/expedicion-v2/types';

const STATIONS: ExpedicionStationSlug[] = ['raices', 'tierra', 'alquimia', 'mercado', 'futuro'];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyConstructionMap(): ConstructionMapState {
  return { postIts: [], connections: [] };
}

export function addPostIt(
  map: ConstructionMapState,
  station: ExpedicionStationSlug,
  type: PostItType,
  text: string,
  x = 24,
  y = 24
): ConstructionMapState {
  const postIt: ConstructionPostIt = {
    id: uid('pi'),
    station,
    type,
    text,
    x,
    y,
    createdAt: new Date().toISOString(),
  };
  return { ...map, postIts: [...map.postIts, postIt] };
}

export function updatePostIt(
  map: ConstructionMapState,
  id: string,
  patch: Partial<Pick<ConstructionPostIt, 'text' | 'type' | 'x' | 'y'>>
): ConstructionMapState {
  return {
    ...map,
    postIts: map.postIts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  };
}

export function removePostIt(map: ConstructionMapState, id: string): ConstructionMapState {
  return {
    postIts: map.postIts.filter((p) => p.id !== id),
    connections: map.connections.filter((c) => c.fromPostItId !== id && c.toPostItId !== id),
  };
}

export function addConnection(
  map: ConstructionMapState,
  fromPostItId: string,
  toPostItId: string
): ConstructionMapState {
  if (fromPostItId === toPostItId) return map;
  const exists = map.connections.some(
    (c) =>
      (c.fromPostItId === fromPostItId && c.toPostItId === toPostItId) ||
      (c.fromPostItId === toPostItId && c.toPostItId === fromPostItId)
  );
  if (exists) return map;
  const conn: ConstructionConnection = { id: uid('cn'), fromPostItId, toPostItId };
  return { ...map, connections: [...map.connections, conn] };
}

export function countModulesWithFourSteps(map: ConstructionMapState): number {
  let complete = 0;
  for (const station of STATIONS) {
    const types = new Set(
      map.postIts.filter((p) => p.station === station).map((p) => p.type)
    );
    if (
      types.has('diagnostico') &&
      types.has('accion') &&
      types.has('inversion') &&
      types.has('metrica')
    ) {
      complete += 1;
    }
  }
  return complete;
}

export function parseConstructionMap(raw: unknown): ConstructionMapState {
  if (!raw || typeof raw !== 'object') return createEmptyConstructionMap();
  const o = raw as Partial<ConstructionMapState>;
  return {
    postIts: Array.isArray(o.postIts) ? (o.postIts as ConstructionPostIt[]) : [],
    connections: Array.isArray(o.connections) ? (o.connections as ConstructionConnection[]) : [],
  };
}
