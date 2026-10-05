'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Home, MapPinned, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApp } from '@/app/providers';
import { RADAR_SCOPE_ALL, RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import { useRadarClientScope } from '@/components/radar/RadarClientScopeContext';
import { radarLoc, radarT } from '@/lib/radar/i18n';

export function RadarClientPicker({ className }: { className?: string }) {
  const { locale } = useApp();
  const loc = radarLoc(locale);
  const {
    clients,
    clientsLoading,
    scope,
    selectedClient,
    setScope,
    setCreateOpen,
  } = useRadarClientScope();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open]);

  const ownLabel = radarT(loc, 'Minha operação', 'Mi operación', 'My operation');
  const allLabel = radarT(loc, 'Todos', 'Todos', 'All');
  const clientFallback = radarT(loc, 'Cliente…', 'Cliente…', 'Client…');

  const label =
    scope === RADAR_SCOPE_OWN
      ? ownLabel
      : scope === RADAR_SCOPE_ALL
        ? allLabel
        : selectedClient?.name || clientFallback;

  return (
    <div ref={ref} className={cn('relative space-y-1.5', className)}>
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/70">
        {radarT(loc, 'Âmbito RADAR', 'Ámbito RADAR', 'RADAR scope')}
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full touch-manipulation items-center justify-between gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-left text-xs font-medium text-white hover:border-emerald-400/40"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {scope === RADAR_SCOPE_OWN ? (
            <Home className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
          ) : (
            <Users className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
          )}
          <span className="truncate">
            {clientsLoading ? radarT(loc, 'A carregar…', 'Cargando…', 'Loading…') : label}
          </span>
        </span>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-white/40 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-950/40 sm:hidden" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/15 bg-[#0a1612] py-1 shadow-xl"
          >
            <button
              type="button"
              role="option"
              aria-selected={scope === RADAR_SCOPE_OWN}
              onClick={() => {
                setScope(RADAR_SCOPE_OWN);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5',
                scope === RADAR_SCOPE_OWN && 'bg-emerald-500/15 font-medium text-emerald-100',
              )}
            >
              <Home className="h-3.5 w-3.5 text-emerald-300/80" />
              {ownLabel}
            </button>
            <button
              type="button"
              role="option"
              aria-selected={scope === RADAR_SCOPE_ALL}
              onClick={() => {
                setScope(RADAR_SCOPE_ALL);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5',
                scope === RADAR_SCOPE_ALL && 'bg-emerald-500/15 font-medium text-emerald-100',
              )}
            >
              {radarT(loc, 'Todos (carteira)', 'Todos (cartera)', 'All (portfolio)')}
            </button>
            {clients.length > 0 && <div className="my-1 border-t border-white/10" />}
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={scope === c.id}
                onClick={() => {
                  setScope(c.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5',
                  scope === c.id && 'bg-emerald-500/15 font-medium text-emerald-100',
                )}
              >
                <span className="truncate">{c.name}</span>
                <span className="shrink-0 text-[10px] text-white/35">{c.propertyCount}</span>
              </button>
            ))}
            <div className="my-1 border-t border-white/10" />
            <button
              type="button"
              onClick={() => {
                setCreateOpen('client');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
            >
              <Plus className="h-3.5 w-3.5" />
              {radarT(loc, '+ Novo cliente', '+ Nuevo cliente', '+ New client')}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreateOpen('property');
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-emerald-200 hover:bg-emerald-500/10"
            >
              <MapPinned className="h-3.5 w-3.5" />
              {radarT(loc, '+ Novo espaço', '+ Nuevo espacio', '+ New space')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
