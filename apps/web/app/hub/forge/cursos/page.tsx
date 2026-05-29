'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useApp } from '@/app/providers';
import { EXPEDICION_OWNER_EMAIL } from '@/lib/forge/expedicion-owner-constants';
import { Plus, Sparkles, GraduationCap, Video } from 'lucide-react';
import { type ForgeDeliveryMode } from '@/lib/forge/delivery';
import { useForgeT } from '@/lib/forge/use-forge-t';

type CourseRow = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  coverEmoji: string;
  progressPercent?: number;
  activityCount: number;
  deliveryMode?: ForgeDeliveryMode;
  learner?: { xp: number; level: number };
};

export default function ForgeCursosPage() {
  const ft = useForgeT();
  const { data: session } = useSession();
  const { activeCompanyId } = useApp();
  const isExpedicionOwner =
    session?.user?.email?.toLowerCase() === EXPEDICION_OWNER_EMAIL.toLowerCase();
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const companyQ = activeCompanyId ? `companyId=${encodeURIComponent(activeCompanyId)}` : '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/forge/courses?${companyQ}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || ft('forge.courses.loadError'));
      setCourses(data.courses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : ft('forge.general.error'));
    } finally {
      setLoading(false);
    }
  }, [companyQ, ft]);

  useEffect(() => {
    load();
  }, [load]);

  async function seedDemo() {
    const res = await fetch('/api/forge/seed-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || ft('forge.general.error'));
      return;
    }
    await load();
    if (data.courseId) window.location.href = `/hub/forge/cursos/${data.courseId}`;
  }

  async function seedExpedicion(replace = false, allMyCompanies = false) {
    const res = await fetch(
      allMyCompanies ? '/api/forge/seed-expedicion/owner' : '/api/forge/seed-expedicion',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          allMyCompanies
            ? { replace }
            : { companyId: activeCompanyId, replace }
        ),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || ft('forge.general.error'));
      return;
    }
    await load();
    const firstId = data.courseId ?? data.courses?.[0]?.courseId;
    if (firstId) window.location.href = `/hub/forge/cursos/${firstId}`;
  }

  async function createCourse() {
    const title = window.prompt(ft('forge.courses.promptTitle'));
    if (!title?.trim()) return;
    const res = await fetch('/api/forge/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: activeCompanyId, title: title.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || ft('forge.general.error'));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{ft('forge.courses.title')}</h1>
          <p className="text-sm text-slate-500">{ft('forge.courses.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isExpedicionOwner && (
            <button
              type="button"
              onClick={() => {
                if (
                  !window.confirm(
                    '¿Republicar La Expedición Sostenible en Rural Commerce LLC y LTDA? Se reemplaza el contenido existente.'
                  )
                )
                  return;
                void seedExpedicion(true, true);
              }}
              className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <GraduationCap className="h-4 w-4" />
              La Expedición (todas mis empresas)
            </button>
          )}
          {isExpedicionOwner && (
            <button
              type="button"
              onClick={() => seedExpedicion(false)}
              className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              <GraduationCap className="h-4 w-4" />
              {ft('forge.courses.seedExpedicion')}
            </button>
          )}
          <button
            type="button"
            onClick={seedDemo}
            className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
          >
            <Sparkles className="h-4 w-4" />
            {ft('forge.courses.seedDemo')}
          </button>
          <button
            type="button"
            onClick={createCourse}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus className="h-4 w-4" />
            {ft('forge.courses.new')}
          </button>
        </div>
      </div>

      {loading && <p className="text-sm text-slate-500">{ft('forge.courses.loading')}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && courses.length === 0 && (
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-8 text-center">
          <GraduationCap className="mx-auto h-10 w-10 text-violet-400" />
          <p className="mt-2 font-medium text-slate-700">{ft('forge.courses.emptyTitle')}</p>
          <p className="mt-1 text-sm text-slate-500">{ft('forge.courses.emptyHint')}</p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
            <Link
              key={c.id}
              href={`/hub/forge/cursos/${c.id}`}
              onClick={() => {
                fetch('/api/forge/enrollments', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ courseId: c.id }),
                }).catch(() => {});
              }}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-violet-200"
            >
            <div className="text-3xl">{c.coverEmoji}</div>
            <h2 className="mt-2 font-bold text-slate-900 line-clamp-2">{c.title}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {c.status} · {c.activityCount} {ft('forge.courses.activities')}
              {c.learner != null &&
                ` · ${c.learner.xp} XP · ${ft('forge.courses.level')} ${c.learner.level}`}
            </p>
            {c.deliveryMode && c.deliveryMode !== 'async' && (
              <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                <Video className="h-3 w-3" />
                {ft(`forge.delivery.${c.deliveryMode}.label`)}
              </p>
            )}
            {c.progressPercent != null && (
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>{ft('forge.courses.progress')}</span>
                  <span>{c.progressPercent}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div
                    className="h-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                    style={{ width: `${c.progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
