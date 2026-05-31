'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, BarChart3, Download, User } from 'lucide-react';
import { ForgeInviteLearners } from '@/components/forge/ForgeInviteLearners';
import { ForgeBulkInvite } from '@/components/forge/ForgeBulkInvite';
import { ForgeLibroUpload } from '@/components/forge/ForgeLibroUpload';
import { ForgeAssignFacilitator } from '@/components/forge/ForgeAssignFacilitator';
import { useForgeLocale, useForgeT } from '@/lib/forge/use-forge-t';

type LearnerRow = {
  userId: string;
  name: string | null;
  email: string | null;
  progressPercent: number;
  xp: number;
  level: number;
  stationsCompleted: number;
  stationTotal: number;
  isFacilitator?: boolean;
  isSelf?: boolean;
  board?: { position?: number; ecoCredits?: number; insightsCount?: number };
};

export default function ForgeAlumnosPage() {
  const ft = useForgeT();
  const locale = useForgeLocale();
  const { id: courseId } = useParams<{ id: string }>();
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [libroName, setLibroName] = useState<string | null>(null);
  const [hasLibro, setHasLibro] = useState(false);
  const [libroOcrStatus, setLibroOcrStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}/libro`)
      .then((r) => r.json())
      .then((d) => {
        setHasLibro(Boolean(d.hasLibro));
        setLibroName(d.fileName ?? null);
        setLibroOcrStatus(d.libroOcrStatus ?? null);
      })
      .catch(() => {});
  }, [courseId]);

  useEffect(() => {
    fetch(`/api/forge/courses/${courseId}/learners`)
      .then((r) => r.json())
      .then((d) => setLearners(d.learners ?? []))
      .finally(() => setLoading(false));
  }, [courseId]);

  return (
    <div className="space-y-6">
      <Link
        href={`/hub/forge/cursos/${courseId}`}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> {ft('forge.alumnos.back')}
      </Link>
      <div className="grid gap-4 lg:grid-cols-2">
        <ForgeInviteLearners courseId={courseId} />
        <ForgeBulkInvite courseId={courseId} />
      </div>
      <ForgeLibroUpload
        courseId={courseId}
        hasLibro={hasLibro}
        fileName={libroName}
        ocrStatus={libroOcrStatus}
        onDone={() => {
          fetch(`/api/forge/courses/${courseId}/libro`)
            .then((r) => r.json())
            .then((d) => {
              setHasLibro(Boolean(d.hasLibro));
              setLibroName(d.fileName ?? null);
            });
        }}
      />
      <ForgeAssignFacilitator courseId={courseId} />

      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        {ft('forge.alumnos.rolesHint')}{' '}
        <Link href={`/hub/forge/cursos/${courseId}?preview=learner`} className="font-bold underline">
          {ft('forge.facilitator.preview')}
        </Link>
        {' · '}
        <Link href={`/hub/forge/cursos/${courseId}/sala`} className="font-bold underline">
          {ft('forge.room.enter')}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">{ft('forge.alumnos.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{ft('forge.alumnos.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/hub/forge/cursos/${courseId}/analytics`}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white hover:bg-violet-800"
          >
            <BarChart3 className="h-4 w-4" />
            {ft('forge.facilitator.analytics')}
          </Link>
          <button
            type="button"
            onClick={async () => {
              const res = await fetch(`/api/forge/courses/${courseId}/notify-learners`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: 'inactive', locale }),
              });
              const d = await res.json();
              alert(
                res.ok
                  ? ft('forge.alumnos.remindOk', { n: d.summary?.inactiveNotified ?? 0 })
                  : d.error || ft('forge.general.error')
              );
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            {ft('forge.alumnos.remindInactive')}
          </button>
          <a
            href={`/api/forge/courses/${courseId}/learners/export`}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            {ft('forge.alumnos.export')}
          </a>
        </div>
      </div>

      {loading ? (
        <p className="text-slate-500">{ft('forge.alumnos.loading')}</p>
      ) : learners.length === 0 ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">{ft('forge.alumnos.empty')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">{ft('forge.alumnos.col.learner')}</th>
                <th className="px-4 py-3">{ft('forge.alumnos.col.progress')}</th>
                <th className="px-4 py-3">{ft('forge.alumnos.col.stations')}</th>
                <th className="px-4 py-3">{ft('forge.alumnos.col.board')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.userId} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900 flex items-center gap-2 flex-wrap">
                      <User className="h-4 w-4 text-slate-400" />
                      {l.name ?? ft('forge.alumnos.noName')}
                      {l.isFacilitator && (
                        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-800">
                          {ft('forge.alumnos.badgeFacilitator')}
                        </span>
                      )}
                      {l.isSelf && (
                        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                          {ft('forge.alumnos.badgeSelf')}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">{l.email}</p>
                  </td>
                  <td className="px-4 py-3">{l.progressPercent}% · {l.xp} XP</td>
                  <td className="px-4 py-3">
                    {l.stationsCompleted}/{l.stationTotal}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {l.board
                      ? ft('forge.alumnos.boardSummary', {
                          pos: l.board.position ?? 0,
                          eco: l.board.ecoCredits ?? 0,
                          cards: l.board.insightsCount ?? 0,
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/hub/forge/cursos/${courseId}/alumnos/${l.userId}`}
                      className="text-violet-700 font-semibold hover:underline"
                    >
                      {ft('forge.alumnos.viewDossier')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
