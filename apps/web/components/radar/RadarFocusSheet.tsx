'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Droplets, Loader2, MessageSquare, X } from 'lucide-react';
import { DEFAULT_IRRIGATION_MM, MOISTURE_THRESHOLD } from '@/lib/radar/agriculture';
import { cadernoCopy } from '@/lib/radar/caderno';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import { spaceKindMeta } from '@/lib/radar/space';

type Unit = {
  id: string;
  name: string;
  kind: string;
  crop: string | null;
  areaHa: number | null;
  moisture?: number | null;
};

type AgriParcel = {
  id: string;
  moisture: number | null;
  nextAction: string;
  harvestBlocked: boolean;
  phiDaysLeft: number | null;
};

type Line = {
  id: string;
  kind: string;
  occurredAt: string;
  note: string;
  unitId?: string | null;
  unitName: string | null;
};

/** Full focus detail — always opaque; parent mounts it in a side/bottom sheet, not over map tiles. */
export function RadarFocusSheet({
  companyId,
  engagementId,
  locale,
  moduleId,
  units,
  focusedId,
  propertyId,
  latest,
  hasValve,
  onClose,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  moduleId: string | null;
  units: Unit[];
  focusedId: string | null;
  propertyId?: string;
  latest?: Record<string, number> | null;
  hasValve?: boolean;
  onClose?: () => void;
}) {
  const loc = radarLoc(locale);
  const meta = spaceKindMeta(moduleId);
  const book = cadernoCopy(moduleId, loc);
  const focus = units.find((u) => u.id === focusedId) || null;
  const cadernoHref = (() => {
    const q = new URLSearchParams({ company: companyId });
    if (engagementId) q.set('engagement', engagementId);
    if (propertyId) q.set('property', propertyId);
    if (focus?.id) q.set('unit', focus.id);
    return `/hub/radar/caderno?${q}`;
  })();
  const [parcel, setParcel] = useState<AgriParcel | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState('');
  const [mm, setMm] = useState(String(DEFAULT_IRRIGATION_MM));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const load = useCallback(async () => {
    if (!companyId) return;
    const q = new URLSearchParams({ companyId });
    if (engagementId) q.set('engagementId', engagementId);
    const r = await fetch(`/api/radar/agriculture?${q}`, { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return;
    setLines(d.lines || []);
    if (focus) {
      const p = (d.parcels || []).find((x: AgriParcel) => x.id === focus.id) || null;
      setParcel(p);
    } else setParcel(null);
  }, [companyId, engagementId, focus?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    setOk(false);
    try {
      const r = await fetch('/api/radar/agriculture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, ...body }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setNote('');
      setOk(true);
      await load();
      window.setTimeout(() => setOk(false), 1800);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  if (!focus) {
    return (
      <div className="rounded-2xl border border-dashed border-white/20 bg-[#07111A] px-4 py-8 text-center text-sm text-white/55">
        {radarT(loc, 'Toca um espaço no mapa.', 'Tocá un espacio en el mapa.', 'Tap a space on the map.')}
      </div>
    );
  }

  const moisture = parcel?.moisture ?? focus.moisture ?? null;
  const needIrrigate = parcel?.nextAction === 'irrigate' || (moisture != null && moisture < MOISTURE_THRESHOLD);
  const holdHarvest = Boolean(parcel?.harvestBlocked);
  const cue = holdHarvest
    ? radarT(loc, 'Não colher agora — carência ativa.', 'No cosechar ahora — carencia activa.', 'Do not harvest — PHI active.')
    : needIrrigate
      ? radarT(
          loc,
          `Humidade baixa${moisture != null ? ` (${moisture}%)` : ''}. Regista a irrigação.`,
          `Humedad baja${moisture != null ? ` (${moisture}%)` : ''}. Registrá el riego.`,
          `Low moisture${moisture != null ? ` (${moisture}%)` : ''}. Log irrigation.`,
        )
      : moisture != null
        ? radarT(loc, `Humidade ${moisture}% — está bem.`, `Humedad ${moisture}% — está bien.`, `Moisture ${moisture}% — looking good.`)
        : radarT(loc, 'Ainda sem leitura. Anota o que viste.', 'Aún sin lectura. Anotá lo que viste.', 'No reading yet. Log what you saw.');

  const recent = lines
    .filter((l) => l.unitId === focus.id || (!l.unitId && l.unitName === focus.name))
    .slice(0, 3);

  const priority = holdHarvest || needIrrigate
    ? radarT(loc, 'Prioridade alta', 'Prioridad alta', 'High priority')
    : radarT(loc, 'Em dia', 'Al día', 'On track');

  return (
    <section className="rounded-xl border border-white/15 bg-[#07111A] px-4 py-4 sm:px-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
            {radarT(loc, 'Tarefas', 'Tareas', 'Tasks')}
          </p>
          <h2 className="mt-1 truncate text-lg font-medium text-white">{focus.name}</h2>
          <p className="text-xs text-white/55">
            {[focus.crop, focus.areaHa != null ? `${focus.areaHa} ${meta.areaUnit[loc]}` : null, moisture != null ? `${moisture}%` : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#12343c] p-2 text-white hover:bg-[#1a4a54]"
            aria-label={radarT(loc, 'Fechar', 'Cerrar', 'Close')}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        className={`mt-3 rounded-lg border px-3 py-3 ${
          holdHarvest || needIrrigate
            ? 'border-amber-400/40 bg-amber-950'
            : 'border-white/15 bg-[#0c1a24]'
        }`}
      >
        <p className="text-sm font-medium text-white">{cue}</p>
        <p className="mt-2 text-[11px] text-white/55">
          <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${holdHarvest || needIrrigate ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {priority}
        </p>
        {latest && Object.keys(latest).length > 0 && (
          <ul className="mt-2 space-y-0.5 text-xs text-white/80">
            {Object.entries(latest).map(([metric, value]) => (
              <li key={metric}>
                {metric}: {value}
              </li>
            ))}
          </ul>
        )}
        {hasValve && propertyId && (
          <div className="mt-3 flex gap-2">
            {(['open', 'close'] as const).map((valve) => (
              <button
                key={valve}
                type="button"
                disabled={busy}
                onClick={() =>
                  void fetch(`/api/radar/properties/${propertyId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyId, engagementId, action: 'valve', unitId: focus.id, valve }),
                  }).then(() => setOk(true))
                }
                className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                {valve === 'open'
                  ? radarT(loc, 'Abrir válvula', 'Abrir válvula', 'Open valve')
                  : radarT(loc, 'Fechar válvula', 'Cerrar válvula', 'Close valve')}
              </button>
            ))}
          </div>
        )}
        {needIrrigate && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={mm}
              onChange={(e) => setMm(e.target.value)}
              inputMode="decimal"
              className="w-16 rounded-lg border border-white/20 bg-[#07111A] px-2 py-1.5 text-sm text-white"
            />
            <span className="text-xs text-white/55">mm</span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void post({
                  action: 'line',
                  kind: 'irrigation',
                  unitId: focus.id,
                  mm: Number(mm) || DEFAULT_IRRIGATION_MM,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Droplets className="h-4 w-4" />}
              {radarT(loc, 'Irriguei', 'Regué', 'Irrigated')}
            </button>
          </div>
        )}
      </div>

      {err && <p className="mt-2 text-sm text-rose-200">{err}</p>}
      {ok && <p className="mt-2 text-sm text-emerald-200">{radarT(loc, 'Guardado', 'Guardado', 'Saved')}</p>}

      <div className="mt-4 border-t border-white/15 pt-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={radarT(loc, 'O que viste neste espaço…', 'Qué viste en este espacio…', 'What you saw here…')}
          className="w-full rounded-lg border border-white/20 bg-[#0c1a24] px-3 py-2 text-sm text-white outline-none placeholder:text-white/45 focus:ring-2 focus:ring-sky-500/40"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || note.trim().length < 2}
            onClick={() => void post({ action: 'line', kind: 'observation', unitId: focus.id, note: note.trim() })}
            className="inline-flex items-center gap-2 rounded-lg bg-[#12343c] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            {radarT(loc, 'Guardar nota', 'Guardar nota', 'Save note')}
          </button>
          <Link
            href={cadernoHref}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:bg-teal-400"
          >
            <BookOpen className="h-4 w-4" />
            {book.registerCta}
          </Link>
        </div>
      </div>

      {recent.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/15 pt-3">
          {recent.map((l) => (
            <li key={l.id} className="rounded-lg bg-[#0c1a24] px-3 py-2 text-sm text-white/80">
              <span className="text-white/45">
                {new Date(l.occurredAt).toLocaleString(loc === 'es' ? 'es' : loc === 'en' ? 'en' : 'pt-BR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {' · '}
              {l.note || l.kind}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
