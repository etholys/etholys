'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionProps } from './types';
import { FileSpreadsheet, Loader2, Link2, RefreshCw, Plus, X } from 'lucide-react';

type ProgressEntry = {
  id: string;
  periodLabel: string;
  cumulativeBefore: string | null;
  progressDuring: string | null;
  totalCumulative: string | null;
  status: string;
  comments: string | null;
  createdAt: string;
};

type RtLine = {
  id: string;
  order: number;
  block: string;
  resultContext: string | null;
  indicatorText: string;
  isDos: boolean;
  tag: string;
  baseline: string | null;
  target: string | null;
  notes: string | null;
  siepHint: string | null;
  linkedObjectiveId: string | null;
  reflectedActual: string | null;
  reportedValue: string | null;
  reportedStatus: string;
  latestProgress: ProgressEntry | null;
  linkedObjective: {
    id: string;
    title: string;
    indicator: string | null;
    baseline: string | null;
    target: string | null;
    actual: string | null;
  } | null;
};

type RtTool = {
  id: string;
  title: string;
  version: string | null;
  sourceFileName: string | null;
  notes: string | null;
};

const TAG_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  same_essence: { bg: 'bg-emerald-50', text: 'text-emerald-800', label: 'Misma esencia' },
  official_dos: { bg: 'bg-indigo-50', text: 'text-indigo-800', label: 'DoS / oficial' },
  to_be_designed: { bg: 'bg-amber-50', text: 'text-amber-800', label: 'To be designed' },
  project_only_internal: { bg: 'bg-slate-50', text: 'text-slate-700', label: 'Sólo interno' },
};

const STATUS_OPTS = ['Not started', 'On track', 'Slightly off track', 'Severely off track'] as const;

const STATUS_STYLE: Record<string, string> = {
  'Not started': 'bg-gray-100 text-gray-600',
  'On track': 'bg-emerald-50 text-emerald-700',
  'Slightly off track': 'bg-amber-50 text-amber-800',
  'Severely off track': 'bg-red-50 text-red-700',
};

