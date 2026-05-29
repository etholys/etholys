'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Download, Route } from 'lucide-react';
import type { ProgramAnalytics } from '@/lib/forge/program-analytics-types';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

type CourseOpt = { id: string; title: string; coverEmoji: string; programId: string | null };

export default function ForgeTrilhaDetailPage() {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const { id } = useParams<{ id: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linked, setLinked] = useState<CourseOpt[]>([]);
  const [available, setAvailable] = useState<CourseOpt[]>([]);
  const [analytics, setAnalytics] = useState<ProgramAnalytics | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [enforceOrder, setEnforceOrder] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/forge/programs/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.program) {
          setTitle(d.program.title);
          setDescription(d.program.description ?? '');
          setEnforceOrder(Boolean(d.program.enforceOrder));
          setLinked(d.program.courses ?? []);
          setSelected(new Set((d.program.courses ?? []).map((c: CourseOpt) => c.id)));
        }
        setAvailable(d.availableCourses ?? []);
        setAnalytics(d.analytics ?? null);
      });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveCourses() {
    setBusy(true);
    const courseSortOrders = available
      .filter((c) => selected.has(c.id))
      .map((c, i) => ({ courseId: c.id, sortOrder: i }));
    await fetch(`/api/forge/programs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseIds: [...selected],
        enforceOrder,
        courseSortOrders,
      }),
    });
    setBusy(false);
    load();
  }

  function toggle(cid: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) next.delete(cid);
      else next.add(cid);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/hub/forge/trilhas" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> {ft('forge.trails.back')}
      </Link>

      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Route className="h-7 w-7 text-violet-600" />
            {title}
          </h1>
          {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
        </div>
        <a
          href={`/api/forge/programs/${id}/report?lang=${locale}`}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800"
        >
          <Download className="h-4 w-4" />
          {ft('forge.trails.htmlReport')}
        </a>
      </div>

      {analytics && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Cursos" value={analytics.courseCount} />
          <Stat label="Alumnos únicos" value={analytics.totalLearners} />
          <Stat label="Progreso medio" value={`${analytics.avgProgressAcrossCourses}%`} />
        </div>
      )}

      {analytics && analytics.courses.length > 0 && (
        <section className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
          <h2 className="flex items-center gap-2 font-bold">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            Por curso
          </h2>
          {analytics.courses.map((c) => (
            <div key={c.courseId} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
              <Link href={`/hub/forge/cursos/${c.courseId}/analytics`} className="font-medium text-violet-800 hover:underline">
                {c.coverEmoji} {c.title}
              </Link>
              <span className="text-sm text-slate-600">
                {c.learnerCount} alumnos · {c.avgProgress}% · {c.atRisk.length} en riesgo
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 mb-4">
          <input
            type="checkbox"
            checked={enforceOrder}
            onChange={(e) => setEnforceOrder(e.target.checked)}
          />
          {ft('forge.trails.enforceOrder')}
        </label>
        <h2 className="font-bold text-slate-900">Cursos en esta trilha</h2>
        <p className="text-sm text-slate-500 mb-4">Marca los cursos que forman parte del programa.</p>
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {available.map((c) => (
            <li key={c.id}>
              <label className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                />
                <span>
                  {c.coverEmoji} {c.title}
                  {c.programId && c.programId !== id && (
                    <span className="ml-2 text-xs text-amber-600">(otra trilha)</span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          disabled={busy}
          onClick={saveCourses}
          className="mt-4 rounded-xl bg-violet-600 px-5 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {busy ? '…' : ft('forge.trails.saveCourses')}
        </button>
        {linked.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            Actualmente: {linked.map((c) => c.title).join(', ')}
          </p>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}
