'use client';

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/app/providers';
import { forgeT } from '@/lib/forge/i18n';
import type { Locale } from '@/lib/i18n';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';
import { Trophy, Zap, Award } from 'lucide-react';

type Row = {
  rank: number;
  name: string;
  courseTitle: string;
  coverEmoji: string;
  xp: number;
  level: number;
  badges: unknown;
  isYou: boolean;
};

function parseBadges(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((b): b is string => typeof b === 'string');
}

function badgeLabel(id: string, locale: Locale) {
  const key = `forge.badge.${id}`;
  const t = forgeT(key, locale);
  return t === key ? id : t;
}

export default function ForgeGamificacaoPage() {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const { activeCompanyId } = useApp();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [leaderboard, setLeaderboard] = useState<Row[]>([]);

  useEffect(() => {
    const q = activeCompanyId ? `?companyId=${encodeURIComponent(activeCompanyId)}` : '';
    fetch(`/api/forge/overview${q}`)
      .then((r) => r.json())
      .then((d) => setStats(d.stats ?? null));
    fetch(`/api/forge/leaderboard${q}`)
      .then((r) => r.json())
      .then((d) => setLeaderboard(d.leaderboard ?? []));
  }, [activeCompanyId]);

  const myBadges = useMemo(() => {
    const me = leaderboard.find((r) => r.isYou);
    return me ? parseBadges(me.badges) : [];
  }, [leaderboard]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-slate-900">
          <Trophy className="h-7 w-7 text-amber-500" />
          {ft('forge.gamification.title')}
        </h1>
        <p className="mt-1 text-sm text-slate-500">{ft('forge.gamification.subtitle')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: ft('forge.gamification.stat.published'), key: 'publishedCourses' },
          { label: ft('forge.gamification.stat.enrollments'), key: 'activeEnrollments' },
          { label: ft('forge.gamification.stat.games'), key: 'completedGameSessions' },
          { label: ft('forge.gamification.stat.completed'), key: 'completedEnrollments' },
        ].map((item) => (
          <div key={item.key} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">{item.label}</p>
            <p className="mt-1 text-2xl font-black">{stats?.[item.key] ?? '—'}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border bg-white p-4">
        <h2 className="flex items-center gap-2 font-bold text-slate-800">
          <Award className="h-5 w-5 text-violet-600" />
          {ft('forge.gamification.myBadges')}
        </h2>
        {myBadges.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{ft('forge.gamification.noBadges')}</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {myBadges.map((id) => (
              <span
                key={id}
                className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-900"
              >
                {badgeLabel(id, locale)}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 font-bold text-slate-800">{ft('forge.gamification.ranking')}</div>
        <ul className="divide-y">
          {leaderboard.map((row) => {
            const badges = parseBadges(row.badges);
            return (
              <li
                key={`${row.rank}-${row.name}-${row.courseTitle}`}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 text-sm ${row.isYou ? 'bg-violet-50' : ''}`}
              >
                <span className="w-6 font-bold text-slate-400">#{row.rank}</span>
                <span>{row.coverEmoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {row.name}
                    {row.isYou ? ` ${ft('forge.gamification.you')}` : ''}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{row.courseTitle}</p>
                  {badges.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {badges.map((id) => (
                        <span
                          key={id}
                          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
                        >
                          {badgeLabel(id, locale)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="flex items-center gap-1 font-bold text-amber-700">
                  <Zap className="h-3.5 w-3.5" />
                  {row.xp}
                </span>
                <span className="text-xs text-slate-400">Nv.{row.level}</span>
              </li>
            );
          })}
        </ul>
        {leaderboard.length === 0 && (
          <p className="p-6 text-sm text-slate-500 text-center">{ft('forge.gamification.empty')}</p>
        )}
      </section>
    </div>
  );
}
