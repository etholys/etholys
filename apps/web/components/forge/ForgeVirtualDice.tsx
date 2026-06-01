'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

export function ForgeVirtualDice({
  rolling,
  value,
  onRollComplete,
}: {
  rolling: boolean;
  value?: number;
  onRollComplete?: () => void;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!rolling) {
      if (value != null && value >= 1 && value <= 6) setDisplay(value - 1);
      return;
    }
    let n = 0;
    const t = setInterval(() => {
      setDisplay(Math.floor(Math.random() * 6));
      n += 1;
      if (n > 14) {
        clearInterval(t);
        if (value != null) setDisplay(value - 1);
        onRollComplete?.();
      }
    }, 80);
    return () => clearInterval(t);
  }, [rolling, value, onRollComplete]);

  return (
    <span
      className={cn(
        'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white text-3xl shadow-lg border-2 border-blue-200',
        rolling && 'animate-pulse scale-110'
      )}
      aria-hidden
    >
      {FACES[display] ?? FACES[0]}
    </span>
  );
}
