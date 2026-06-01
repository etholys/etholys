/** Como o jogo corre no curso: mapa pessoal vs tabuleiro compartido do facilitador. */

export type ForgeGamePlayMode = 'personal' | 'shared_live';

export const FORGE_GAME_PLAY_MODES: { id: ForgeGamePlayMode; label: string; desc: string }[] = [
  {
    id: 'personal',
    label: 'Tablero personal (cada alumno)',
    desc: 'Cada cuenta tiene su propia pista de 20 casillas y Eco-Créditos (modo autónomo).',
  },
  {
    id: 'shared_live',
    label: 'Tablero colectivo + mapa personal',
    desc: 'Un tablero central en la sesión en vivo; cada alumno monta su mapa (modelo de negocio).',
  },
];

export function parseGamePlayMode(v: unknown): ForgeGamePlayMode {
  if (v === 'shared_live') return 'shared_live';
  return 'personal';
}

export function usesPersonalGame(mode: ForgeGamePlayMode): boolean {
  return mode === 'personal';
}
