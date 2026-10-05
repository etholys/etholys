'use client';

import { useState } from 'react';
import { Loader2, MessageSquare, Package } from 'lucide-react';
import Link from 'next/link';
import { spaceKindMeta, type Loc } from '@/lib/radar/space';

type Unit = { id: string; name: string; kind: string; crop: string | null; areaHa: number | null };

export function RadarSpaceOpsPanel({
  companyId,
  engagementId,
  locale,
  moduleId,
  propertyName,
  units,
  focusedId,
  onFocus,
  chainHref,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  moduleId: string | null;
  propertyName: string;
  units: Unit[];
  focusedId: string | null;
  onFocus: (id: string) => void;
  chainHref: string;
}) {
  const loc: Loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const meta = spaceKindMeta(moduleId);
  const focus = units.find((u) => u.id === focusedId) || units[0] || null;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const logNote = async () => {
    if (!focus || note.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const r = await fetch('/api/radar/agriculture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          action: 'line',
          kind: 'scout',
          unitId: focus.id,
          note: note.trim(),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setNote('');
      setOk(true);
      window.setTimeout(() => setOk(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
        <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
          {meta.unitLabelPlural[loc]}
        </p>
        {units.length === 0 ? (
          <p className="px-1 text-xs text-white/45">
            {loc === 'en' ? 'Add spaces in Setup.' : 'Adiciona espaços em Configurar.'}
          </p>
        ) : (
          <ul className="space-y-0.5">
            {units.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onFocus(u.id)}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
                    focus?.id === u.id ? 'bg-emerald-500/20 text-emerald-50' : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="truncate">{u.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="space-y-3">
        {focus ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
              {meta.unitLabel[loc]} · {propertyName}
            </p>
            <h2 className="mt-0.5 text-xl font-medium text-white">{focus.name}</h2>
            <p className="mt-1 text-sm text-white/50">
              {[focus.crop, focus.areaHa != null ? `${focus.areaHa} ${meta.areaUnit[loc]}` : null]
                .filter(Boolean)
                .join(' · ') || '—'}
            </p>

            <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
              <p className="text-xs text-white/45">
                {loc === 'es'
                  ? 'Anotar lo que viste en este espacio'
                  : loc === 'en'
                    ? 'Log what you saw in this space'
                    : 'Registar o que viste neste espaço'}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder={loc === 'en' ? 'Short note…' : 'Nota curta…'}
                className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-emerald-400/40"
              />
              {err && <p className="text-sm text-rose-200">{err}</p>}
              {ok && (
                <p className="text-sm text-emerald-200">
                  {loc === 'en' ? 'Saved' : 'Guardado'}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || note.trim().length < 2}
                  onClick={() => void logNote()}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                  {loc === 'en' ? 'Save note' : 'Guardar nota'}
                </button>
                <Link
                  href={chainHref}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80"
                >
                  <Package className="h-4 w-4" />
                  {loc === 'en' ? 'Lot chain' : 'Cadeia do lote'}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/50">
            {loc === 'en' ? 'No spaces yet.' : 'Ainda sem espaços.'}
          </div>
        )}
      </div>
    </div>
  );
}
