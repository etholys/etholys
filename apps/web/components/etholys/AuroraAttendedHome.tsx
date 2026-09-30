'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';
import {
  auroraBetStatusLabel,
  auroraFlowPhaseLabels,
  type AuroraFlowPhase,
} from '@/lib/aurora-flow';
import { useAuroraAttendedOptional } from '@/components/etholys/AuroraAttendedContext';

type AttendedPayload = {
  companyName: string;
  phase: AuroraFlowPhase;
  radiography: { title: string; body: string; hypothesis: string; validated: boolean };
  gaps: Array<{ text: string }>;
  potentials: Array<{ text: string }>;
  route: Array<{ id: string; title: string; status: string; why: string; indicator: string }>;
  progress: { activitiesDone: number; activitiesOpen: number; activitiesTotal: number; pct: number };
  lastRhythm: { happened: string; blocked: string; nextStep: string; createdAt: string } | null;
};

/** Vista limpa do negócio atendido: radiografia + ruta + avance (sem ferramentas de técnico). */
export function AuroraAttendedHome() {
  const { locale, activeCompanyId } = useApp();
  const search = useSearchParams();
  const attended = useAuroraAttendedOptional();
  const loc = locale === 'es' || locale === 'en' ? locale : 'pt';
  const isSelf = Boolean(attended?.isAttendedViewer);

  const companyId = String(
    search.get('company') || attended?.selection?.companyId || (isSelf ? activeCompanyId : '') || '',
  ).trim();
  const engagementId = String(
    search.get('engagement') || attended?.selection?.engagementId || '',
  ).trim();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AttendedPayload | null>(null);

  const labels = auroraFlowPhaseLabels(loc);
  const copy =
    loc === 'es'
      ? {
          back: 'Cartera',
          title: isSelf ? 'Tu avance' : 'Avance del negocio',
          subtitle: isSelf
            ? 'Solo ves tu radiografía, la ruta acordada y el progreso. El técnico acompaña el resto en AURORA.'
            : 'Lo que el negocio atendido puede ver: radiografía, ruta y avance.',
          need: 'Todavía no hay acompañamiento publicado para este negocio.',
          route: 'Ruta de intervención',
          progress: 'Avance',
          validated: 'Radiografía validada',
          pending: 'Radiografía en revisión',
          empty: 'Cuando el técnico valide el diagnóstico, verás aquí el documento.',
          week: 'Última semana',
          happened: 'Qué pasó',
          blocked: 'Qué traba',
          next: 'Próximo paso',
          open: 'En curso',
          done: 'Hechas',
          emptyRoute: 'Aún no hay actividades en la ruta.',
        }
      : loc === 'en'
        ? {
            back: 'Portfolio',
            title: isSelf ? 'Your progress' : 'Business progress',
            subtitle: isSelf
              ? 'You only see your radiography, agreed route and progress. The technician handles the rest in AURORA.'
              : 'What the attended business can see: radiography, route and progress.',
            need: 'No accompaniment published for this business yet.',
            route: 'Intervention route',
            progress: 'Progress',
            validated: 'Radiography validated',
            pending: 'Radiography under review',
            empty: 'When the technician validates the diagnostic, the document appears here.',
            week: 'Last week',
            happened: 'What happened',
            blocked: 'What is stuck',
            next: 'Next step',
            open: 'Open',
            done: 'Done',
            emptyRoute: 'No route activities yet.',
          }
        : {
            back: 'Carteira',
            title: isSelf ? 'O teu avanço' : 'Avanço do negócio',
            subtitle: isSelf
              ? 'Só vês a radiografia, a rota acordada e o progresso. O técnico acompanha o resto no AURORA.'
              : 'O que o negócio atendido pode ver: radiografia, rota e avanço.',
            need: 'Ainda não há acompanhamento publicado para este negócio.',
            route: 'Rota de intervenção',
            progress: 'Avanço',
            validated: 'Radiografia validada',
            pending: 'Radiografia em revisão',
            empty: 'Quando o técnico validar o diagnóstico, o documento aparece aqui.',
            week: 'Última semana',
            happened: 'O que aconteceu',
            blocked: 'O que trava',
            next: 'Próximo passo',
            open: 'Em curso',
            done: 'Feitas',
            emptyRoute: 'Ainda não há atividades na rota.',
          };

  const load = useCallback(async () => {
    if (!companyId) {
      setLoading(false);
      setErr(copy.need);
      return;
    }
    setLoading(true);
    try {
      const q = new URLSearchParams({ companyId, view: 'attended' });
      if (engagementId) q.set('engagementId', engagementId);
      const r = await fetch(`/api/business-dossier/flow?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha');
      setData(d.attended as AttendedPayload);
      setErr(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, engagementId, copy.need]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || attended?.loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-700" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-10 text-center">
        <p className="text-sm text-amber-950">{err || copy.need}</p>
        {!isSelf ? (
          <Link href="/hub/aurora" className="text-sm font-medium text-amber-900 underline">
            ← {copy.back}
          </Link>
        ) : null}
      </div>
    );
  }

  const open = data.route.filter((b) => b.status !== 'done');
  const done = data.route.filter((b) => b.status === 'done');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        {!isSelf ? (
          <Link href="/hub/aurora" className="text-xs text-slate-500 hover:text-slate-800">
            ← {copy.back}
          </Link>
        ) : null}
        <h1 className="font-serif text-3xl text-slate-900">
          {copy.title}
          {data.companyName ? ` · ${data.companyName}` : ''}
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">{copy.subtitle}</p>
        <p className="text-sm font-medium text-amber-950">
          {labels[data.phase]} · {data.radiography.validated ? copy.validated : copy.pending}
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-serif text-xl text-slate-900">{data.radiography.title || labels.radio}</h2>
        {data.radiography.body ? (
          <pre className="mt-3 whitespace-pre-wrap font-serif text-sm leading-relaxed text-slate-800">
            {data.radiography.body}
          </pre>
        ) : (
          <p className="mt-3 text-sm text-slate-500">{copy.empty}</p>
        )}
        {data.radiography.hypothesis ? (
          <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-950">{data.radiography.hypothesis}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-serif text-xl text-slate-900">{copy.route}</h2>
          <p className="text-sm font-semibold text-slate-900">
            {copy.progress}: {data.progress.pct}%
          </p>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-amber-700 transition-all" style={{ width: `${data.progress.pct}%` }} />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-slate-500">
          <span>
            {copy.open}: {data.progress.activitiesOpen}
          </span>
          <span>
            {copy.done}: {data.progress.activitiesDone}
          </span>
        </div>
        {data.route.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{copy.emptyRoute}</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {[...open, ...done].map((b) => (
              <li
                key={b.id}
                className={`rounded-xl border px-3 py-2 ${
                  b.status === 'done' ? 'border-emerald-100 bg-emerald-50/50' : 'border-slate-100'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-900">{b.title}</p>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {auroraBetStatusLabel(b.status, loc)}
                  </span>
                </div>
                {b.indicator ? <p className="mt-1 text-xs text-amber-900">{b.indicator}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {data.lastRhythm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-serif text-xl text-slate-900">{copy.week}</h2>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            {data.lastRhythm.happened ? (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">{copy.happened}</dt>
                <dd>{data.lastRhythm.happened}</dd>
              </div>
            ) : null}
            {data.lastRhythm.blocked ? (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">{copy.blocked}</dt>
                <dd className="text-rose-800">{data.lastRhythm.blocked}</dd>
              </div>
            ) : null}
            {data.lastRhythm.nextStep ? (
              <div>
                <dt className="text-xs font-semibold uppercase text-slate-400">{copy.next}</dt>
                <dd>{data.lastRhythm.nextStep}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
