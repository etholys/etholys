'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, MapPinned, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useRadarClientScopeOptional } from '@/components/radar/RadarClientScopeContext';
import { RADAR_SCOPE_OWN } from '@/lib/radar/client-scope';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import {
  statusLabel,
  type RadarTaskProgressNote,
  type RadarTaskSeverity,
  type RadarTaskStatus,
} from '@/lib/radar/tasks';

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: RadarTaskStatus;
  severity: RadarTaskSeverity;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitName: string | null;
  sourceKey: string | null;
  dueAt: string | null;
  progress: RadarTaskProgressNote[];
  href: string;
  persisted: boolean;
  updatedAt: string;
};

type UnitOpt = { id: string; name: string; propertyId: string; propertyName: string };

const COLUMNS: RadarTaskStatus[] = ['todo', 'doing', 'done'];

export function RadarTasksBoard({
  companyId,
  engagementId,
  locale,
}: {
  companyId: string;
  engagementId?: string | null;
  locale: string;
}) {
  const loc = radarLoc(locale);
  const scope = useRadarClientScopeOptional()?.scope || RADAR_SCOPE_OWN;
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [unitFilter, setUnitFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftUnit, setDraftUnit] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const companyQ = engagementId
    ? `company=${companyId}&engagement=${engagementId}`
    : `company=${companyId}`;

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setErr(null);
    try {
      const q = new URLSearchParams({ companyId, clientId: scope });
      if (engagementId) q.set('engagementId', engagementId);
      if (unitFilter && unitFilter !== 'all') q.set('unitId', unitFilter);
      const r = await fetch(`/api/radar/tasks?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setTasks(d.tasks || []);
      setUnits(d.units || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, scope, unitFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openTask = useMemo(() => tasks.find((t) => t.id === openId) || null, [tasks, openId]);

  useEffect(() => {
    if (!openTask) return;
    setEditTitle(openTask.title);
    setEditDescription(openTask.description || '');
    setProgressNote('');
  }, [openTask?.id]);

  const patchTask = async (payload: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/radar/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, engagementId, ...payload }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      await load();
      if (d.task?.id) setOpenId(d.task.id as string);
      return d.task as TaskRow | undefined;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  const createTask = async () => {
    if (draftTitle.trim().length < 2) return;
    setBusy(true);
    setErr(null);
    try {
      const unit = units.find((u) => u.id === draftUnit);
      const r = await fetch('/api/radar/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          engagementId,
          title: draftTitle.trim(),
          unitId: draftUnit || null,
          propertyId: unit?.propertyId || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setCreating(false);
      setDraftTitle('');
      setDraftUnit('');
      await load();
      if (d.task?.id) setOpenId(d.task.id as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  };

  const byStatus = useMemo(() => {
    const map: Record<RadarTaskStatus, TaskRow[]> = { todo: [], doing: [], done: [] };
    for (const t of tasks) map[t.status].push(t);
    return map;
  }, [tasks]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/40">RADAR</p>
          <h1 className="mt-2 font-serif text-4xl text-white">
            {radarT(loc, 'Tarefas de campo', 'Tareas de campo', 'Field tasks')}
          </h1>
          <p className="mt-2 max-w-lg text-sm text-white/55">
            {radarT(
              loc,
              'O que fazer agora — por estado, filtrável por espaço.',
              'Qué hacer ahora — por estado, filtrable por espacio.',
              'What to do now — by status, filterable by space.',
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-[#0c1a24] px-3 py-2 text-sm text-white">
            <span className="text-white/50">{radarT(loc, 'Espaço', 'Espacio', 'Space')}</span>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="bg-transparent text-white outline-none [&>option]:bg-slate-950 [&>option]:text-slate-100"
            >
              <option value="all">{radarT(loc, 'Todas', 'Todas', 'All')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.propertyName} · {u.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-[#04110c]"
          >
            <Plus className="h-4 w-4" />
            {radarT(loc, 'Nova tarefa', 'Nueva tarea', 'New task')}
          </button>
          <Link
            href={`/hub/radar?${companyQ}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/80"
          >
            <MapPinned className="h-4 w-4" />
            {radarT(loc, 'Abrir mapa', 'Abrir mapa', 'Open map')}
          </Link>
        </div>
      </div>

      {err && (
        <p className="rounded-xl border border-rose-400/30 bg-rose-950/90 px-3 py-2 text-sm text-rose-100">{err}</p>
      )}

      {creating && (
        <div className="rounded-2xl border border-white/15 bg-[#0c1a24] px-4 py-4">
          <p className="text-sm font-semibold text-white">{radarT(loc, 'Nova tarefa', 'Nueva tarea', 'New task')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              placeholder={radarT(loc, 'O que fazer…', 'Qué hacer…', 'What to do…')}
              className="min-w-[14rem] flex-1 rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none"
              autoFocus
            />
            <select
              value={draftUnit}
              onChange={(e) => setDraftUnit(e.target.value)}
              className="rounded-xl border border-slate-500 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 [&>option]:bg-slate-950"
            >
              <option value="">{radarT(loc, 'Sem espaço', 'Sin espacio', 'No space')}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={busy || draftTitle.trim().length < 2}
              onClick={() => void createTask()}
              className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : radarT(loc, 'Criar', 'Crear', 'Create')}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-xl px-3 py-2 text-sm text-white/55">
              {radarT(loc, 'Cancelar', 'Cancelar', 'Cancel')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin text-emerald-300" />
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#0c1a24] px-5 py-10 text-center">
          <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-300/70" />
          <p className="mt-3 text-sm text-white/55">
            {radarT(loc, 'Nada urgente neste filtro.', 'Nada urgente en este filtro.', 'Nothing urgent in this filter.')}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {COLUMNS.map((col) => (
            <section key={col} className="rounded-2xl border border-white/12 bg-[#07111A] p-3">
              <header className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/55">
                  {statusLabel(col, loc)}
                </h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/70">
                  {byStatus[col].length}
                </span>
              </header>
              <ul className="space-y-2">
                {byStatus[col].map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(t.id)}
                      className="w-full rounded-xl border border-white/10 bg-[#0c1a24] px-3 py-3 text-left transition hover:border-teal-400/40"
                    >
                      <p className="text-sm font-medium text-white">{t.title}</p>
                      <p className="mt-1 truncate text-[11px] text-white/45">
                        {[t.unitName || t.propertyName, t.severity === 'critical' ? radarT(loc, 'Urgente', 'Urgente', 'Urgent') : null]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                    </button>
                  </li>
                ))}
                {byStatus[col].length === 0 && (
                  <li className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-white/35">
                    —
                  </li>
                )}
              </ul>
            </section>
          ))}
        </div>
      )}

      {openTask && (
        <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/20 bg-[#07111A] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
                  {radarT(loc, 'Ficha da tarefa', 'Ficha de la tarea', 'Task file')}
                </p>
                <h3 className="mt-1 text-xl font-medium text-white">{openTask.title}</h3>
                <p className="mt-1 text-xs text-white/50">
                  {[openTask.propertyName, openTask.unitName].filter(Boolean).join(' · ') ||
                    radarT(loc, 'Sem espaço', 'Sin espacio', 'No space')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenId(null)}
                className="rounded-full bg-[#12343c] p-2 text-white hover:bg-[#1a4a54]"
                aria-label={radarT(loc, 'Fechar', 'Cerrar', 'Close')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <section className="mt-4 space-y-2 border-t border-white/12 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-white/45">
                {radarT(loc, 'O que fazer', 'Qué hacer', 'What to do')}
              </h4>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                placeholder={radarT(loc, 'Descrição / instruções…', 'Descripción / instrucciones…', 'Description / instructions…')}
                className="w-full rounded-xl border border-white/15 bg-[#0c1a24] px-3 py-2 text-sm text-white outline-none"
              />
              <label className="block">
                <span className="text-xs text-white/45">{radarT(loc, 'Título', 'Título', 'Title')}</span>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/15 bg-[#0c1a24] px-3 py-2 text-sm text-white outline-none"
                />
              </label>
            </section>

            <section className="mt-4 space-y-2 border-t border-white/12 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-white/45">
                {radarT(loc, 'Estado', 'Estado', 'Status')}
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {COLUMNS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void patchTask({
                        action: 'update',
                        taskId: openTask.id,
                        sourceKey: openTask.sourceKey,
                        title: openTask.title,
                        description: openTask.description,
                        propertyId: openTask.propertyId,
                        unitId: openTask.unitId,
                        severity: openTask.severity,
                        status: s,
                      })
                    }
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      openTask.status === s ? 'bg-teal-300 text-slate-950' : 'bg-white/10 text-white hover:bg-white/15'
                    }`}
                  >
                    {statusLabel(s, loc)}
                  </button>
                ))}
              </div>
            </section>

            <section className="mt-4 space-y-2 border-t border-white/12 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-white/45">
                {radarT(loc, 'Avanço', 'Avance', 'Progress')}
              </h4>
              {openTask.progress.length > 0 && (
                <ul className="space-y-1.5">
                  {openTask.progress
                    .slice()
                    .reverse()
                    .map((p) => (
                      <li key={p.id} className="rounded-lg bg-[#0c1a24] px-3 py-2 text-sm text-white/80">
                        <span className="text-white/40">
                          {new Date(p.at).toLocaleString(loc === 'es' ? 'es' : loc === 'en' ? 'en' : 'pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {' · '}
                        {p.note}
                      </li>
                    ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  value={progressNote}
                  onChange={(e) => setProgressNote(e.target.value)}
                  placeholder={radarT(loc, 'Nota de avanço…', 'Nota de avance…', 'Progress note…')}
                  className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0c1a24] px-3 py-2 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  disabled={busy || progressNote.trim().length < 2}
                  onClick={() =>
                    void patchTask({
                      action: 'progress',
                      taskId: openTask.id,
                      sourceKey: openTask.sourceKey,
                      title: openTask.title,
                      description: openTask.description,
                      propertyId: openTask.propertyId,
                      unitId: openTask.unitId,
                      severity: openTask.severity,
                      note: progressNote.trim(),
                    }).then(() => setProgressNote(''))
                  }
                  className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {radarT(loc, 'Registar', 'Registrar', 'Log')}
                </button>
              </div>
            </section>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/12 pt-4">
              <button
                type="button"
                disabled={busy || editTitle.trim().length < 2}
                onClick={() =>
                  void patchTask({
                    action: 'update',
                    taskId: openTask.id,
                    sourceKey: openTask.sourceKey,
                    title: editTitle.trim(),
                    description: editDescription.trim() || null,
                    propertyId: openTask.propertyId,
                    unitId: openTask.unitId,
                    severity: openTask.severity,
                    status: openTask.status,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#04110c] disabled:opacity-40"
              >
                <Pencil className="h-3.5 w-3.5" />
                {radarT(loc, 'Guardar', 'Guardar', 'Save')}
              </button>
              {openTask.propertyId && (
                <Link
                  href={openTask.href}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-4 py-2 text-sm text-white/80"
                >
                  <MapPinned className="h-3.5 w-3.5" />
                  {radarT(loc, 'Abrir no mapa', 'Abrir en el mapa', 'Open on map')}
                </Link>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const ok = window.confirm(
                    radarT(loc, 'Arquivar esta tarefa?', '¿Archivar esta tarea?', 'Archive this task?'),
                  );
                  if (!ok) return;
                  void patchTask({
                    action: 'archive',
                    taskId: openTask.id,
                    sourceKey: openTask.sourceKey,
                    title: openTask.title,
                    description: openTask.description,
                    propertyId: openTask.propertyId,
                    unitId: openTask.unitId,
                    severity: openTask.severity,
                  }).then(() => setOpenId(null));
                }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/15 disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {radarT(loc, 'Arquivar', 'Archivar', 'Archive')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
