'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { useApp } from '@/app/providers';
import { useAuroraAttended } from '@/components/etholys/AuroraAttendedContext';
import { cn } from '@/lib/utils';

/** Seletor interno AURORA — negócio atendido (camada 2). Dropdown próprio (não select nativo). */
export function AuroraAttendedPicker({ collapsed }: { collapsed?: boolean }) {
  const { locale } = useApp();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const { selection, setSelection, options, loading, canManage } = useAuroraAttended();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const copy =
    loc === 'es'
      ? {
          label: 'Negocio atendido',
          empty: 'Sin negocio en cartera',
          pick: 'Elegí un negocio…',
          invite: 'Invitar técnicos',
          clear: 'Ninguno',
        }
      : loc === 'en'
        ? {
            label: 'Attended business',
            empty: 'No businesses in portfolio',
            pick: 'Pick a business…',
            invite: 'Invite technicians',
            clear: 'None',
          }
        : {
            label: 'Negócio atendido',
            empty: 'Sem negócios na carteira',
            pick: 'Escolhe um negócio…',
            invite: 'Convidar técnicos',
            clear: 'Nenhum',
          };

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

  if (collapsed) return null;

  const label = selection
    ? `${selection.name}${selection.engagementTitle ? ` · ${selection.engagementTitle}` : ''}`
    : options.length
      ? copy.pick
      : copy.empty;

  return (
    <div className="space-y-1.5">
      <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/70">{copy.label}</p>
      <div ref={ref} className="relative">
        <button
          type="button"
          disabled={loading || options.length === 0}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            'flex w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-2 text-left text-xs text-white/85 outline-none transition hover:bg-white/[0.07] focus:border-amber-400/50 disabled:cursor-not-allowed disabled:opacity-50'
          )}
        >
          <span className="min-w-0 truncate">{label}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-white/45 transition', open && 'rotate-180')} />
        </button>
        {open && options.length > 0 && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border border-white/10 bg-[#0C1822] py-1 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.9)]"
          >
            <button
              type="button"
              role="option"
              aria-selected={!selection}
              onClick={() => {
                setSelection(null);
                setOpen(false);
              }}
              className={cn(
                'flex w-full px-3 py-2 text-left text-xs hover:bg-white/5',
                !selection ? 'font-medium text-amber-200' : 'text-white/65'
              )}
            >
              {copy.clear}
            </button>
            {options.map((row) => {
              const active =
                selection?.companyId === row.companyId && selection?.engagementId === row.engagementId;
              const text = `${row.shortName || row.name}${row.engagementTitle ? ` · ${row.engagementTitle}` : ''}`;
              return (
                <button
                  key={`${row.companyId}-${row.engagementId}`}
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={text}
                  onClick={() => {
                    setSelection({
                      companyId: row.companyId,
                      engagementId: row.engagementId,
                      name: row.name,
                      engagementTitle: row.engagementTitle,
                    });
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full px-3 py-2 text-left text-xs hover:bg-white/5',
                    active ? 'bg-amber-500/15 font-medium text-amber-100' : 'text-white/80'
                  )}
                >
                  <span className="truncate">{text}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {canManage ? (
        <Link
          href="/hub/workspace/team"
          className="block px-0.5 text-[11px] font-medium text-amber-200/80 hover:text-amber-100 hover:underline"
        >
          {copy.invite}
        </Link>
      ) : null}
    </div>
  );
}
