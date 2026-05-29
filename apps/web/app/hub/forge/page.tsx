'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/app/providers';
import {
  GraduationCap,
  Users,
  Trophy,
  Award,
  BookOpen,
  ArrowRight,
  Route,
} from 'lucide-react';
import { ForgeAtRiskBanner } from '@/components/forge/ForgeAtRiskBanner';
import { useForgeT } from '@/lib/forge/use-forge-t';

export default function ForgeDashboard() {
  const ft = useForgeT();
  const { activeCompanyId } = useApp();
  const [stats, setStats] = useState({
    publishedCourses: 0,
    activeEnrollments: 0,
    completedGameSessions: 0,
    completedEnrollments: 0,
  });
  const [courses, setCourses] = useState<
    { id: string; title: string; coverEmoji: string; progressPercent?: number }[]
  >([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const q = activeCompanyId ? `?companyId=${encodeURIComponent(activeCompanyId)}` : '';
    setLoadError(null);
    Promise.all([
      fetch(`/api/forge/overview${q}`).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `overview ${r.status}`);
        return d;
      }),
      fetch(`/api/forge/courses${q}`).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || `courses ${r.status}`);
        return d;
      }),
    ])
      .then(([overview, coursesRes]) => {
        if (overview.stats) setStats(overview.stats);
        setCourses((coursesRes.courses ?? []).slice(0, 4));
      })
      .catch((e) => {
        setLoadError(e instanceof Error ? e.message : ft('forge.dashboard.loadError'));
      });
  }, [activeCompanyId]);

  const statCards = [
    { label: ft('forge.dashboard.stat.published'), value: String(stats.publishedCourses), icon: GraduationCap, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: ft('forge.dashboard.stat.enrollments'), value: String(stats.activeEnrollments), icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: ft('forge.dashboard.stat.games'), value: String(stats.completedGameSessions), icon: Trophy, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: ft('forge.dashboard.stat.completed'), value: String(stats.completedEnrollments), icon: Award, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  ];

  const expedicion = courses.find((c) => c.title.includes('Expedición'));

  return (
    <div className="min-h-full space-y-8">
      <ForgeAtRiskBanner companyId={activeCompanyId} />

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {loadError}.{' '}
          <Link href="/hub/forge/diagnostico" className="font-semibold underline">
            {ft('forge.dashboard.diagnostic')}
          </Link>
        </div>
      ) : null}

      <div className="-mx-4 md:-mx-6 overflow-hidden rounded-b-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-4 py-8 md:px-8">
        <h1 className="text-2xl font-black text-white md:text-3xl">FORGE</h1>
        <p className="mt-2 max-w-xl text-sm text-blue-100">
          {ft('forge.dashboard.tagline')}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {expedicion ? (
            <Link
              href={`/hub/forge/cursos/${expedicion.id}`}
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-blue-900 shadow-lg hover:bg-blue-50"
            >
              🌱 La Expedición Sostenible
            </Link>
          ) : null}
          <Link
            href="/hub/forge/cursos"
            className="rounded-xl border border-white/30 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            {ft('forge.dashboard.allCourses')}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((s) => (
          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-500">{s.label}</p>
              <div className={`rounded-lg p-1.5 ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/hub/forge/cursos"
          className="group rounded-xl border border-violet-200 bg-white p-4 shadow-sm hover:shadow-md"
        >
          <GraduationCap className="h-6 w-6 text-violet-600" />
          <h3 className="mt-2 font-bold">{ft('forge.nav.courses')}</h3>
          <p className="text-xs text-slate-500">Aulas, quizzes e jogos como atividades</p>
          <ArrowRight className="mt-2 h-4 w-4 text-violet-500 opacity-0 group-hover:opacity-100" />
        </Link>
        <Link href="/hub/forge/trilhas" className="group rounded-xl border bg-white p-4 shadow-sm hover:shadow-md">
          <Route className="h-6 w-6 text-indigo-600" />
          <h3 className="mt-2 font-bold">{ft('forge.nav.trails')}</h3>
          <p className="text-xs text-slate-500">Programas com vários cursos</p>
        </Link>
        <Link href="/hub/forge/gamificacao" className="group rounded-xl border bg-white p-4 shadow-sm hover:shadow-md">
          <Trophy className="h-6 w-6 text-amber-600" />
          <h3 className="mt-2 font-bold">{ft('forge.nav.gamification')}</h3>
          <p className="text-xs text-slate-500">XP, ranking, certificados</p>
        </Link>
      </div>

      {courses.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">{ft('forge.dashboard.continue')}</h2>
            <Link href="/hub/forge/cursos" className="text-xs font-medium text-violet-600 hover:underline">
              {ft('forge.dashboard.seeAll')} →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {courses.map((c) => (
              <Link
                key={c.id}
                href={`/hub/forge/cursos/${c.id}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md"
              >
                <div className="text-3xl mb-2">{c.coverEmoji}</div>
                <h3 className="text-sm font-bold text-slate-900 line-clamp-2">{c.title}</h3>
                {c.progressPercent != null && (
                  <p className="mt-2 text-xs text-slate-500">{c.progressPercent}% {ft('forge.dashboard.progress')}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-700 p-5 text-white text-sm">
        <BookOpen className="h-5 w-5 mb-2 opacity-90" />
        <p className="font-semibold">{ft('forge.dashboard.tipTitle')}</p>
        <p className="mt-1 opacity-90">{ft('forge.dashboard.tipBody')}</p>
      </div>
    </div>
  );
}
