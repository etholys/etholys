/** Casillas del tablero La Expedición V2 — paleta Rural Commerce */
export const BOARD_STATION_META = [
  { name: 'Raíces', color: 'bg-[#1B5E4B]', ring: 'ring-[#2E7D5A]', desc: 'Propósito, triple impacto y cliente ideal (LOHAS).' },
  { name: 'Acción', color: 'bg-[#F4B942]', ring: 'ring-[#E5A82E]', desc: 'Decisiones rápidas: lanza el dado y avanza el plan.' },
  { name: 'Tierra', color: 'bg-[#8B5A2B]', ring: 'ring-[#A67C52]', desc: 'Recursos, suelo y cadena de valor local.' },
  { name: 'Desafío', color: 'bg-[#C62828]', ring: 'ring-[#B71C1C]', desc: 'Obstáculo o coste: puede restar Eco-Créditos.' },
  { name: 'Alquimia', color: 'bg-[#C45C26]', ring: 'ring-[#D97340]', desc: 'Transformar materia prima en propuesta de valor.' },
  { name: 'Mercado', color: 'bg-[#1E6B8C]', ring: 'ring-[#2980A8]', desc: 'Precio, canal y competencia.' },
  { name: 'Futuro', color: 'bg-[#5B3E8C]', ring: 'ring-[#7B5BA8]', desc: 'Visión, escalabilidad e impacto a largo plazo.' },
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
