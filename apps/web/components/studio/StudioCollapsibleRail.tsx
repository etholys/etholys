'use client';

import type { ReactNode } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

type Props = {
  open: boolean;
  onToggle: () => void;
  widthPx: number;
  icon: ReactNode;
  title: string;
  variant?: 'write' | 'design';
  children: ReactNode;
};

export function StudioCollapsibleRail({
  open,
  onToggle,
  widthPx,
  icon,
  title,
  variant = 'write',
  children,
}: Props) {
  const railBg =
    variant === 'design'
      ? 'border-violet-900/50 bg-[#120c1a]'
      : 'border-stone-200 bg-[#faf8f5]';
  const btnClass =
    variant === 'design'
      ? 'text-violet-300 hover:bg-violet-900/60'
      : 'text-stone-500 hover:bg-stone-200/80';

  if (!open) {
    return (
      <aside
        className={`flex w-10 shrink-0 flex-col items-center border-r py-2 ${railBg}`}
        title={title}
      >
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-lg p-2 ${btnClass}`}
          aria-label={title}
        >
          {icon}
        </button>
        <button
          type="button"
          onClick={onToggle}
          className={`mt-1 rounded-md p-1 ${btnClass}`}
          title={title}
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={`relative flex shrink-0 flex-col ${railBg}`}
      style={{ width: widthPx, maxWidth: '100%' }}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`absolute right-1 top-1 z-10 rounded-md p-1 ${btnClass}`}
        title="Collapse"
      >
        <PanelLeftClose className="h-3.5 w-3.5" />
      </button>
      {children}
    </aside>
  );
}
