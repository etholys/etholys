'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Map, Wallet } from 'lucide-react';
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
  defaultCollapsed = false,
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
  /** Facilitador: dock recolhido por defeito para dar espaço ao tabuleiro */
  defaultCollapsed?: boolean;
  mobileCollapsedDefault?: boolean;
}) {
  const ft = useForgeT();
  const [tab, setTab] = useState<Tab>('eco');
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      if (mq.matches) setCollapsed(false);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  if (collapsed) {
    return (
      <div className="flex shrink-0 flex-col self-stretch border-l border-[#145A45]/12 bg-[#FAFAF7]">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex h-full min-h-[100px] flex-col items-center justify-center gap-2 px-1.5 py-3 text-[#145A45] hover:bg-[#F0EDE4]"
          title={ft('forge.v2.tableDockTitle')}
        >
          <ChevronLeft className="h-4 w-4 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180">
            {ft('forge.v2.tableDockEco')} · {ft('forge.v2.tableDockMap')}
          </span>
          {balance != null && (
            <span className="text-[9px] font-black text-[#2E5C9A] [writing-mode:vertical-rl] rotate-180">
              {balance}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col min-h-0 bg-[#FAFAF7]',
        'w-full max-md:border-t max-md:border-[#145A45]/12',
        'md:w-[min(30vw,260px)] md:shrink-0 md:border-l md:border-[#145A45]/12'
      )}
    >
      <div className="flex items-center gap-1 border-b border-[#145A45]/10 bg-[#F5F2EA] px-2 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-[#145A45] flex-1 min-w-0 truncate">
          {ft('forge.v2.tableDockTitle')}
        </span>
        {balance != null && (
          <span className="text-[10px] font-bold text-[#2E5C9A] shrink-0">
            {ft('forge.v2.eco', { n: balance })}
          </span>
        )}
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#145A45]/15 text-[#145A45] hover:bg-[#F5F2EA]"
          title={ft('forge.general.close')}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="md:hidden flex h-7 w-7 items-center justify-center rounded-md border border-[#145A45]/15"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="flex border-b border-[#145A45]/10 bg-[#F5F2EA]">
        <button
          type="button"
          onClick={() => setTab('eco')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1 py-2 text-[10px] font-bold',
            tab === 'eco' ? 'bg-[#145A45]/10 text-[#145A45]' : 'text-slate-500'
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
            tab === 'map' ? 'bg-[#145A45]/10 text-[#145A45]' : 'text-slate-500'
          )}
        >
          <Map className="h-3 w-3" />
          {ft('forge.v2.tableDockMap')}
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 text-sm max-md:max-h-[38vh]">
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
  );
}
