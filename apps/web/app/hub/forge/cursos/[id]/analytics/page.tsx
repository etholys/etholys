'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Download, AlertTriangle, BarChart3 } from 'lucide-react';
import type { CourseAnalytics } from '@/lib/forge/course-analytics-types';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

export default function ForgeCourseAnalyticsPage() {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const { id: courseId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const fromEdition = searchParams.get('from') === 'edition';
  const editionReturnId = searchParams.get('editionId');
  const backHref =
    fromEdition && editionReturnId
      ? `/hub/forge/cursos/${courseId}/turmas/${editionReturnId}`
      : `/hub/forge/cursos/${courseId}`;
  const dateLocale = locale === 'pt' ? 'pt-PT' : locale === 'en' ? 'en-GB' : 'es-ES';
  const [data, setData] = useState<CourseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}/analytics`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || ft('forge.general.error'));
        setData(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : ft('forge.general.error')))
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-violet-600/30 border-t-violet-600" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-red-600">{error ?? ft('forge.general.noData')}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> {ft('forge.analytics.back')}
        </Link>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/forge/courses/${courseId}/analytics/report?lang=${locale}`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            {ft('forge.analytics.report')}
          </a>
          <a
            href={`/api/forge/courses/${courseId}/learners/export`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            {ft('forge.analytics.csv')}
          </a>
          <button
            type="button"
            onClick={() => {
              fetch(`/api/forge/courses/${courseId}/analytics?notify=1&lang=${locale}`)
                .then(() => alert(ft('forge.analytics.notifyTeamOk')))
                .catch(() => alert(ft('forge.general.error')));
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            {ft('forge.analytics.notifyTeam')}
          </button>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/forge/courses/${courseId}/notify-learners`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'all', locale }),
              });
              const d = await res.json();
              if (!res.ok) return alert(d.error || ft('forge.general.error'));
              alert(
                ft('forge.analytics.notifyLearnersOk', {
                  atRisk: d.summary?.atRiskNotified ?? 0,
                  inactive: d.summary?.inactiveNotified ?? 0,
                  emails: d.summary?.emailsSent ?? 0,
                })
              );
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
          >
            {ft('forge.analytics.emailLearners')}
          </button>
        </div>
      </div>

      <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
        <BarChart3 className="h-7 w-7 text-violet-600" />
        {ft('forge.analytics.title')}
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={ft('forge.analytics.stat.learners')} value={data.learnerCount} />
        <Stat label={ft('forge.analytics.stat.progress')} value={`${data.avgProgress}%`} />
        <Stat label={ft('forge.analytics.stat.active7')} value={data.activeLast7Days} />
        <Stat label={ft('forge.analytics.stat.certs')} value={data.certificatesIssued} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="font-bold text-slate-900">{ft('forge.analytics.heatmap')}</h2>
        <p className="text-sm text-slate-500 mb-4">{ft('forge.analytics.heatmapHint')}</p>
        <div className="space-y-3">
          {data.moduleHeatmap.map((m) => (
            <div key={m.moduleId}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-slate-800">{m.title}</span>
                <span className="text-slate-500">{m.completionRate}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-violet-500 transition-all"
                  style={{ width: `${m.completionRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {data.atRisk.length > 0 && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-6">
          <h2 className="flex items-center gap-2 font-bold text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            {ft('forge.analytics.atRisk')}
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.atRisk.map((a) => (
              <li key={a.userId} className="flex flex-wrap justify-between gap-2">
                <Link
                  href={`/hub/forge/cursos/${courseId}/alumnos/${a.userId}`}
                  className="font-medium text-amber-900 hover:underline"
                >
                  {a.name ?? a.email}
                </Link>
                <span className="text-amber-800">
                  {a.progressPercent}% ·{' '}
                  {ft('forge.analytics.since', {
                    date: new Date(a.enrolledAt).toLocaleDateString(dateLocale),
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-black text-slate-900">{value}</p>
    </div>
  );
}
