/** Preferência de aparência do Hub / sistemas Etholys (claro | escuro). */

export type Appearance = 'dark' | 'light';

export const APPEARANCE_STORAGE_KEY = 'etholys_appearance';
export const APPEARANCE_COOKIE = 'etholys_appearance';

export function normalizeAppearance(raw: string | null | undefined): Appearance {
  return raw === 'light' ? 'light' : 'dark';
}

export function applyAppearanceToDocument(appearance: Appearance) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.style.colorScheme = appearance;
}

export function readStoredAppearance(): Appearance {
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(/(?:^|; )etholys_appearance=([^;]*)/);
    if (m) return normalizeAppearance(decodeURIComponent(m[1]));
  }
  if (typeof localStorage !== 'undefined') {
    return normalizeAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY));
  }
  return 'dark';
}

export function persistAppearance(appearance: Appearance) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  }
  if (typeof document !== 'undefined') {
    document.cookie = `${APPEARANCE_COOKIE}=${appearance}; path=/; max-age=31536000; SameSite=Lax`;
    applyAppearanceToDocument(appearance);
  }
}
