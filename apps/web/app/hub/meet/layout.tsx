import type { ReactNode } from 'react';

/**
 * CHORUS routes: paint the hub content region edge-to-edge so the default
 * white body never shows as right/bottom gutters behind the shell.
 * Do not add `.etholys-meet` here — that class remaps light Tailwind tokens and
 * must stay on the hub/agenda shells only, not on live room surfaces.
 */
export default function MeetLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-dvh w-full bg-[color:var(--sys-canvas-bg,#07111A)]">
      {children}
    </div>
  );
}
