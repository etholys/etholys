'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Layers, Sparkles, Wrench } from 'lucide-react';
import { PROGRAM_MODE_LABELS } from '@/lib/nexus-incubation-program';
import type { IncubationProgress, IncubationRun } from '@/lib/nexus-incubation-run';

type Locale = 'es' | 'pt' | 'en';

type Props = {
  companyId: string | null;
  networkId?: string | null;
  locale: Locale;
  compact?: boolean;
  engagementId?: string | null;
};

export function NexusIncubationProcessPanel({
  companyId,
  networkId,
  locale,
  compact = false,
  engagementId,
}: Props) {
  const es = locale === 'es';
  const [run, setRun] = useState<IncubationRun | null>(null);
  const [progress, setProgress] = useState<IncubationProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [toolName, setToolName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!companyId && !networkId) {
      setRun(null);
      setProgress(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (networkId) qs.set('networkId', networkId);
      if (companyId) qs.set('companyId', companyId);
      const r = await fetch(`/api/nexus/incubation/run?${qs}`, { cache: 'no-store' });
      const d = await r.json();
      if (r.ok) {
        setRun(d.run || null);
        setProgress(d.progress || null);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [companyId, networkId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addTool = async () => {
    const name = toolName.trim();
    if (!name || !companyId) return;
    setSaving(true);
    try {
      await fetch('/api/nexus/incubation/run', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          networkId,
          action: 'add_tool',
          tool: { name, category: 'other' },
        }),
      });
      setToolName('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        {es ? 'A carregar processo de incubação…' : 'A carregar processo de incubação…'}
      </div>
    );
  }

  if (!run?.committedAt && !run?.diagnosis) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-4">
        <p className="text-sm font-medium text-slate-800">
          {es ? 'Processo de consultoria / incubação' : 'Processo de consultoria / incubação'}
        </p>
        <p className="mt-1 text-xs text-slate-600">
          {es
            ? 'Ainda não há diagnóstico nem plano registado. Comece pelo questionário sectorial.'
            : 'Ainda não há diagnóstico nem plano registado. Comece pelo questionário sectorial.'}
        </p>
        <Link
          href={
            companyId
              ? `/hub/nexus/diagnosis?company=${encodeURIComponent(companyId)}${engagementId ? `&engagement=${encodeURIComponent(engagementId)}` : ''}${networkId ? `&network=${encodeURIComponent(networkId)}` : ''}`
              : '/hub/nexus/diagnosis'
          }
          className="mt-3 inline-flex items-center gap-1 rounded-lg bg-teal-800 px-3 py-1.5 text-xs font-medium text-white"
        >
          {es ? 'Iniciar diagnóstico' : 'Iniciar diagnóstico'}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  const modeLabel = PROGRAM_MODE_LABELS[run.program.mode][locale];
  const dx = run.diagnosis;
  const currentLayer = run.layers[progress?.currentLayerIndex ?? run.currentLayerIndex];

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {es ? 'Processo AT / incubação' : 'Processo AT / incubação'}
          </p>
          <p className="text-sm font-semibold text-slate-900">{modeLabel}</p>
          <p className="text-xs text-slate-600">
            {run.program.totalHours}h · {run.program.durationMonths}{' '}
            {es ? 'meses' : 'meses'}
            {dx ? ` · ${dx.sectorName} ${dx.overall}/100` : ''}
          </p>
        </div>
        {progress && (
          <div className="text-right">
            <p className="text-2xl font-bold text-teal-800">{progress.overallPct}%</p>
            <p className="text-[10px] uppercase text-slate-500">{es ? 'Execução' : 'Execução'}</p>
          </div>
        )}
      </div>

      {progress && progress.tasksTotal > 0 && (
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-slate-600">
            <span>
              {progress.tasksDone}/{progress.tasksTotal} {es ? 'atividades' : 'atividades'}
            </span>
            <span>
              {progress.hoursDone}h / {progress.hoursPlanned}h
            </span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progress.overallPct}%` }} />
          </div>
        </div>
      )}

      {currentLayer && (
        <div className="rounded-lg border border-teal-100 bg-teal-50/50 px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-900">
            <Layers className="h-3.5 w-3.5" />
            {currentLayer.title}
          </p>
          <p className="mt-0.5 text-[11px] text-teal-800">{currentLayer.goals.join(' · ')}</p>
        </div>
      )}

      {!compact && run.layers.length > 0 && progress && (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {progress.layers.map((l) => (
            <div key={l.index} className="rounded-md border border-slate-100 px-2 py-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="font-medium text-slate-700">{l.title}</span>
                <span className="text-slate-500">{l.pct}%</span>
              </div>
              <span className="text-slate-400">{l.done}/{l.total}</span>
            </div>
          ))}
        </div>
      )}

      {dx && !compact && (
        <div className="grid gap-2 sm:grid-cols-3 text-[11px]">
          <MiniList title={es ? 'Fortalezas' : 'Fortalezas'} items={dx.strengths.slice(0, 4)} tone="emerald" />
          <MiniList title={es ? 'Debilidades' : 'Debilidades'} items={dx.weaknesses.slice(0, 4)} tone="rose" />
          <MiniList title={es ? 'Potenciais' : 'Potenciais'} items={dx.potentials.slice(0, 4)} tone="amber" />
        </div>
      )}

      {run.strategicPlan && !compact && (
        <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-3 py-2 text-xs text-indigo-950">
          <p className="flex items-center gap-1 font-semibold">
            <Sparkles className="h-3.5 w-3.5" />
            {es ? 'Plano estratégico' : 'Plano estratégico'} · {run.strategicPlan.horizon}
          </p>
          <p className="mt-1">{run.strategicPlan.vision}</p>
        </div>
      )}

      {run.advances.length > 0 && !compact && (
        <div>
          <p className="text-[11px] font-medium uppercase text-slate-500">{es ? 'Avances recentes' : 'Avanços recentes'}</p>
          <ul className="mt-1 max-h-24 space-y-1 overflow-y-auto text-[11px] text-slate-600">
            {run.advances.slice(0, 6).map((a, i) => (
              <li key={i}>
                {a.at.slice(0, 10)} — {a.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {run.toolsImplemented.length > 0 && (
        <div>
          <p className="flex items-center gap-1 text-[11px] font-medium uppercase text-slate-500">
            <Wrench className="h-3 w-3" />
            {es ? 'Ferramentas / práticas implementadas' : 'Ferramentas / práticas implementadas'}
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {run.toolsImplemented.slice(0, 8).map((t) => (
              <li key={t.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                {t.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!compact && (
        <div className="flex flex-wrap gap-2 pt-1">
          <input
            value={toolName}
            onChange={(e) => setToolName(e.target.value)}
            placeholder={es ? 'Registar ferramenta implementada…' : 'Registar ferramenta implementada…'}
            className="min-w-[160px] flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
          />
          <button
            type="button"
            disabled={saving || toolName.trim().length < 3}
            onClick={() => void addTool()}
            className="rounded-md bg-slate-800 px-2.5 py-1 text-xs text-white disabled:opacity-40"
          >
            {es ? 'Registar' : 'Registar'}
          </button>
          <Link href="/hub/nexus/roadmap" className="rounded-md border px-2.5 py-1 text-xs text-slate-700">
            {es ? 'Rota viva' : 'Rota viva'}
          </Link>
        </div>
      )}
    </div>
  );
}

function MiniList({ title, items, tone }: { title: string; items: string[]; tone: 'emerald' | 'rose' | 'amber' }) {
  const border =
    tone === 'emerald' ? 'border-emerald-100' : tone === 'rose' ? 'border-rose-100' : 'border-amber-100';
  return (
    <div className={`rounded-md border ${border} p-2`}>
      <p className="font-semibold text-slate-700">{title}</p>
      <ul className="mt-1 space-y-0.5 text-slate-600">
        {items.length === 0 ? (
          <li>—</li>
        ) : (
          items.map((x, i) => (
            <li key={i} className="truncate">
              · {x}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
