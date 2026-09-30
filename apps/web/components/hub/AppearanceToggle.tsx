'use client';

import { Moon, Sun } from 'lucide-react';
import { useApp } from '@/app/providers';
import { cn } from '@/lib/utils';

/** Controlo discreto claro/escuro para sidebars do Hub. */
export function AppearanceToggle({
  collapsed,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { locale, appearance, setAppearance } = useApp();
  const light = appearance === 'light';

  const label = light
    ? locale === 'es'
      ? 'Tema oscuro'
      : locale === 'pt'
        ? 'Tema escuro'
        : 'Dark theme'
    : locale === 'es'
      ? 'Tema claro'
      : locale === 'pt'
        ? 'Tema claro'
        : 'Light theme';

  return (
    <button
      type="button"
      onClick={() => setAppearance(light ? 'dark' : 'light')}
      title={label}
      aria-label={label}
      aria-pressed={light}
      className={cn(
        'etholys-appearance-toggle flex items-center rounded-lg text-xs transition',
        collapsed ? 'justify-center p-2' : 'w-full gap-2 px-2.5 py-1.5',
        'text-white/45 hover:bg-white/5 hover:text-white',
        className,
      )}
    >
      {light ? <Moon className="h-3.5 w-3.5 shrink-0" /> : <Sun className="h-3.5 w-3.5 shrink-0" />}
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}
