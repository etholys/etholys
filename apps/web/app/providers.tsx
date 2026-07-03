'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { useState, useEffect, createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n';
import { t } from '@/lib/i18n';

interface AppContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  activeCompanyId: string | null;
  setActiveCompanyId: (id: string | null) => void;
  tr: (key: string) => string;
}

const AppContext = createContext<AppContextType>({
  locale: 'es',
  setLocale: () => {},
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
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('rc360_locale') as Locale;
    if (saved === 'es' || saved === 'pt' || saved === 'en') setLocale(saved);
    const savedCompany = localStorage.getItem('rc360_company');
    if (savedCompany) {
      setActiveCompanyId(savedCompany);
      document.cookie = `rc360_company=${encodeURIComponent(savedCompany)}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, []);

  const handleSetLocale = (l: Locale) => {
    setLocale(l);
    localStorage.setItem('rc360_locale', l);
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

  // Always render children (SSR + first paint). Previously we returned an empty div until
  // mount, which dropped {children} entirely and caused a blank screen if JS/chunks failed to load.
  return (
    <SessionProvider session={session ?? undefined}>
      <AppContext.Provider value={{ locale, setLocale: handleSetLocale, activeCompanyId, setActiveCompanyId: handleSetCompany, tr }}>
        {children}
      </AppContext.Provider>
    </SessionProvider>
  );
}
