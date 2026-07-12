'use client';

import { RefreshCw } from 'lucide-react';
import { ForgeConstructionCanvas } from '@/components/forge/ForgeConstructionCanvas';
import { useForgeT } from '@/lib/forge/use-forge-t';
import type { ExpedicionV2PlayerState } from '@/lib/forge/expedicion-v2/types';

export function ForgeFacilitatorReviewCenter({
  name,
  v2,
  turnName,
  loading,
}: {
  name: string;
  v2: ExpedicionV2PlayerState | null;
  turnName?: string | null;
  loading?: boolean;
}) {
  const ft = useForgeT();

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden bg-[#FAFAF7]">
      <div className="shrink-0 border-b border-[#2E5C9A]/20 bg-[#E8F0FA] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-bold text-[#1A3D5C]">
            {ft('forge.v2.lensObserving', { name })}
          </p>
          {turnName && (
            <span className="rounded-full bg-[#2E5C9A] px-2.5 py-0.5 text-[10px] font-bold text-white">
              {ft('forge.room.turnOf', { name: turnName })}
            </span>
          )}
          {v2 && (
            <span className="text-[10px] font-semibold text-[#145A45]/80">
              {v2.constructionMap.postIts.length} post-its · {v2.ledger.balance} Eco
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] text-[#145A45]/60">
            <RefreshCw className={loading ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            {ft('forge.v2.facReviewLiveHint')}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-[#1A3D5C]/80">{ft('forge.v2.facReviewMapHint')}</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-3 md:p-4">
        {v2 ? (
          <ForgeConstructionCanvas map={v2.constructionMap} readOnly />
        ) : (
          <p className="text-center text-sm text-slate-500 py-12">{ft('forge.v2.loadingMap')}</p>
        )}
      </div>
    </div>
  );
}
