'use client';

import type { SystemAccent } from '@/lib/system-shell';
import { sysTheme } from '@/lib/system-shell';
import { useApp } from '@/app/providers';
import { cn } from '@/lib/utils';

const LIGHT_GLOW: Record<SystemAccent, string> = {
  teal: 'bg-[radial-gradient(120%_80%_at_78%_8%,rgba(13,148,136,0.12),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(241,245,249,0.9),transparent_50%),linear-gradient(165deg,#F8FAFC_0%,#F1F5F9_42%,#EEF2F7_100%)]',
  indigo:
    'bg-[radial-gradient(120%_80%_at_78%_8%,rgba(99,102,241,0.1),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(241,245,249,0.9),transparent_50%),linear-gradient(165deg,#F8FAFC_0%,#F1F5F9_42%,#EEF2F7_100%)]',
  amber:
    'bg-[radial-gradient(120%_80%_at_78%_8%,rgba(217,119,6,0.1),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(241,245,249,0.9),transparent_50%),linear-gradient(165deg,#F8FAFC_0%,#F1F5F9_42%,#EEF2F7_100%)]',
  violet:
    'bg-[radial-gradient(120%_80%_at_78%_8%,rgba(124,58,237,0.1),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(241,245,249,0.9),transparent_50%),linear-gradient(165deg,#F8FAFC_0%,#F1F5F9_42%,#EEF2F7_100%)]',
};

const LIGHT_ORBIT: Record<SystemAccent, { fast: string; slow: string }> = {
  teal: { fast: 'border-teal-600/15', slow: 'border-teal-500/10' },
  indigo: { fast: 'border-indigo-500/15', slow: 'border-indigo-400/10' },
  amber: { fast: 'border-amber-600/15', slow: 'border-amber-500/10' },
  violet: { fast: 'border-violet-500/15', slow: 'border-violet-400/10' },
};

export function SystemAtmosphere({ accent }: { accent: SystemAccent }) {
  const { appearance } = useApp();
  const light = appearance === 'light';
  const glow = light ? LIGHT_GLOW[accent] : sysTheme.glow(accent);
  const orbit = light ? LIGHT_ORBIT[accent] : sysTheme.orbit(accent);

  return (
    <>
      <div aria-hidden className={cn('pointer-events-none absolute inset-0', glow)} />
      <div
        aria-hidden
        className={cn(
          'etholys-site-grid pointer-events-none absolute inset-0',
          light ? 'opacity-[0.35]' : 'opacity-[0.12]',
        )}
      />
      <div
        aria-hidden
        className={cn(
          'etholys-site-orbit pointer-events-none absolute -right-[24%] top-[-10%] h-[78vmin] w-[78vmin] rounded-full',
          orbit.fast,
          light && 'opacity-60',
        )}
      />
      <div
        aria-hidden
        className={cn(
          'etholys-site-orbit-slow pointer-events-none absolute -right-[8%] top-[18%] h-[46vmin] w-[46vmin] rounded-full',
          orbit.slow,
          light && 'opacity-50',
        )}
      />
    </>
  );
}
