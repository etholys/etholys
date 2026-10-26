'use client';

import { Suspense } from 'react';
import { SystemAtmosphere } from '@/components/hub/SystemAtmosphere';
import { sysTheme } from '@/lib/system-shell';
import { cn } from '@/lib/utils';
import WorkShell from '@/components/work/WorkShell';

export default function HubWorkPage() {
  return (
    <div className={cn(sysTheme.root, 'etholys-etask')} data-accent="teal">
      <SystemAtmosphere accent="teal" />
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <div className={cn('h-8 w-8 animate-spin rounded-full border-2', sysTheme.spin.teal)} />
          </div>
        }
      >
        <WorkShell />
      </Suspense>
    </div>
  );
}
