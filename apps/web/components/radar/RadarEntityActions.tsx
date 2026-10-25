'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Archive, Loader2, MoreVertical, Settings2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { radarLoc, radarT, type RadarLoc } from '@/lib/radar/i18n';

type Kind = 'client' | 'property';

export function RadarEntityActions({
  kind,
  id,
  name,
  companyId,
  engagementId,
  locale,
  settingsHref,
  onDone,
  className,
}: {
  kind: Kind;
  id: string;
  name: string;
  companyId: string;
  engagementId?: string | null;
  locale: string;
  /** When kind=property, link into Definições do lugar. */
  settingsHref?: string | null;
  onDone?: () => void;
  className?: string;
}) {
  const loc = radarLoc(locale);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open && !confirm) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('touchstart', onDoc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('touchstart', onDoc);
    };
  }, [open, confirm]);

  const run = async (mode: 'archive' | 'delete') => {
    setBusy(true);
    setErr(null);
    try {
      if (kind === 'client') {
        if (mode === 'archive') {
          const r = await fetch(`/api/radar/clients/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId, engagementId, action: 'archive' }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Falha');
        } else {
          const r = await fetch(`/api/radar/clients/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId, engagementId }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Falha');
        }
      } else {
        const r = await fetch(`/api/radar/properties/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId, engagementId, action: 'archive' }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error || 'Falha');
      }
      setConfirm(null);
      setOpen(false);
      onDone?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={ref} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
          setConfirm(null);
          setErr(null);
        }}
        className="rounded-lg border border-white/20 bg-slate-900 p-1.5 text-slate-200 hover:border-rose-400/50 hover:text-rose-100"
        aria-label={radarT(loc, 'Ações', 'Acciones', 'Actions')}
        title={radarT(loc, 'Ações', 'Acciones', 'Actions')}
      >
        <MoreVertical className="h-3.5 w-3.5" />
      </button>

      {open && !confirm && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 min-w-[11rem] overflow-hidden rounded-lg border border-white/20 bg-slate-950 py-1 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {kind === 'client' ? (
            <>
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirm('archive')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-amber-100 hover:bg-amber-500/15"
              >
                <Archive className="h-3.5 w-3.5" />
                {radarT(loc, 'Arquivar', 'Archivar', 'Archive')}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirm('delete')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-500/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {radarT(loc, 'Apagar', 'Borrar', 'Delete')}
              </button>
            </>
          ) : (
            <>
              {settingsHref && (
                <Link
                  href={settingsHref}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-teal-100 hover:bg-teal-500/15"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  {radarT(loc, 'Definições', 'Ajustes', 'Settings')}
                </Link>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => setConfirm('delete')}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-500/15"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {radarT(loc, 'Apagar lugar', 'Borrar lugar', 'Delete place')}
              </button>
            </>
          )}
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          loc={loc}
          kind={kind}
          mode={confirm}
          name={name}
          busy={busy}
          err={err}
          onCancel={() => {
            setConfirm(null);
            setErr(null);
          }}
          onConfirm={() => void run(confirm)}
        />
      )}
    </div>
  );
}

function ConfirmDialog({
  loc,
  kind,
  mode,
  name,
  busy,
  err,
  onCancel,
  onConfirm,
}: {
  loc: RadarLoc;
  kind: Kind;
  mode: 'archive' | 'delete';
  name: string;
  busy: boolean;
  err: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const title =
    kind === 'client' && mode === 'archive'
      ? radarT(loc, 'Arquivar empresa?', '¿Archivar empresa?', 'Archive company?')
      : kind === 'client'
        ? radarT(loc, 'Apagar empresa?', '¿Borrar empresa?', 'Delete company?')
        : radarT(loc, 'Apagar este lugar?', '¿Borrar este lugar?', 'Delete this place?');

  const body =
    kind === 'client' && mode === 'archive'
      ? radarT(
          loc,
          `«${name}» sai da carteira ativa e do seletor. Os lugares também são arquivados (recuperáveis).`,
          `«${name}» sale de la cartera activa y del selector. Sus lugares también se archivan (recuperables).`,
          `“${name}” leaves the active portfolio and selector. Its places are archived too (recoverable).`,
        )
      : kind === 'client'
        ? radarT(
            loc,
            `«${name}» será arquivada (soft). Lugares ativos passam a arquivados. Confirma?`,
            `«${name}» será archivada (soft). Los lugares activos pasan a archivados. ¿Confirmás?`,
            `“${name}” will be soft-archived. Active places become archived. Confirm?`,
          )
        : radarT(
            loc,
            `«${name}» deixa de aparecer nas listas. Espaços internos são desativados (não é só apagar do mapa).`,
            `«${name}» deja de aparecer en las listas. Los espacios internos se desactivan (no es solo quitar del mapa).`,
            `“${name}” disappears from lists. Inner spaces are deactivated (not just remove-from-map).`,
          );

  const cta =
    kind === 'client' && mode === 'archive'
      ? radarT(loc, 'Arquivar', 'Archivar', 'Archive')
      : radarT(loc, 'Apagar', 'Borrar', 'Delete');

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-3 sm:items-center"
      onClick={(e) => {
        e.stopPropagation();
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-white/20 bg-slate-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-serif text-xl text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{body}</p>
        {err && <p className="mt-3 text-sm text-rose-200">{err}</p>}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {cta}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:text-white"
          >
            {radarT(loc, 'Cancelar', 'Cancelar', 'Cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
