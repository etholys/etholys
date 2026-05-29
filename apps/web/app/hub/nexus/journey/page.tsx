'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import type { VentureStageId } from '@/lib/nexus-venture';
import { VENTURE_STAGE_ORDER, internationalReadinessScore, stageLabel, stageSummary } from '@/lib/nexus-venture';
import { touchRunwayChapter } from '@/lib/nexus-runway';
import { ArrowRight, ListChecks, Loader2 } from 'lucide-react';

type VentureApi = {
  scope: 'company' | 'network';
  stage: VentureStageId;
  targetRegions: string;
  checklist: Record<string, boolean>;
  incubatorNotes: string;
  internationalScore: number;
  stages: Array<{ id: VentureStageId; labelPt: string; labelEs: string; labelEn: string }>;
  intlItems: Array<{ id: string; labelPt: string; labelEs: string; labelEn: string; weight: number }>;
};

type OverviewLite = {
  metrics: {
    pendingRoadmapActions: number;
    completedRoadmapActions: number;
    openServiceTickets: number;
  };
};

function labelFor(locale: string, item: { labelPt: string; labelEs: string; labelEn: string }) {
  if (locale === 'es') return item.labelEs;
  if (locale === 'pt') return item.labelPt;
  return item.labelEn;
}

function NexusJourneyInner() {
  const { locale, activeCompanyId } = useApp();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');

  const withNet = (href: string) =>
    networkId ? `${href.split('?')[0]}?network=${encodeURIComponent(networkId)}` : href;

  const ventureQs = useMemo(() => {
    if (networkId) return `networkId=${encodeURIComponent(networkId)}`;
    if (activeCompanyId) return `companyId=${encodeURIComponent(activeCompanyId)}`;
    return '';
  }, [networkId, activeCompanyId]);

  const overviewQs = useMemo(() => {
    if (networkId) return `networkId=${encodeURIComponent(networkId)}`;
    if (activeCompanyId) return `companyId=${encodeURIComponent(activeCompanyId)}`;
    return '';
  }, [networkId, activeCompanyId]);

  const [venture, setVenture] = useState<VentureApi | null>(null);
  const [overview, setOverview] = useState<OverviewLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [deriveMsg, setDeriveMsg] = useState<string | null>(null);
  const [deriving, setDeriving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (opts?: { background?: boolean }) => {
    if (!opts?.background) {
      setLoading(true);
      setMsg(null);
    }
    try {
      const [rv, ro] = await Promise.all([
        fetch(`/api/nexus/venture?${ventureQs}`, { cache: 'no-store' }).then((r) => r.json()),
        fetch(`/api/nexus/overview?${overviewQs}`, { cache: 'no-store' }).then((r) => r.json()),
      ]);
      if (!rv.error) setVenture(rv as VentureApi);
      if (!ro.error && ro.metrics) setOverview({ metrics: ro.metrics });
      if (!opts?.background) setMsg(null);
    } catch {
      if (!opts?.background) setMsg('Erro ao carregar dados.');
    } finally {
      if (!opts?.background) setLoading(false);
    }
  }, [ventureQs, overviewQs]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    touchRunwayChapter('journey');
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void load({ background: true });
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [load]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const patchVenture = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const payload = {
          ...body,
          ...(networkId ? { networkId } : { companyId: activeCompanyId || undefined }),
        };
        const r = await fetch('/api/nexus/venture', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao gravar');
        if (typeof d.internationalScore === 'number' && venture) {
          setVenture((v) => (v ? { ...v, internationalScore: d.internationalScore } : v));
        }
      } catch (e) {
        setMsg(e instanceof Error ? e.message : 'Erro ao gravar');
      } finally {
        setSaving(false);
      }
    },
    [networkId, activeCompanyId, venture]
  );

  const schedulePatch = useCallback(
    (body: Record<string, unknown>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void patchVenture(body);
      }, 450);
    },
    [patchVenture]
  );

  const setStage = (stage: VentureStageId) => {
    setVenture((v) => (v ? { ...v, stage } : v));
    void patchVenture({ stage });
  };

  const deriveRoadmapFromJourney = useCallback(async () => {
    setDeriving(true);
    setDeriveMsg(null);
    try {
      const r = await fetch('/api/nexus/journey/derive-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(networkId ? { networkId } : { companyId: activeCompanyId || undefined }),
          locale,
          includeIntlGaps: true,
          maxIntlGaps: 3,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Falha ao gerar tarefas');
      const n = d.counts?.created ?? 0;
      const sk = d.counts?.skipped ?? 0;
      setDeriveMsg(
        locale === 'es'
          ? `Listo: ${n} tarea(s) nuevas en la ruta (${sk} ya existían).`
          : locale === 'pt'
            ? `Pronto: ${n} nova(s) tarefa(s) na rota (${sk} já existiam).`
            : `Done: ${n} new roadmap task(s) (${sk} already existed).`
      );
      await load();
    } catch (e) {
      setDeriveMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDeriving(false);
    }
  }, [networkId, activeCompanyId, locale, load]);

  const toggleIntl = (id: string, checked: boolean) => {
    setVenture((v) => {
      if (!v) return v;
      const checklist = { ...v.checklist, [id]: checked };
      const internationalScore = internationalReadinessScore(checklist);
      schedulePatch({ checklist: { [id]: checked } });
      return { ...v, checklist, internationalScore };
    });
  };

  const nextSteps = useMemo(() => {
    const w = (path: string) =>
      networkId ? `${path}?network=${encodeURIComponent(networkId)}` : path;
    const steps: { text: string; href: string; priority: 'high' | 'med' }[] = [];
    steps.push({
      text:
        locale === 'es'
          ? 'Sincronizar la ruta viva con la fase actual (generar tareas desde la jornada).'
          : locale === 'pt'
            ? 'Sincronizar a rota viva com a fase atual (gerar tarefas a partir da jornada).'
            : 'Sync live roadmap with the current journey phase (generate tasks).',
      href: '#derive-roadmap',
      priority: 'high',
    });
    const m = overview?.metrics;
    if (m && m.pendingRoadmapActions < 2) {
      steps.push({
        text:
          locale === 'es'
            ? 'Defina más acciones en la ruta viva (mínimo 2 en curso).'
            : locale === 'pt'
              ? 'Defina mais acções na rota viva (mínimo 2 em curso).'
              : 'Add more live roadmap actions (at least 2 in progress).',
        href: w('/hub/nexus/roadmap'),
        priority: 'high',
      });
    }
    if (m && m.openServiceTickets < 1) {
      steps.push({
        text:
          locale === 'es'
            ? 'Abra un ticket de servicio para acelerar ejecución con el equipo Etholys.'
            : locale === 'pt'
              ? 'Abra um ticket de serviço para acelerar a execução com a equipe Etholys.'
              : 'Open a service ticket to speed execution with Etholys.',
        href: w('/hub/nexus/services'),
        priority: 'med',
      });
    }
    steps.push({
      text:
        locale === 'es'
          ? 'Complete el cuestionario por sectores para alinear prioridades.'
            : locale === 'pt'
            ? 'Complete o questionário por setores para alinhar prioridades.'
            : 'Complete the sector questionnaire to align priorities.',
      href: w('/hub/nexus/diagnosis'),
      priority: 'high',
    });
    if (venture && venture.stage === 'SCALE_GLOBAL' && venture.internationalScore < 60) {
      steps.push({
        text:
          locale === 'es'
            ? 'Complete la lista de preparación internacional abajo.'
            : locale === 'pt'
              ? 'Complete a lista de prontidão internacional abaixo.'
              : 'Complete the international readiness checklist below.',
        href: '#international',
        priority: 'high',
      });
    }
    return steps;
  }, [overview, venture, locale, networkId]);

  if (loading || !venture) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600" />
      </div>
    );
  }

  const t = {
    h1: locale === 'es' ? 'Fase, mercados y prontidão' : locale === 'pt' ? 'Fase, mercados e prontidão' : 'Phase, markets & readiness',
    h1sub:
      locale === 'es'
        ? 'Ajusta la fase a tu realidad. El acompañamiento es un flujo, no cinco cajas sueltas: la conversación con el copiloto es clave para el plan.'
        : locale === 'pt'
          ? 'Ajusta a fase à tua realidade. O acompanhamento é um fluxo, não cinco módulos: falar com o copiloto é o que puxa o plano e a marca em conjunto.'
          : 'Set the phase to match your reality. Support is a flow, not five boxes: the co-pilot conversation drives the plan.',
    copilot:
      locale === 'es'
        ? { title: 'Hablá con el copiloto', sub: 'La forma más clara de avanzar: preguntan, pegen texto, pida prioridades.', cta: 'Abrir el copiloto' }
        : locale === 'pt'
          ? { title: 'Fala com o copiloto', sub: 'A forma mais simples de avançar: perguntar, colar notas, pedir prioridades.', cta: 'Abrir o copiloto' }
          : { title: 'Talk to the co-pilot', sub: 'The clearest way to move forward: ask, paste notes, get priorities.', cta: 'Open co-pilot' },
    fase: locale === 'es' ? 'Dónde está el negocio hoy' : locale === 'pt' ? 'Onde o negócio está hoje' : 'Where the business is today',
    faseHelo:
      locale === 'es' ? 'Una fase, descripción bajo al elegir' : locale === 'pt' ? 'Uma fase de cada vez; a descrição muda com a opção' : 'One phase; description updates when you pick',
    markets: locale === 'es' ? 'Mercados' : locale === 'pt' ? 'Mercados' : 'Markets',
    more: locale === 'es' ? 'Más acciones' : locale === 'pt' ? 'Mais ações' : 'More actions',
  };

  return (
    <div className="max-w-2xl space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.h1}</h1>
        <p className="text-sm text-slate-600">{t.h1sub}</p>
        {saving && <p className="text-xs text-violet-600">{locale === 'pt' ? 'A gravar…' : locale === 'es' ? 'Guardando…' : 'Saving…'}</p>}
      </header>

      <Link
        href={withNet('/hub/nexus/coach')}
        className="block rounded-2xl border-2 border-violet-200 bg-violet-600 p-4 text-white shadow-md transition hover:bg-violet-700"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-violet-200">{t.copilot.title}</p>
        <p className="mt-1 text-sm text-violet-100">{t.copilot.sub}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-sm font-semibold">
          {t.copilot.cta} <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-medium text-slate-800" htmlFor="nexus-stage-select">
          {t.fase}
        </label>
        <p className="text-xs text-slate-500">{t.faseHelo}</p>
        <select
          id="nexus-stage-select"
          className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50/80 py-2.5 pl-3 pr-8 text-sm font-medium text-slate-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
          value={venture.stage}
          onChange={(e) => setStage(e.target.value as VentureStageId)}
        >
          {VENTURE_STAGE_ORDER.map((id) => (
            <option key={id} value={id}>
              {stageLabel(id, locale)} — {stageSummary(id, locale).slice(0, 80)}
              {stageSummary(id, locale).length > 80 ? '…' : ''}
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-slate-600">{stageSummary(venture.stage, locale)}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="text-sm font-medium text-slate-800" htmlFor="regions-ta">
          {t.markets}
        </label>
        <textarea
          id="regions-ta"
          className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={2}
          placeholder={locale === 'en' ? 'e.g. EU, Mercosur, city focus…' : ''}
          value={venture.targetRegions}
          onChange={(e) => {
            const targetRegions = e.target.value;
            setVenture((v) => (v ? { ...v, targetRegions } : v));
            schedulePatch({ targetRegions });
          }}
        />
      </div>

      <details className="group rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800 after:content-['']">
          <span className="inline-flex w-full items-center justify-between">
            {t.more}
            <span className="text-slate-400 group-open:rotate-180">▼</span>
          </span>
        </summary>
        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
          <div id="derive-roadmap" className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              {locale === 'es' ? 'Generar tareas en la ruta según fase' : locale === 'pt' ? 'Gerar tarefas na rota a partir da fase' : 'Generate roadmap tasks from phase'}
            </p>
            <button
              type="button"
              disabled={deriving}
              onClick={() => void deriveRoadmapFromJourney()}
              className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {deriving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
              {locale === 'es' ? 'Generar' : locale === 'pt' ? 'Gerar' : 'Generate'}
            </button>
          </div>
          {deriveMsg && <p className="text-xs text-violet-800">{deriveMsg}</p>}
          <ul className="space-y-1.5 text-sm">
            {nextSteps.map((s, i) => (
              <li key={i}>
                <Link href={s.href} className="text-violet-700 hover:underline">
                  → {s.text}
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">
            {locale === 'es' ? 'Enlace rápido: ' : locale === 'pt' ? 'Ligação rápida: ' : 'Quick: '}
            <Link className="text-violet-700 underline" href={withNet('/hub/nexus/diagnosis')}>
              Diagnóstico
            </Link>
            {' · '}
            <Link className="text-violet-700 underline" href={withNet('/hub/nexus/roadmap')}>
              {locale === 'en' ? 'Roadmap' : 'Rota'}
            </Link>
            {' · '}
            <Link className="text-violet-700 underline" href={withNet('/hub/nexus/services')}>
              {locale === 'en' ? 'Support' : 'Apoio'}
            </Link>
          </p>
        </div>
      </details>

      <details id="international" className="rounded-xl border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer list-none text-sm font-semibold text-slate-800">
          <span className="inline-flex w-full items-center justify-between">
            {locale === 'es' ? 'Listo internacional' : locale === 'pt' ? 'Prontidão internacional' : 'International readiness'}
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-900">
              {venture.internationalScore}%
            </span>
          </span>
        </summary>
        <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
          {venture.intlItems.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600"
                checked={Boolean(venture.checklist[item.id])}
                onChange={(e) => toggleIntl(item.id, e.target.checked)}
              />
              <span className="text-slate-700">{labelFor(locale, item)}</span>
            </li>
          ))}
        </ul>
      </details>

      <div>
        <label className="text-sm font-medium text-slate-800" htmlFor="notes-ta">
          {locale === 'es' ? 'Notas' : locale === 'pt' ? 'Notas' : 'Notes'}
        </label>
        <textarea
          id="notes-ta"
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={3}
          value={venture.incubatorNotes}
          onChange={(e) => {
            const incubatorNotes = e.target.value;
            setVenture((v) => (v ? { ...v, incubatorNotes } : v));
            schedulePatch({ incubatorNotes });
          }}
        />
      </div>

      {msg && <p className="text-sm text-red-600">{msg}</p>}
    </div>
  );
}

export default function NexusJourneyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500/30 border-t-violet-600" />
        </div>
      }
    >
      <NexusJourneyInner />
    </Suspense>
  );
}
