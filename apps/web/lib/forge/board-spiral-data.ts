/** Tabuleiro físico La Expedición — caracol 30 casillas (material de juego) */

export type SpiralTileIcon =
  | 'leaf'
  | 'zap'
  | 'sprout'
  | 'hand'
  | 'flask'
  | 'megaphone'
  | 'calendar';

export type SpiralTileDef = {
  n: number;
  bg: string;
  icon: SpiralTileIcon;
  label?: string;
};

/** Secuencia exacta del tablero impreso (01 → 30) */
export const SPIRAL_BOARD_TILES: SpiralTileDef[] = [
  { n: 1, bg: '#1F5C48', icon: 'leaf', label: 'SALIDA' },
  { n: 2, bg: '#7DAF7A', icon: 'zap' },
  { n: 3, bg: '#1C1C1C', icon: 'sprout' },
  { n: 4, bg: '#4D9B8C', icon: 'hand' },
  { n: 5, bg: '#1F5C48', icon: 'leaf' },
  { n: 6, bg: '#7DAF7A', icon: 'zap' },
  { n: 7, bg: '#4554B8', icon: 'flask' },
  { n: 8, bg: '#A5D8F0', icon: 'megaphone' },
  { n: 9, bg: '#4554B8', icon: 'flask' },
  { n: 10, bg: '#A5D8F0', icon: 'megaphone' },
  { n: 11, bg: '#5CB868', icon: 'calendar' },
  { n: 12, bg: '#A5D8F0', icon: 'megaphone' },
  { n: 13, bg: '#1C1C1C', icon: 'sprout' },
  { n: 14, bg: '#7DAF7A', icon: 'zap' },
  { n: 15, bg: '#5CB868', icon: 'calendar' },
  { n: 16, bg: '#A5D8F0', icon: 'megaphone' },
  { n: 17, bg: '#4D9B8C', icon: 'hand' },
  { n: 18, bg: '#1F5C48', icon: 'leaf' },
  { n: 19, bg: '#4554B8', icon: 'flask' },
  { n: 20, bg: '#A5D8F0', icon: 'megaphone' },
  { n: 21, bg: '#4554B8', icon: 'flask' },
  { n: 22, bg: '#7DAF7A', icon: 'zap' },
  { n: 23, bg: '#4D9B8C', icon: 'hand' },
  { n: 24, bg: '#7DAF7A', icon: 'zap' },
  { n: 25, bg: '#1F5C48', icon: 'leaf' },
  { n: 26, bg: '#4D9B8C', icon: 'hand' },
  { n: 27, bg: '#1C1C1C', icon: 'sprout' },
  { n: 28, bg: '#A5D8F0', icon: 'megaphone' },
  { n: 29, bg: '#4D9B8C', icon: 'hand' },
  { n: 30, bg: '#5CB868', icon: 'calendar', label: 'META' },
];

/** Motor digital usa 0…19 → casilla física 1…30 */
export function positionToSpiralTile(position: number, spaces = 20): number {
  if (spaces <= 1) return 1;
  const p = Math.max(0, Math.min(position, spaces - 1));
  return Math.round(1 + (p / (spaces - 1)) * 29);
}

export function spiralTileByNumber(n: number): SpiralTileDef {
  return SPIRAL_BOARD_TILES[n - 1] ?? SPIRAL_BOARD_TILES[0];
}

/** Texto legible sobre fondo claro */
export function spiralTileTextColor(bg: string): string {
  const light = ['#A5D8F0', '#7DAF7A', '#5CB868'];
  return light.includes(bg) ? '#1A3D5C' : '#FFFFFF';
}

/** Leyenda del tablero físico — colores alineados con iconos del caracol */
export type SpiralLegendKey =
  | 'raices'
  | 'tierra'
  | 'alquimia'
  | 'futuro'
  | 'mercado'
  | 'desafio'
  | 'accion';

export type SpiralLegendItem = {
  key: SpiralLegendKey;
  color: string;
};

/** Sección superior (5 estaciones) + inferior (acción/desafío) */
export const SPIRAL_BOARD_LEGEND: {
  top: SpiralLegendItem[];
  bottom: SpiralLegendItem[];
} = {
  top: [
    { key: 'raices', color: '#1F5C48' },
    { key: 'tierra', color: '#1C1C1C' },
    { key: 'alquimia', color: '#4554B8' },
    { key: 'futuro', color: '#5CB868' },
    { key: 'mercado', color: '#A5D8F0' },
  ],
  bottom: [
    { key: 'desafio', color: '#7DAF7A' },
    { key: 'accion', color: '#4D9B8C' },
  ],
};
