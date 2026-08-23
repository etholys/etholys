/**
 * Identidade de produto — CHORUS (não “Meet”, para não confundir com Google Meet).
 * Rotas técnicas mantêm `/hub/meet` e `MeetSession` por compatibilidade.
 */

export const CHORUS_PRODUCT_NAME = 'CHORUS';
export const CHORUS_PRODUCT_FULL = 'Etholys CHORUS';

export const CHORUS_TAGLINE = {
  pt: 'Conversas que ficam — áudio, voz e memória da reunião',
  es: 'Conversaciones que permanecen — audio, voz y memoria de la reunión',
  en: 'Conversations that stay — audio, voice, and meeting memory',
} as const;

export function chorusName(locale?: string | null): string {
  return CHORUS_PRODUCT_NAME;
}

export function chorusTagline(locale?: string | null): string {
  if (locale === 'es') return CHORUS_TAGLINE.es;
  if (locale === 'en') return CHORUS_TAGLINE.en;
  return CHORUS_TAGLINE.pt;
}
