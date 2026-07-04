'use client';

import { useCallback } from 'react';
import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';
import { forgeT, forgeTFormat } from '@/lib/forge/i18n';

export function useForgeLocale(): Locale {
  const { locale } = useApp();
  return (locale as Locale) || 'es';
}

export function useForgeT() {
  const loc = useForgeLocale();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      vars ? forgeTFormat(key, loc, vars) : forgeT(key, loc),
    [loc]
  );
}
