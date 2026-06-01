/** Casillas del tablero La Expedición — textos para tooltips. */
export const BOARD_STATION_META = [
  { name: 'Raíces', color: 'bg-emerald-500', ring: 'ring-emerald-300', desc: 'Propósito, triple impacto y cliente ideal (LOHAS).' },
  { name: 'Acción', color: 'bg-amber-400', ring: 'ring-amber-200', desc: 'Decisiones rápidas: lanza el dado y avanza el plan.' },
  { name: 'Tierra', color: 'bg-amber-700', ring: 'ring-amber-400', desc: 'Recursos, suelo y cadena de valor local.' },
  { name: 'Desafío', color: 'bg-red-500', ring: 'ring-red-300', desc: 'Obstáculo o coste: puede restar Eco-Créditos.' },
  { name: 'Alquimia', color: 'bg-orange-500', ring: 'ring-orange-300', desc: 'Transformar materia prima en propuesta de valor.' },
  { name: 'Mercado', color: 'bg-sky-500', ring: 'ring-sky-300', desc: 'Precio, canal y competencia.' },
  { name: 'Futuro', color: 'bg-violet-600', ring: 'ring-violet-300', desc: 'Visión, escalabilidad e impacto a largo plazo.' },
] as const;

const PATTERN = [0, 1, 2, 3, 4, 1, 5, 3, 4, 1, 2, 3, 0, 1, 4, 3, 5, 1, 6, 3];

export function stationForSpace(i: number) {
  return BOARD_STATION_META[PATTERN[i % PATTERN.length]] ?? BOARD_STATION_META[0];
}

export function spaceTooltip(i: number, spaces: number): string {
  const st = stationForSpace(i);
  const extra = i === 0 ? ' Salida de la expedición.' : i === spaces - 1 ? ' Meta de la pista colectiva.' : '';
  return `Casilla ${i} · ${st.name}: ${st.desc}${extra}`;
}

export const PLAYER_PAWN_COLORS = [
  '#22c55e',
  '#3b82f6',
  '#f59e0b',
  '#ec4899',
  '#8b5cf6',
  '#14b8a6',
  '#ef4444',
  '#06b6d4',
] as const;
