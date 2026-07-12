'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react';
import { ForgeFacilitatorLensBar, type FacilitatorLens } from '@/components/forge/ForgeFacilitatorLensBar';
import { ForgeFacilitatorEcoOverview } from '@/components/forge/ForgeFacilitatorEcoOverview';
import { ForgeFacilitatorV2Controls } from '@/components/forge/ForgeFacilitatorV2Controls';
import { ForgeFacilitatorV2Panel } from '@/components/forge/ForgeFacilitatorV2Panel';
import { ForgeFeriaSessionPanel } from '@/components/forge/ForgeFeriaSessionPanel';
import { EXPEDICION_FAC_TOOLBAR } from '@/lib/forge/expedicion-v2/theme';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';

export function ForgeExpedicionFacConsole({
  courseId,
  editionId,
  lens,
  onLensChange,
  teamRoomId,
  cycleBusy,
  onAction,
  onGoToMesa,
  onDockTab,
}: {
  courseId: string;
  editionId?: string;
  lens: FacilitatorLens;
  onLensChange: (lens: FacilitatorLens) => void;
  teamRoomId: string | null;
  cycleBusy: boolean;
  onAction: (action: string) => Promise<void>;
  onGoToMesa?: () => void;
  onDockTab?: (tab: 'map' | 'eco') => void;
}) {
  const ft = useForgeT();
  const [open, setOpen] = useState(false);

  return (
    <div className={cn('overflow-hidden', EXPEDICION_FAC_TOOLBAR)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[#F5F2EA]/80"
      >
        <SlidersHorizontal className="h-4 w-4 text-[#2E5C9A] shrink-0" />
        <span className="text-xs font-bold text-[#145A45]">{ft('forge.v2.facAdvancedConsole')}</span>
        <span className="ml-auto text-[10px] text-[#145A45]/60 hidden sm:inline">
          {ft('forge.v2.facAdvancedConsoleHint')}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[#145A45]/60 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#145A45]/60 shrink-0" />
        )}
      </button>
      {open && (
        <div className="space-y-2 border-t border-[#145A45]/10 p-2">
          <ForgeFacilitatorEcoOverview
            courseId={courseId}
            lens={lens}
            onLensChange={onLensChange}
            onGoToMesa={onGoToMesa}
            onDockTab={onDockTab}
          />
          <ForgeFacilitatorLensBar courseId={courseId} lens={lens} onLensChange={onLensChange} />
          <ForgeFacilitatorV2Controls
            courseId={courseId}
            roomId={teamRoomId}
            busy={cycleBusy}
            onAction={onAction}
          />
          <ForgeFacilitatorV2Panel courseId={courseId} />
          <ForgeFeriaSessionPanel courseId={courseId} editionId={editionId} />
        </div>
      )}
    </div>
  );
}
