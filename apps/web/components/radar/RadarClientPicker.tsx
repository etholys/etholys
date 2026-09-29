'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Loader2, MapPinned, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { RADAR_CLIENT_ALL } from '@/lib/radar/client-scope';
import { useRadarClientScope } from '@/components/radar/RadarClientScopeContext';

export function RadarClientPicker({ className }: { className?: string }) {
  const {
    role,
    roleLoading,
    clients,
    clientsLoading,
    clientScope,
    selectedClient,
    setClientScope,
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

  if (roleLoading) {
    return (
      <div className={cn('inline-flex items-center gap-1.5 text-xs text-white/45', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cliente…
      </div>
    );
  }

  if (role !== 'provider') return null;

  const label =
    clientScope === RADAR_CLIENT_ALL
      ? 'Todos os clientes'
      : selectedClient?.name || 'Cliente…';

  return (
    <div ref={ref} className={cn('relative space-y-1.5', className)}>
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/70">
        Cliente RADAR
      </p>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full touch-manipulation items-center justify-between gap-1.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-2 text-left text-xs font-medium text-white hover:border-emerald-400/40"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
          <span className="truncate">{clientsLoading ? 'A carregar…' : label}</span>
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
              aria-selected={clientScope === RADAR_CLIENT_ALL}
              onClick={() => {
                setClientScope(RADAR_CLIENT_ALL);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5',
                clientScope === RADAR_CLIENT_ALL && 'bg-emerald-500/15 font-medium text-emerald-100',
              )}
            >
              Todos os clientes
            </button>
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={clientScope === c.id}
                onClick={() => {
                  setClientScope(c.id);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5',
                  clientScope === c.id && 'bg-emerald-500/15 font-medium text-emerald-100',
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
              + Novo cliente
            </button>
            <button
              type="button"
              disabled={clientScope === RADAR_CLIENT_ALL}
              onClick={() => {
                if (clientScope === RADAR_CLIENT_ALL) return;
                setCreateOpen('property');
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium hover:bg-emerald-500/10',
                clientScope === RADAR_CLIENT_ALL
                  ? 'cursor-not-allowed text-white/25'
                  : 'text-emerald-200',
              )}
              title={
                clientScope === RADAR_CLIENT_ALL
                  ? 'Seleciona um cliente primeiro'
                  : 'Cadastrar fazenda neste cliente'
              }
            >
              <MapPinned className="h-3.5 w-3.5" />
              + Nova fazenda
            </button>
          </div>
        </>
      )}
      <p className="px-0.5 text-[10px] leading-snug text-white/35">
        Âmbito da carteira — filtra alertas e propriedades.
      </p>
    </div>
  );
}