export function ReportingToolPanel({ project }: SectionProps) {
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<RtTool | null>(null);
  const [lines, setLines] = useState<RtLine[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<'all' | 'project_results' | 'cross_cutting' | string>('all');
  const [activeLine, setActiveLine] = useState<RtLine | null>(null);
  const [history, setHistory] = useState<ProgressEntry[]>([]);
  const [form, setForm] = useState({
    periodLabel: '',
    periodStart: '',
    periodEnd: '',
    cumulativeBefore: '',
    progressDuring: '',
    totalCumulative: '',
    status: 'On track',
    comments: '',
  });

  const load = useCallback(async () => {
    if (!project?.id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${project.id}/reporting-tool`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Error al cargar');
      setTool(d.tool);
      setLines(d.lines || []);
      setCounts(d.counts || {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [project?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const seed = async () => {
    if (!project?.id) return;
    setSeeding(true);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${project.id}/reporting-tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seed: 'impulsa-los-santos-v-agust', replace: true }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Error al cargar el mapa');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSeeding(false);
    }
  };

  const openProgress = async (line: RtLine) => {
    setActiveLine(line);
    setError(null);
    const prev = line.latestProgress;
    setForm({
      periodLabel: '',
      periodStart: '',
      periodEnd: '',
      cumulativeBefore: prev?.totalCumulative || prev?.progressDuring || '',
      progressDuring: '',
      totalCumulative: '',
      status: prev?.status && prev.status !== 'Not started' ? prev.status : 'On track',
      comments: '',
    });
    try {
      const r = await fetch(
        `/api/projects/${project.id}/reporting-tool/progress?lineId=${encodeURIComponent(line.id)}`,
        { cache: 'no-store' },
      );
      const d = await r.json();
      if (r.ok) setHistory(d.entries || []);
      else setHistory(line.latestProgress ? [line.latestProgress] : []);
    } catch {
      setHistory(line.latestProgress ? [line.latestProgress] : []);
    }
  };

  const saveProgress = async () => {
    if (!project?.id || !activeLine) return;
    if (!form.periodLabel.trim()) {
      setError('Indica el período (ej. 2026-Q3)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/projects/${project.id}/reporting-tool/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineId: activeLine.id,
          periodLabel: form.periodLabel.trim(),
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          cumulativeBefore: form.cumulativeBefore || null,
          progressDuring: form.progressDuring || null,
          totalCumulative: form.totalCumulative || null,
          status: form.status,
          comments: form.comments || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'No se pudo guardar el avance');
      setActiveLine(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const visible = useMemo(() => {
    if (filter === 'all') return lines;
    if (filter === 'project_results' || filter === 'cross_cutting') {
      return lines.filter((l) => l.block === filter);
    }
    return lines.filter((l) => l.tag === filter);
  }, [lines, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 gap-2 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando Reporting Tool…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
              {tool?.title || 'Reporting Tool'}
              {tool?.version && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  {tool.version}
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-2xl">
              Capa oficial de reporte. Usa <span className="font-medium">+ Avance</span> en cada línea para
              registrar progreso del período (como en el Excel). TBD = To be designed — puedes anotar, pero
              la métrica aún no está cerrada.
            </p>
            {tool?.sourceFileName && (
              <p className="text-[10px] text-gray-400 mt-1">Fuente: {tool.sourceFileName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Actualizar
            </button>
            <button
              type="button"
              onClick={seed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
            >
              {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {tool ? 'Recargar mapa' : 'Cargar mapa'}
            </button>
          </div>
        </div>

        {error && !activeLine && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {tool && (
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700">{counts.total ?? lines.length} líneas</span>
            <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-800">
              {counts.same_essence ?? 0} misma esencia
            </span>
            <span className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-800">
              {counts.official_dos ?? 0} DoS / oficial
            </span>
            <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-800">
              {counts.to_be_designed ?? 0} to be designed
            </span>
            <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-800">
              {counts.linked ?? 0} vinculadas al logframe
            </span>
          </div>
        )}
      </div>

      {!tool ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Aún no hay Reporting Tool en este proyecto</p>
          <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
            Carga el mapa validado (Impulsa Los Santos · v.agust). El marco lógico no se modifica.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'project_results', label: 'Resultados del proyecto' },
              { id: 'cross_cutting', label: 'Cross-cutting / DoS' },
              { id: 'same_essence', label: 'Misma esencia' },
              { id: 'official_dos', label: 'DoS oficial' },
              { id: 'to_be_designed', label: 'To be designed' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                  filter === f.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/80 text-[10px] uppercase tracking-wide text-gray-500">
                    <th className="text-left px-3 py-2 w-10">#</th>
                    <th className="text-left px-3 py-2">Indicador</th>
                    <th className="text-left px-3 py-2 w-24">Etiqueta</th>
                    <th className="text-right px-3 py-2 w-16">Meta</th>
                    <th className="text-right px-3 py-2 w-20">Acumulado</th>
                    <th className="text-left px-3 py-2 w-28">Estado</th>
                    <th className="text-left px-3 py-2 w-40">Vínculo PMP</th>
                    <th className="text-right px-3 py-2 w-24">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {visible.map((line) => {
                    const tag = TAG_STYLE[line.tag] || TAG_STYLE.to_be_designed;
                    const st = line.reportedStatus || 'Not started';
                    return (
                      <tr key={line.id} className="hover:bg-gray-50/60">
                        <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{line.order}</td>
                        <td className="px-3 py-2.5">
                          <p className="text-xs text-gray-800 leading-snug">{line.indicatorText}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {line.resultContext && (
                              <span className="text-[9px] text-gray-500">{line.resultContext}</span>
                            )}
                            {line.isDos && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                                DoS Yes
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${tag.bg} ${tag.text}`}>
                            {tag.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-medium text-gray-700">
                          {line.target || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right text-xs font-semibold text-indigo-700">
                          {line.reportedValue || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${STATUS_STYLE[st] || STATUS_STYLE['Not started']}`}>
                            {st}
                          </span>
                          {line.latestProgress?.periodLabel && (
                            <span className="block text-[9px] text-gray-400 mt-0.5">{line.latestProgress.periodLabel}</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {line.linkedObjective ? (
                            <div className="flex items-start gap-1 text-[10px] text-emerald-800">
                              <Link2 className="w-3 h-3 mt-0.5 shrink-0" />
                              <span className="leading-snug line-clamp-2">{line.linkedObjective.title}</span>
                            </div>
                          ) : (
                            <span className="text-[10px] text-gray-400">Sin vínculo</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => openProgress(line)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                          >
                            <Plus className="w-3 h-3" /> Avance
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeLine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Reportar avance</h4>
                <p className="text-[11px] text-gray-500 mt-1 leading-snug">{activeLine.indicatorText}</p>
                {activeLine.tag === 'to_be_designed' && (
                  <p className="text-[10px] text-amber-700 mt-1 bg-amber-50 rounded px-2 py-1">
                    To be designed — puedes registrar notas/progreso provisional; la métrica aún no está cerrada.
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setActiveLine(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Período *</label>
                <input
                  value={form.periodLabel}
                  onChange={(e) => setForm({ ...form, periodLabel: e.target.value })}
                  placeholder="2026-Q3"
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Inicio</label>
                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fin</label>
                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Acum. antes</label>
                  <input
                    value={form.cumulativeBefore}
                    onChange={(e) => setForm({ ...form, cumulativeBefore: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">En el período</label>
                  <input
                    value={form.progressDuring}
                    onChange={(e) => setForm({ ...form, progressDuring: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total acum.</label>
                  <input
                    value={form.totalCumulative}
                    onChange={(e) => setForm({ ...form, totalCumulative: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border text-sm"
                    placeholder="5"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border text-sm bg-white"
                >
                  {STATUS_OPTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Comentarios / medios de verificación
                </label>
                <textarea
                  value={form.comments}
                  onChange={(e) => setForm({ ...form, comments: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border text-sm"
                  placeholder="Evidencia, anexos, notas…"
                />
              </div>

              {history.length > 0 && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 mb-2">Historial</p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto">
                    {history.map((h) => (
                      <div key={h.id} className="text-[11px] text-gray-600 bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <span className="font-medium text-gray-800">{h.periodLabel}</span>
                        {' · '}
                        {h.totalCumulative || h.progressDuring || '—'}
                        {' · '}
                        {h.status}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setActiveLine(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveProgress}
                disabled={saving}
                className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar avance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
