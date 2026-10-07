'use client';

import { useCallback, useEffect, useState } from 'react';
import { Droplets, Loader2, MessageSquare } from 'lucide-react';
import { DEFAULT_IRRIGATION_MM, MOISTURE_THRESHOLD } from '@/lib/radar/agriculture';
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

/** One focused space: what to do now + one note. Replaces stacked ops boards. */
export function RadarFocusSheet({
  companyId,
  engagementId,
  locale,
  moduleId,
  units,
  focusedId,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
  moduleId: string | null;
  units: Unit[];
  focusedId: string | null;
}) {
  const loc = radarLoc(locale);
  const meta = spaceKindMeta(moduleId);
  const focus = units.find((u) => u.id === focusedId) || units[0] || null;
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
      <div className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-white/50">
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
    <section className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-4 sm:px-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
        {radarT(loc, 'Tarefas', 'Tareas', 'Tasks')}
      </p>
      <h2 className="mt-1 truncate text-lg font-medium text-white">{focus.name}</h2>
      <p className="text-xs text-white/45">
        {[focus.crop, focus.areaHa != null ? `${focus.areaHa} ${meta.areaUnit[loc]}` : null, moisture != null ? `${moisture}%` : null]
          .filter(Boolean)
          .join(' · ') || '—'}
      </p>

      {/* BlueIoT-style task card */}
      <div
        className={`mt-3 rounded-lg border px-3 py-3 ${
          holdHarvest || needIrrigate
            ? 'border-amber-400/35 bg-amber-500/10'
            : 'border-white/10 bg-black/25'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white">{cue}</p>
        </div>
        <p className="mt-2 text-[11px] text-white/45">
          <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${holdHarvest || needIrrigate ? 'bg-amber-400' : 'bg-emerald-400'}`} />
          {priority}
          {moduleId === 'agriculture' ? ` · ${radarT(loc, 'Preventivo / campo', 'Preventivo / campo', 'Field / preventive')}` : ''}
        </p>
        {needIrrigate && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={mm}
              onChange={(e) => setMm(e.target.value)}
              inputMode="decimal"
              className="w-16 rounded-lg border border-white/15 bg-black/30 px-2 py-1.5 text-sm text-white"
            />
            <span className="text-xs text-white/45">mm</span>
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

      <div className="mt-4 border-t border-white/10 pt-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={radarT(loc, 'O que viste neste espaço…', 'Qué viste en este espacio…', 'What you saw here…')}
          className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-sky-500/40"
        />
        <button
          type="button"
          disabled={busy || note.trim().length < 2}
          onClick={() => void post({ action: 'line', kind: 'scout', unitId: focus.id, note: note.trim() })}
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          {radarT(loc, 'Guardar nota', 'Guardar nota', 'Save note')}
        </button>
      </div>

      {recent.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/10 pt-3">
          {recent.map((l) => (
            <li key={l.id} className="text-sm text-white/65">
              <span className="text-white/35">
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
