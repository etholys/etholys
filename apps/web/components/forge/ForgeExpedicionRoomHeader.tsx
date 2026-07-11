'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MoreHorizontal,
  Presentation,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { ForgeGameManualButton } from '@/components/forge/ForgeGameManual';
import { useForgeT } from '@/lib/forge/use-forge-t';
import { cn } from '@/lib/utils';

type RoomView = 'hall' | 'table' | 'presentation';

export function ForgeExpedicionRoomHeader({
  courseId,
  courseTitle,
  roomView,
  onRoomViewChange,
  onOpenPresentation,
  onOpenManual,
  isFac,
  sessionFormat,
  v2Phase,
  v2Balance,
  teamMode,
  facEmergency,
  onToggleEmergency,
  onToggleInvite,
  onToggleDeck,
  onOpenInvest,
  showInvest,
  stationSlug,
}: {
  courseId: string;
  courseTitle: string;
  roomView: RoomView;
  onRoomViewChange: (v: RoomView) => void;
  onOpenPresentation: () => void;
  onOpenManual: () => void;
  isFac: boolean;
  sessionFormat: 'presencial' | 'online';
  v2Phase?: string;
  v2Balance?: number;
  teamMode?: boolean;
  facEmergency: boolean;
  onToggleEmergency: () => void;
  onToggleInvite: () => void;
  onToggleDeck: () => void;
  onOpenInvest?: () => void;
  showInvest?: boolean;
  stationSlug?: string | null;
}) {
  const ft = useForgeT();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const modes: { id: RoomView; label: string; icon?: React.ReactNode; facOnly?: boolean }[] = [
    { id: 'hall', label: ft('forge.v2.lobbyNav') },
    { id: 'table', label: ft('forge.v2.lobbyResumeTable') },
    ...(isFac
      ? [{ id: 'presentation' as const, label: ft('forge.v2.presentationMode'), icon: <Presentation className="h-3 w-3" /> }]
      : []),
  ];

  return (
    <header className="flex shrink-0 flex-col border-b border-[#0D4535]/30 bg-[#145A45] text-white shadow-md">
      <div className="flex items-center gap-2 px-3 py-2">
        <Link
          href={`/hub/forge/cursos/${courseId}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
          title={ft('forge.room.exit')}
        >
          <X className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A227]">
            {ft('forge.room.brand')}
            {sessionFormat === 'presencial' && (
              <span className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[9px] text-white">
                {ft('forge.v2.presential')}
              </span>
            )}
          </p>
          <h1 className="truncate text-sm font-black md:text-base">{courseTitle}</h1>
        </div>
        <div className="hidden sm:flex items-center rounded-lg bg-[#0D4535]/60 p-0.5">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (m.id === 'presentation') onOpenPresentation();
                else onRoomViewChange(m.id);
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition',
                roomView === m.id
                  ? 'bg-[#C9A227] text-[#0D4535] shadow-sm'
                  : 'text-white/90 hover:bg-white/10'
              )}
            >
              {m.icon}
              <span className="hidden md:inline">{m.label}</span>
              <span className="md:hidden">{m.id === 'hall' ? 'Hall' : m.id === 'table' ? 'Mesa' : 'PPT'}</span>
            </button>
          ))}
        </div>
        <ForgeGameManualButton onOpen={onOpenManual} />
        {isFac && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/25 hover:bg-white/10"
              aria-label={ft('forge.v2.roomMenu')}
            >
              <MoreHorizontal className="h-5 w-5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-xl border border-[#0D4535]/20 bg-white py-1 shadow-xl text-[#145A45]">
                <Link
                  href={`/hub/forge/cursos/${courseId}/turmas`}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-[#F5F2EA]"
                  onClick={() => setMenuOpen(false)}
                >
                  <Users className="h-3.5 w-3.5" />
                  {ft('forge.tutorLobby.short')}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    onToggleInvite();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-[#F5F2EA]"
                >
                  {ft('forge.room.invites')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleDeck();
                    setMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-[#F5F2EA]"
                >
                  {ft('forge.room.deck')}
                </button>
                {showInvest && stationSlug && onOpenInvest && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenInvest();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-[#F5F2EA]"
                  >
                    {ft('forge.room.investments')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onToggleEmergency();
                    setMenuOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-[#F5F2EA]',
                    facEmergency && 'text-amber-700 bg-amber-50'
                  )}
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  {ft('forge.room.emergency')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Mobile mode tabs */}
      <div className="flex sm:hidden border-t border-white/10 px-2 py-1.5 gap-1">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              if (m.id === 'presentation') onOpenPresentation();
              else onRoomViewChange(m.id);
            }}
            className={cn(
              'flex-1 rounded-md py-1.5 text-[10px] font-bold',
              roomView === m.id ? 'bg-[#C9A227] text-[#0D4535]' : 'text-white/80'
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {v2Phase === 'playing' && v2Balance != null && roomView !== 'table' && (
        <div className="border-t border-white/10 px-3 py-1 text-[10px] text-white/75 flex flex-wrap gap-x-2">
          <span>{ft('forge.v2.cyclesTitle')}</span>
          {teamMode && <span>· {ft('forge.v2.sharedTable')}</span>}
          <span className="ml-auto font-semibold text-[#C9A227]">{ft('forge.v2.eco', { n: v2Balance })}</span>
        </div>
      )}
    </header>
  );
}
