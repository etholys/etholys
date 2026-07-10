/** Casillas del tablero La Expedición V2 — paleta Rural Commerce (material físico) */
export const BOARD_STATION_META = [
  {
    name: 'Raíces',
    color: 'bg-[#145A45]',
    ring: 'ring-[#5FAE4A]',
    desc: 'Propósito, triple impacto y cliente ideal (LOHAS).',
  },
  {
    name: 'Acción',
    color: 'bg-[#A8D5C4]',
    ring: 'ring-[#3D8B8B]',
    desc: 'Decisiones rápidas: lanza el dado y avanza el plan.',
  },
  {
    name: 'Tierra',
    color: 'bg-[#1A3D5C]',
    ring: 'ring-[#2E5C9A]',
    desc: 'Recursos, suelo y cadena de valor local.',
  },
  {
    name: 'Desafío',
    color: 'bg-[#3D8B8B]',
    ring: 'ring-[#2D7070]',
    desc: 'Obstáculo o coste: puede restar Eco-Créditos.',
  },
  {
    name: 'Alquimia',
    color: 'bg-[#2E5C9A]',
    ring: 'ring-[#1A3D5C]',
    desc: 'Transformar materia prima en propuesta de valor.',
  },
  {
    name: 'Mercado',
    color: 'bg-[#6EC4E8]',
    ring: 'ring-[#2E5C9A]',
    desc: 'Precio, canal y competencia.',
  },
  {
    name: 'Futuro',
    color: 'bg-[#5FAE4A]',
    ring: 'ring-[#145A45]',
    desc: 'Visión, escalabilidad e impacto a largo plazo.',
  },
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
  '#5FAE4A',
  '#2E5C9A',
  '#C9A227',
  '#6EC4E8',
  '#145A45',
  '#3D8B8B',
  '#1A3D5C',
  '#A8D5C4',
] as const;
