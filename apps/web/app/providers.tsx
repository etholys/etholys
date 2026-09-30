'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useState, useEffect, createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n';
import { normalizeLocale, t } from '@/lib/i18n';
import { ActiveCompanyBootstrap } from '@/components/hub/ActiveCompanyBootstrap';
import {
  applyAppearanceToDocument,
  normalizeAppearance,
  persistAppearance,
  readStoredAppearance,
  type Appearance,
} from '@/lib/appearance';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

/** Prefer cookie (survives first paint) then localStorage — avoids FundHub chrome flashing Spanish. */
function readStoredLocale(): Locale {
  const fromCookie = readCookie('rc360_locale');
  if (fromCookie === 'es' || fromCookie === 'pt' || fromCookie === 'en') return fromCookie;
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('rc360_locale');
    if (saved === 'es' || saved === 'pt' || saved === 'en') return saved;
  }
  return 'es';
}

interface AppContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** False until client has applied stored Hub language (avoid enrich/relocalize with default es). */
  localeReady: boolean;
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  tr: (key: string) => string;
}

const AppContext = createContext<AppContextType>({
  locale: 'es',
  setLocale: () => {},
  localeReady: false,
  appearance: 'dark',
  setAppearance: () => {},
  activeCompanyId: null,
  setActiveCompanyId: () => {},
  tr: (key: string) => key,
});

export function useApp() {
  return useContext(AppContext);
}

export default function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: Session | null;
}) {
  const [locale, setLocale] = useState<Locale>('es');
  const [localeReady, setLocaleReady] = useState(false);
  const [appearance, setAppearanceState] = useState<Appearance>('dark');
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const saved = readStoredLocale();
    setLocale(normalizeLocale(saved));
    document.cookie = `rc360_locale=${saved}; path=/; max-age=31536000; SameSite=Lax`;
    localStorage.setItem('rc360_locale', saved);
    setLocaleReady(true);
    const savedCompany = localStorage.getItem('rc360_company');
    if (savedCompany) {
      setActiveCompanyId(savedCompany);
      document.cookie = `rc360_company=${encodeURIComponent(savedCompany)}; path=/; max-age=31536000; SameSite=Lax`;
    }
    const nextAppearance = readStoredAppearance();
    setAppearanceState(nextAppearance);
    applyAppearanceToDocument(nextAppearance);
  }, []);

  const handleSetLocale = (l: Locale) => {
    const next = normalizeLocale(l);
    setLocale(next);
    localStorage.setItem('rc360_locale', next);
    document.cookie = `rc360_locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
  };

  const handleSetAppearance = (a: Appearance) => {
    const next = normalizeAppearance(a);
    setAppearanceState(next);
    persistAppearance(next);
  };

  const handleSetCompany = (id: string | null) => {
    setActiveCompanyId(id);
    if (id) {
      localStorage.setItem('rc360_company', id);
      document.cookie = `rc360_company=${encodeURIComponent(id)}; path=/; max-age=31536000; SameSite=Lax`;
    } else {
      localStorage.removeItem('rc360_company');
      document.cookie = 'rc360_company=; path=/; max-age=0; SameSite=Lax';
    }
  };

  const tr = (key: string) => t(key, locale);

  return (
    <SessionProvider session={session ?? undefined}>
      <AppContext.Provider
        value={{
          locale,
          setLocale: handleSetLocale,
          localeReady,
          appearance,
          setAppearance: handleSetAppearance,
          activeCompanyId,
          setActiveCompanyId: handleSetCompany,
          tr,
        }}
      >
        <ActiveCompanyBootstrap />
        {children}
      </AppContext.Provider>
    </SessionProvider>
  );
}
