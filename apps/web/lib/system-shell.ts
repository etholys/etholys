export type SystemAccent = 'teal' | 'indigo' | 'amber' | 'violet';

const GLOW: Record<SystemAccent, string> = {
  teal: 'bg-[radial-gradient(120%_80%_at_78%_8%,rgba(13,148,136,0.26),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(15,23,42,0.9),transparent_50%),linear-gradient(165deg,#041018_0%,#0B1C24_42%,#07111A_100%)]',
  indigo:
    'bg-[radial-gradient(120%_80%_at_78%_8%,rgba(99,102,241,0.24),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(15,23,42,0.9),transparent_50%),linear-gradient(165deg,#041018_0%,#0B1C24_42%,#07111A_100%)]',
  amber:
    'bg-[radial-gradient(120%_80%_at_78%_8%,rgba(217,119,6,0.22),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(15,23,42,0.9),transparent_50%),linear-gradient(165deg,#041018_0%,#0B1C24_42%,#07111A_100%)]',
  violet:
    'bg-[radial-gradient(120%_80%_at_78%_8%,rgba(124,58,237,0.24),transparent_52%),radial-gradient(90%_70%_at_8%_92%,rgba(15,23,42,0.9),transparent_50%),linear-gradient(165deg,#041018_0%,#0B1C24_42%,#07111A_100%)]',
};

const ORBIT: Record<SystemAccent, { fast: string; slow: string }> = {
  teal: { fast: 'border-teal-400/15', slow: 'border-teal-300/10' },
  indigo: { fast: 'border-indigo-400/15', slow: 'border-indigo-300/10' },
  amber: { fast: 'border-amber-400/15', slow: 'border-amber-300/10' },
  violet: { fast: 'border-violet-400/15', slow: 'border-violet-300/10' },
};

export const sysTheme = {
  glow: (accent: SystemAccent) => GLOW[accent],
  orbit: (accent: SystemAccent) => ORBIT[accent],
  root: 'etholys-system etholys-hub relative isolate flex min-h-screen overflow-hidden bg-[#07111A] text-[#E8EEF2]',
  aside:
    'fixed inset-y-0 left-0 z-50 flex transform flex-col border-r border-white/10 bg-[#07111A]/88 backdrop-blur-md transition-all',
  icon: {
    teal: 'border-teal-400/30 bg-teal-500/15 text-teal-300',
    indigo: 'border-indigo-400/30 bg-indigo-500/15 text-indigo-300',
    amber: 'border-amber-400/30 bg-amber-500/15 text-amber-300',
    violet: 'border-violet-400/30 bg-violet-500/15 text-violet-300',
  } as Record<SystemAccent, string>,
  active: {
    teal: 'bg-teal-500/15 text-teal-100',
    indigo: 'bg-indigo-500/15 text-indigo-100',
    amber: 'bg-amber-500/15 text-amber-100',
    violet: 'bg-violet-500/15 text-violet-100',
  } as Record<SystemAccent, string>,
  muted: {
    teal: 'text-teal-200',
    indigo: 'text-indigo-200',
    amber: 'text-amber-200',
    violet: 'text-violet-200',
  } as Record<SystemAccent, string>,
  avatar: {
    teal: 'bg-teal-500/20 text-teal-100',
    indigo: 'bg-indigo-500/20 text-indigo-100',
    amber: 'bg-amber-500/20 text-amber-100',
    violet: 'bg-violet-500/20 text-violet-100',
  } as Record<SystemAccent, string>,
  spin: {
    teal: 'border-teal-400/25 border-t-teal-400',
    indigo: 'border-indigo-400/25 border-t-indigo-400',
    amber: 'border-amber-400/25 border-t-amber-400',
    violet: 'border-violet-400/25 border-t-violet-400',
  } as Record<SystemAccent, string>,
  navIdle: 'text-white/55 hover:bg-white/[0.05] hover:text-white',
  brand: 'font-[family-name:var(--font-etholys-display)] text-sm font-bold tracking-[0.14em] text-white',
};

export function sysNav(active: boolean, accent: SystemAccent, collapsed = false) {
  return [
    'flex items-center rounded-lg text-sm font-medium transition',
    collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5',
    active ? sysTheme.active[accent] : sysTheme.navIdle,
  ].join(' ');
}
