'use client';

import { useEffect, useRef, useState } from 'react';
import { Building2, ChevronDown, Home, MapPinned, Plus, Users } from 'lucide-react';
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
  const [plusOpen, setPlusOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open && !plusOpen) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setPlusOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open, plusOpen]);

  const ownLabel = radarT(loc, 'Minha operação', 'Mi operación', 'My operation');
  const allLabel = radarT(loc, 'Todos (carteira)', 'Todos (cartera)', 'All (portfolio)');
  const clientFallback = radarT(loc, 'Cliente…', 'Cliente…', 'Client…');

  const label =
    scope === RADAR_SCOPE_OWN
      ? ownLabel
      : scope === RADAR_SCOPE_ALL
        ? allLabel
        : selectedClient?.name || clientFallback;

  const pick = (next: typeof scope) => {
    setScope(next);
    setOpen(false);
    setPlusOpen(false);
  };

  return (
    <div ref={ref} className={cn('relative space-y-1.5', className)}>
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-200/70">
        {radarT(loc, 'Propriedades', 'Propiedades', 'Properties')}
      </p>

      <div className="flex items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => {
            setPlusOpen(false);
            setOpen((o) => !o);
          }}
          className="flex min-w-0 flex-1 touch-manipulation items-center justify-between gap-1.5 rounded-lg border border-white/20 bg-slate-950 px-2.5 py-2 text-left text-xs font-medium text-white hover:border-emerald-400/50"
          aria-expanded={open}
          aria-haspopup="listbox"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {scope === RADAR_SCOPE_OWN ? (
              <Home className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            ) : scope === RADAR_SCOPE_ALL ? (
              <Users className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            ) : (
              <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
            )}
            <span className="truncate">
              {clientsLoading ? radarT(loc, 'A carregar…', 'Cargando…', 'Loading…') : label}
            </span>
          </span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-white/45 transition', open && 'rotate-180')} />
        </button>

        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setPlusOpen((o) => !o);
          }}
          className="inline-flex shrink-0 items-center justify-center rounded-lg border border-emerald-400/45 bg-emerald-500/15 px-2.5 text-emerald-100 hover:bg-emerald-500/25"
          aria-label={radarT(loc, 'Criar', 'Crear', 'Create')}
          aria-expanded={plusOpen}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {plusOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-950/50 sm:hidden" onClick={() => setPlusOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-white/20 bg-slate-950 py-1 shadow-xl"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setCreateOpen('client');
                setPlusOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-emerald-100 hover:bg-emerald-500/15"
            >
              <Users className="h-3.5 w-3.5" />
              {radarT(loc, 'Novo cliente', 'Nuevo cliente', 'New client')}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setCreateOpen('property');
                setPlusOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-emerald-100 hover:bg-emerald-500/15"
            >
              <MapPinned className="h-3.5 w-3.5" />
              {radarT(loc, 'Novo espaço', 'Nuevo espacio', 'New space')}
            </button>
          </div>
        </>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-950/50 sm:hidden" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border border-white/20 bg-slate-950 py-1 shadow-xl"
          >
            <button
              type="button"
              role="option"
              aria-selected={scope === RADAR_SCOPE_OWN}
              onClick={() => pick(RADAR_SCOPE_OWN)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5',
                scope === RADAR_SCOPE_OWN && 'bg-emerald-500/15 font-medium text-emerald-100',
              )}
            >
              <Home className="h-3.5 w-3.5 text-emerald-300" />
              {ownLabel}
            </button>
            <button
              type="button"
              role="option"
              aria-selected={scope === RADAR_SCOPE_ALL}
              onClick={() => pick(RADAR_SCOPE_ALL)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5',
                scope === RADAR_SCOPE_ALL && 'bg-emerald-500/15 font-medium text-emerald-100',
              )}
            >
              <Users className="h-3.5 w-3.5 text-emerald-300" />
              {allLabel}
            </button>
            {clients.length > 0 && (
              <>
                <div className="my-1 border-t border-white/10" />
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/35">
                  {radarT(loc, 'Clientes', 'Clientes', 'Clients')}
                </p>
              </>
            )}
            {clients.map((c) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={scope === c.id}
                onClick={() => pick(c.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs hover:bg-white/5',
                  scope === c.id && 'bg-emerald-500/15 font-medium text-emerald-100',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-emerald-300/80" />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="shrink-0 tabular-nums text-[10px] text-white/40">{c.propertyCount}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
