'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Map, Wallet } from 'lucide-react';
import { ForgeExpedicionV2Workspace } from '@/components/forge/ForgeExpedicionV2Workspace';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';

type Tab = 'map' | 'eco';

export function ForgeExpedicionTableDock({
  courseId,
  roomId,
  teamPeers,
  myUserId,
  readOnly,
  balance,
  impactPoints,
  mobileCollapsedDefault = false,
  observeUserId,
}: {
  courseId: string;
  roomId?: string | null;
  observeUserId?: string | null;
  teamPeers?: { userId: string; name: string }[];
  myUserId?: string;
  readOnly?: boolean;
  balance?: number;
  impactPoints?: number;
  mobileCollapsedDefault?: boolean;
}) {
  const ft = useForgeT();
  const [tab, setTab] = useState<Tab>('eco');
  const [collapsed, setCollapsed] = useState(mobileCollapsedDefault);

  return (
    <div
      className={cn(
        'flex flex-col border-[#1B5E4B]/20 bg-white/95 shadow-lg',
        'md:w-[min(38vw,320px)] md:shrink-0 md:border-l md:rounded-l-xl',
        'max-md:border-t max-md:rounded-t-xl'
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex items-center gap-2 border-b border-[#1B5E4B]/10 px-3 py-2 md:hidden"
      >
        <Map className="h-4 w-4 text-[#1B5E4B]" />
        <span className="text-xs font-bold text-[#1B5E4B]">{ft('forge.v2.tableDockTitle')}</span>
        {balance != null && (
          <span className="ml-auto text-[10px] font-bold text-emerald-700">
            {ft('forge.v2.eco', { n: balance })}
          </span>
        )}
        {collapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      <div
        className={cn(
          'flex flex-col min-h-0',
          collapsed && 'max-md:hidden',
          'max-md:max-h-[42vh]',
          'md:flex-1 md:max-h-none'
        )}
      >
        <div className="hidden md:flex items-center gap-2 border-b border-[#1B5E4B]/10 px-3 py-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-[#1B5E4B]">
            {ft('forge.v2.tableDockTitle')}
          </span>
          {balance != null && (
            <span className="ml-auto text-[10px] font-bold text-emerald-700">
              {ft('forge.v2.eco', { n: balance })}
              {(impactPoints ?? 0) > 0 && ` · ${ft('forge.v2.impact', { n: impactPoints ?? 0 })}`}
            </span>
          )}
        </div>
        <div className="flex border-b border-[#1B5E4B]/10">
          <button
            type="button"
            onClick={() => setTab('eco')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-bold',
              tab === 'eco' ? 'bg-[#1B5E4B]/10 text-[#1B5E4B]' : 'text-slate-500'
            )}
          >
            <Wallet className="h-3 w-3" />
            {ft('forge.v2.tableDockEco')}
          </button>
          <button
            type="button"
            onClick={() => setTab('map')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-bold',
              tab === 'map' ? 'bg-[#1B5E4B]/10 text-[#1B5E4B]' : 'text-slate-500'
            )}
          >
            <Map className="h-3 w-3" />
            {ft('forge.v2.tableDockMap')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 text-sm">
          <ForgeExpedicionV2Workspace
            courseId={courseId}
            readOnly={readOnly}
            roomId={roomId}
            observeUserId={observeUserId}
            teamPeers={teamPeers}
            myUserId={myUserId}
            compact
            dockTab={tab}
          />
        </div>
      </div>
    </div>
  );
}
