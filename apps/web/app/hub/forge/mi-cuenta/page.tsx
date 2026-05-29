'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap, User } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

type CourseRow = {
  course: { id: string; title: string; coverEmoji: string; status: string };
  progressPercent: number;
  status: string;
  enrolledAt: string;
};

export default function ForgeMiCuentaPage() {
  const ft = useForgeT();
  const [user, setUser] = useState<{ name: string | null; email: string | null } | null>(null);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/forge/my-account')
      .then((r) => r.json())
      .then((d) => {
        setUser(d.user ?? null);
        setCourses(d.courses ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <User className="h-7 w-7 text-blue-600" />
          {ft('forge.account.title')}
        </h1>
        {user && (
          <p className="mt-2 text-slate-600">
            {user.name} · <span className="text-slate-500">{user.email}</span>
          </p>
        )}
        <p className="mt-2 text-sm text-slate-500">{ft('forge.account.blurb')}</p>
      </div>

      {loading ? (
        <p className="text-slate-500">{ft('forge.account.loading')}</p>
      ) : courses.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">{ft('forge.account.empty')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {courses.map((c) => (
            <div
              key={c.course.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="text-3xl">{c.course.coverEmoji}</div>
              <h2 className="mt-2 font-bold text-slate-900">{c.course.title}</h2>
              <p className="text-sm text-slate-500 mt-1">
                {c.progressPercent}% · {c.status}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/hub/forge/cursos/${c.course.id}`}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-bold text-white"
                >
                  {ft('forge.account.goCourse')}
                </Link>
                <Link
                  href={`/hub/forge/cursos/${c.course.id}/mi-mapa`}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-900"
                >
                  {ft('forge.account.goMap')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <Link
        href="/hub/forge/cursos"
        className="inline-flex items-center gap-1 text-sm text-violet-700 font-semibold hover:underline"
      >
        <GraduationCap className="h-4 w-4" /> {ft('forge.account.explore')}
      </Link>
    </div>
  );
}
