'use client';

import { SessionProvider } from 'next-auth/react';
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

export default function Providers({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [locale, setLocale] = useState<Locale>('es');
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('rc360_locale') as Locale;
    if (saved === 'es' || saved === 'pt' || saved === 'en') setLocale(saved);
    const savedCompany = localStorage.getItem('rc360_company');
    if (savedCompany) setActiveCompanyId(savedCompany);
  }, []);

  const handleSetLocale = (l: Locale) => {
    setLocale(l);
    localStorage.setItem('rc360_locale', l);
  };

  const handleSetCompany = (id: string | null) => {
    setActiveCompanyId(id);
    if (id) localStorage.setItem('rc360_company', id);
    else localStorage.removeItem('rc360_company');
  };

  const tr = (key: string) => t(key, locale);

  if (!mounted) return <div className="min-h-screen" />;

  return (
    <SessionProvider>
      <AppContext.Provider value={{ locale, setLocale: handleSetLocale, activeCompanyId, setActiveCompanyId: handleSetCompany, tr }}>
        {children}
      </AppContext.Provider>
    </SessionProvider>
  );
}
