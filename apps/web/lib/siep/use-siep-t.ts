'use client';

import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';
import { siepT } from '@/lib/siep/i18n';

export function useSiepLocale(): Locale {
  const { locale } = useApp();
  return (locale as Locale) || 'es';
}

export function useSiepT() {
  const loc = useSiepLocale();
  return (key: string) => siepT(key, loc);
}
