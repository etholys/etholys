/** Sincronização de diapositivas na sala en vivo (estado JSON da partida). */
export const PRESENTATION_SLIDE_KEY = '_presentationSlideIndex';

export function readPresentationSlideIndex(state: Record<string, unknown>): number {
  const v = state[PRESENTATION_SLIDE_KEY];
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0;
}

export function withPresentationSlideIndex(
  state: Record<string, unknown>,
  index: number
): Record<string, unknown> {
  return { ...state, [PRESENTATION_SLIDE_KEY]: Math.max(0, Math.floor(index)) };
}
