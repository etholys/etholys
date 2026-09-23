import type { SystemAccent } from '@/lib/system-shell';
import { sysTheme } from '@/lib/system-shell';

export function SystemAtmosphere({ accent }: { accent: SystemAccent }) {
  const orbit = sysTheme.orbit(accent);
  return (
    <>
      <div aria-hidden className={`pointer-events-none absolute inset-0 ${sysTheme.glow(accent)}`} />
      <div aria-hidden className="etholys-site-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
      <div
        aria-hidden
        className={`etholys-site-orbit pointer-events-none absolute -right-[24%] top-[-10%] h-[78vmin] w-[78vmin] rounded-full ${orbit.fast}`}
      />
      <div
        aria-hidden
        className={`etholys-site-orbit-slow pointer-events-none absolute -right-[8%] top-[18%] h-[46vmin] w-[46vmin] rounded-full ${orbit.slow}`}
      />
    </>
  );
}
