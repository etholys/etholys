export type MeetSpeechLanguage = 'pt' | 'es' | 'en' | 'auto';

export function resolveMeetSpeechLanguage(opts: {
  explicit?: string | null;
  uiLocale?: string | null;
}): 'pt' | 'es' | 'en' | undefined {
  const raw = (opts.explicit || '').trim().toLowerCase();
  if (raw === 'pt' || raw === 'es' || raw === 'en') return raw;
  if (raw === 'auto' || raw === '') {
    const ui = (opts.uiLocale || '').trim().toLowerCase();
    if (ui === 'pt' || ui === 'es' || ui === 'en') return ui;
    if (typeof navigator !== 'undefined') {
      const nav = navigator.language.toLowerCase();
      if (nav.startsWith('pt')) return 'pt';
      if (nav.startsWith('es')) return 'es';
      if (nav.startsWith('en')) return 'en';
    }
    return 'pt';
  }
  return undefined;
}

export function meetSpeechLanguageLabel(
  lang: MeetSpeechLanguage,
  t: (pt: string, es: string, en: string) => string,
): string {
  if (lang === 'pt') return t('Português', 'Portugués', 'Portuguese');
  if (lang === 'en') return t('English', 'Inglés', 'English');
  if (lang === 'es') return t('Español', 'Español', 'Spanish');
  return t('Automático', 'Automático', 'Auto');
}
