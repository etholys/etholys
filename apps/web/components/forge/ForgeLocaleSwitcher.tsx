'use client';

import { useApp } from '@/app/providers';
import type { Locale } from '@/lib/i18n';

const opts: { id: Locale; label: string }[] = [
  { id: 'es', label: 'ES' },
  { id: 'pt', label: 'PT' },
  { id: 'en', label: 'EN' },
];

export function ForgeLocaleSwitcher() {
  const { locale, setLocale } = useApp();
  return (
    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setLocale(o.id)}
          className={`px-2 py-1 ${locale === o.id ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
