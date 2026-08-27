'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useApp } from '@/app/providers';
import { groupSectorsForSelect } from '@/components/nexus/NexusAtSectorPlaybook';
import {
  answersPayloadForAnalyze,
  listDiagnosticQuestions,
  optionLabel,
  questionLabel,
  sectionLabel,
  type DxCustomQuestion,
  type DxLocale,
  type DxQuestion,
} from '@/lib/nexus-sector-diagnostic';
import { appendDiagnosisSnapshot } from '@/lib/nexus-diagnosis-history';
import { listSectorGroups, listSectorCatalog } from '@/lib/nexus-economic-sectors';
import type { DiagnosticAnalyzeResult, DiagnosticExtensionQuestion } from '@/lib/nexus-diagnostic-analyze';
import { diagnosisFromAnalyze } from '@/lib/nexus-incubation-run';
import {
  defaultIncubationProgram,
  depthFromProgram,
  expectedQuestionCount,
  normalizeProgram,
  PROGRAM_MODE_LABELS,
  type DiagnosticDepth,
  type IncubationProgram,
  type IncubationProgramMode,
} from '@/lib/nexus-incubation-program';
import type { DevelopmentLayer, StrategicPlanOutline, WorkPlanItem } from '@/lib/nexus-incubation-workplan';
import { kindLabel } from '@/lib/nexus-incubation-run';
import { VENTURE_STAGES } from '@/lib/nexus-venture';

type Phase = 'program' | 'sector' | 'base' | 'analyzing' | 'extension' | 'map' | 'workplan' | 'summary';

const STORAGE_KEY = 'nexus-sector-dx-v3';

function locFromApp(locale: string): DxLocale {
  if (locale === 'pt' || locale === 'en') return locale;
  return 'es';
}

export function NexusSectorDiagnosticWizard() {
  const { locale: appLocale, activeCompanyId } = useApp();
  const loc = locFromApp(appLocale);
  const es = loc === 'es';
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const companyParam = searchParams.get('company');
  const engagementParam = searchParams.get('engagement');
  const atProjectParam = searchParams.get('atProject');

  const targetCompanyId = companyParam || activeCompanyId || '';

  type AtEngagementLite = {
    id: string;
    title: string;
    projects: Array<{ id: string; name: string; siepProjectId?: string | null }>;
  };
  const [atEngagements, setAtEngagements] = useState<AtEngagementLite[]>([]);
  const [commitResult, setCommitResult] = useState<{ engagementId?: string | null; atCaseIds?: string[] } | null>(null);

  const [phase, setPhase] = useState<Phase>('program');
  const [program, setProgram] = useState<IncubationProgram>(() =>
    normalizeProgram({
      ...defaultIncubationProgram(),
      atEngagementId: engagementParam || undefined,
      atProjectId: atProjectParam || undefined,
    })
  );
  const [sectorId, setSectorId] = useState('');
  const [baseIdx, setBaseIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customQuestions, setCustomQuestions] = useState<DxCustomQuestion[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [extensionQuestions, setExtensionQuestions] = useState<DiagnosticExtensionQuestion[]>([]);
  const [extensionAnswers, setExtensionAnswers] = useState<Record<string, string>>({});
  const [extensionIdx, setExtensionIdx] = useState(0);
  const [analyze, setAnalyze] = useState<DiagnosticAnalyzeResult | null>(null);
  const [layers, setLayers] = useState<DevelopmentLayer[]>([]);
  const [planItems, setPlanItems] = useState<WorkPlanItem[]>([]);
  const [strategicPlan, setStrategicPlan] = useState<StrategicPlanOutline | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [newCustomQ, setNewCustomQ] = useState('');

  const sectorGroups = useMemo(() => groupSectorsForSelect(listSectorCatalog(), listSectorGroups(), loc), [loc]);
  const depth = useMemo(() => depthFromProgram(program), [program]);
  const qExpect = useMemo(() => expectedQuestionCount(depth), [depth]);

  const scoredQuestions = useMemo(
    () => (sectorId ? listDiagnosticQuestions(sectorId, program) : []),
    [sectorId, program]
  );

  const customAsQuestions: DxQuestion[] = useMemo(
    () =>
      customQuestions.map((cq) => ({
        id: cq.id,
        sectorId: 'custom' as const,
        source: 'custom' as const,
        section: 'custom' as const,
        prompt: { es: cq.prompt, pt: cq.prompt, en: cq.prompt },
        options: [],
        weight: 0,
      })),
    [customQuestions]
  );

  const allSteps = useMemo(() => [...scoredQuestions, ...customAsQuestions], [scoredQuestions, customAsQuestions]);
  const current = allSteps[baseIdx] || null;
  const progressPct = allSteps.length ? Math.round(((baseIdx + 1) / allSteps.length) * 100) : 0;

  const withNet = (href: string) => {
    if (!networkId) return href;
    return `${href}${href.includes('?') ? '&' : '?'}network=${encodeURIComponent(networkId)}`;
  };

  useEffect(() => {
    setProgram((p) => ({
      ...p,
      totalHours: p.durationMonths * p.hoursPerMonth,
      strategicHorizon: p.mode === 'graduate' && p.strategicHorizon === 'none' ? '12m' : p.strategicHorizon,
    }));
  }, [program.durationMonths, program.hoursPerMonth, program.mode]);

  useEffect(() => {
    if (!targetCompanyId) return;
    fetch(`/api/nexus/at/client-companies?q=&take=50`)
      .then((r) => r.json())
      .then((d) => {
        const mine = (d.companies || []).find((c: { id: string; sectorId?: string }) => c.id === targetCompanyId);
        if (mine?.sectorId && !sectorId) setSectorId(mine.sectorId);
      })
      .catch(() => {});
  }, [targetCompanyId, sectorId]);

  useEffect(() => {
    fetch('/api/nexus/at/engagements')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.engagements)) {
          setAtEngagements(
            d.engagements.map(
              (e: {
                id: string;
                title: string;
                projects?: Array<{ id: string; name: string; siepProjectId?: string | null; siepProject?: { id: string } | null }>;
              }) => ({
                id: e.id,
                title: e.title,
                projects: (e.projects || []).map((p) => ({
                  id: p.id,
                  name: p.name,
                  siepProjectId: p.siepProjectId || p.siepProject?.id || null,
                })),
              })
            )
          );
        }
      })
      .catch(() => {});
  }, []);

  const selectedEngagement = useMemo(
    () => atEngagements.find((e) => e.id === program.atEngagementId),
    [atEngagements, program.atEngagementId]
  );

  const loadWorkPlan = useCallback(async () => {
    const r = await fetch('/api/nexus/diagnostic/workplan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectorId, program, answerIds: answers, locale: loc }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Plano falhou');
    setLayers(d.layers || []);
    setPlanItems(d.items || []);
    setStrategicPlan(d.strategicPlan || null);
    setSelectedIds(new Set((d.items || []).slice(0, 12).map((x: WorkPlanItem) => x.id)));
  }, [sectorId, program, answers, loc]);

  const runAnalyze = useCallback(
    async (finalize: boolean) => {
      setErr(null);
      setPhase('analyzing');
      try {
        const payload = answersPayloadForAnalyze(sectorId, scoredQuestions, answers, customQuestions, customAnswers, loc);
        for (const eq of extensionQuestions) {
          const ans = extensionAnswers[eq.id]?.trim();
          if (ans) payload.push({ id: eq.id, question: eq.prompt, answer: ans });
        }
        const r = await fetch('/api/nexus/diagnostic/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sectorId,
            locale: loc,
            answers: payload,
            answerIds: answers,
            program,
            finalize,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Análise falhou');
        setAnalyze(d as DiagnosticAnalyzeResult);
        if (!finalize && d.needsExtension && d.extensionQuestions?.length) {
          setExtensionQuestions(d.extensionQuestions);
          setExtensionIdx(0);
          setPhase('extension');
        } else {
          await loadWorkPlan();
          setPhase('map');
          appendDiagnosisSnapshot(
            { companyId: targetCompanyId || null, networkId },
            {
              overall: d.computed.overall,
              sectors: [
                {
                  sectorId,
                  sectorSlug: sectorId,
                  sectorName: d.computed.sectorName,
                  score: d.computed.overall,
                  areas: [],
                  lowSignals: [],
                },
              ],
              weakestSectors: [],
              weakestAreas: d.weaknesses.slice(0, 8).map((w: { questionId: string; label: string; score: number }) => ({
                areaId: w.questionId,
                areaName: w.label,
                sectorId,
                sectorSlug: sectorId,
                score: w.score,
                lowSignals: [],
              })),
            }
          );
          if (targetCompanyId) {
            void fetch('/api/nexus/incubation/run', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId: targetCompanyId,
                networkId,
                program,
                sectorId,
                analyze: d,
              }),
            });
          }
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Erro');
        setPhase('base');
      }
    },
    [
      sectorId,
      scoredQuestions,
      answers,
      customQuestions,
      customAnswers,
      extensionQuestions,
      extensionAnswers,
      loc,
      program,
      loadWorkPlan,
      targetCompanyId,
      networkId,
    ]
  );

  const diagnosisSnap = useMemo(
    () => (analyze ? diagnosisFromAnalyze(analyze, sectorId) : null),
    [analyze, sectorId]
  );

  const goNextBase = () => {
    if (!current) return;
    if (current.section === 'custom') {
      if (!customAnswers[current.id]?.trim()) {
        setErr(es ? 'Resposta obrigatória.' : 'Resposta obrigatória.');
        return;
      }
    } else if (!answers[current.id]) {
      setErr(es ? 'Escolha uma opção.' : 'Escolha uma opção.');
      return;
    }
    setErr(null);
    if (baseIdx >= allSteps.length - 1) void runAnalyze(false);
    else setBaseIdx((i) => i + 1);
  };

  const finishExtension = (skip: boolean) => {
    if (!skip) {
      const eq = extensionQuestions[extensionIdx];
      if (eq && !extensionAnswers[eq.id]?.trim()) {
        setErr(es ? 'Responda ou salte.' : 'Responda ou salte.');
        return;
      }
      if (extensionIdx < extensionQuestions.length - 1) {
        setExtensionIdx((i) => i + 1);
        return;
      }
    }
    void runAnalyze(true);
  };

  const commitPlan = async () => {
    setCommitting(true);
    setErr(null);
    try {
      const picked = planItems.filter((it) => selectedIds.has(it.id));
      const r = await fetch('/api/nexus/diagnostic/commit-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: targetCompanyId,
          targetCompanyId,
          networkId,
          program,
          items: picked,
          layers,
          strategicPlan,
          diagnosis: diagnosisSnap,
          atEngagementId: program.atEngagementId,
          atProjectId: program.atProjectId,
          siepProjectId: program.siepProjectId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Commit falhou');
      setCommitResult({ engagementId: d.engagementId, atCaseIds: d.atCaseIds });
      setPhase('summary');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setCommitting(false);
    }
  };

  const Lmode = (m: IncubationProgramMode) => PROGRAM_MODE_LABELS[m][loc];

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-12">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {es ? 'Incubadora NEXUS · consultoria AT' : 'Incubadora NEXUS · consultoria AT'}
        </p>
        <h1 className="text-2xl font-semibold text-slate-900">
          {es ? 'Diagnóstico + plano de desarrollo' : 'Diagnóstico + plano de desenvolvimento'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {es
            ? 'Flujo: programa de acompañamiento → diagnóstico por sector → mapa de potencial → capas de trabajo → rota viva + plano estratégico.'
            : 'Fluxo: programa de acompanhamento → diagnóstico por setor → mapa de potencial → camadas de trabalho → rota viva + plano estratégico.'}
        </p>
        <ol className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium uppercase text-slate-500">
          {[
            es ? '1. Programa' : '1. Programa',
            es ? '2. Diagnóstico' : '2. Diagnóstico',
            es ? '3. Mapa' : '3. Mapa',
            es ? '4. Plano' : '4. Plano',
            es ? '5. Execução' : '5. Execução',
          ].map((s, i) => {
            const active =
              (i === 0 && phase === 'program') ||
              (i === 1 && (phase === 'sector' || phase === 'base' || phase === 'analyzing' || phase === 'extension')) ||
              (i === 2 && phase === 'map') ||
              (i === 3 && phase === 'workplan') ||
              (i === 4 && phase === 'summary');
            return (
              <li
                key={s}
                className={`rounded-full px-2 py-0.5 ${active ? 'bg-teal-100 text-teal-900' : 'bg-slate-100'}`}
              >
                {s}
              </li>
            );
          })}
        </ol>
      </header>

      {phase !== 'program' && phase !== 'summary' && (
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            {program.totalHours}h · {program.durationMonths}m
          </span>
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-900">{Lmode(program.mode)}</span>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-900">{qExpect.label}</span>
        </div>
      )}

      {phase === 'program' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{es ? '1. Programa de acompañamiento' : '1. Programa de acompanhamento'}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['intensive', 'ongoing', 'graduate'] as IncubationProgramMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setProgram((p) => normalizeProgram({ ...p, mode: m }))}
                className={`rounded-xl border p-3 text-left text-sm ${
                  program.mode === m ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
                }`}
              >
                <p className="font-medium">{Lmode(m)}</p>
                <p className="mt-1 text-xs text-slate-600">{PROGRAM_MODE_LABELS[m].desc[loc]}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              {es ? 'Meses de acompañamiento' : 'Meses de acompanhamento'}
              <input
                type="number"
                min={1}
                max={60}
                value={program.durationMonths}
                onChange={(e) =>
                  setProgram((p) => normalizeProgram({ ...p, durationMonths: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              {es ? 'Horas / mes (dedicación técnica)' : 'Horas / mês (dedicação técnica)'}
              <input
                type="number"
                min={2}
                max={80}
                value={program.hoursPerMonth}
                onChange={(e) =>
                  setProgram((p) => normalizeProgram({ ...p, hoursPerMonth: Number(e.target.value) }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>
          </div>
          <p className="text-sm text-slate-700">
            {es ? 'Total estimado:' : 'Total estimado:'}{' '}
            <strong>{program.durationMonths * program.hoursPerMonth} h</strong> — {es ? 'profundidad' : 'profundidade'}{' '}
            <strong>{depth}</strong> ({qExpect.label})
          </p>
          <label className="block text-sm">
            {es ? 'Profundidad del diagnóstico' : 'Profundidade do diagnóstico'}
            <select
              value={program.diagnosticDepth || depth}
              onChange={(e) =>
                setProgram((p) => ({ ...p, diagnosticDepth: e.target.value as DiagnosticDepth }))
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              <option value="screening">{es ? 'Triagem (~6)' : 'Triagem (~6)'}</option>
              <option value="standard">{es ? 'Standard (~20)' : 'Standard (~20)'}</option>
              <option value="deep">{es ? 'Profundo (~30)' : 'Profundo (~30)'}</option>
              <option value="exhaustive">{es ? 'Exaustivo (~45+)' : 'Exaustivo (~45+)'}</option>
            </select>
          </label>
          {(program.mode === 'graduate' || program.strategicHorizon !== 'none') && (
            <label className="block text-sm">
              {es ? 'Horizonte estratégico post-salida' : 'Horizonte estratégico pós-saída'}
              <select
                value={program.strategicHorizon}
                onChange={(e) =>
                  setProgram((p) => ({
                    ...p,
                    strategicHorizon: e.target.value as IncubationProgram['strategicHorizon'],
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
              >
                <option value="none">{es ? 'Ninguno' : 'Nenhum'}</option>
                <option value="12m">12 {es ? 'meses' : 'meses'}</option>
                <option value="36m">36 {es ? 'meses (3 años)' : 'meses (3 anos)'}</option>
              </select>
            </label>
          )}
          <label className="block text-sm">
            {es ? 'Fase de la jornada' : 'Fase da jornada'}
            <select
              value={program.ventureStage}
              onChange={(e) => setProgram((p) => ({ ...p, ventureStage: e.target.value as IncubationProgram['ventureStage'] }))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
            >
              {VENTURE_STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {loc === 'es' ? s.labelEs : loc === 'en' ? s.labelEn : s.labelPt}
                </option>
              ))}
            </select>
          </label>
          {atEngagements.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-3">
              <label className="block text-sm">
                {es ? 'Serviço AT vinculado' : 'Serviço AT vinculado'}
                <select
                  value={program.atEngagementId || ''}
                  onChange={(e) => {
                    const engId = e.target.value || null;
                    const eng = atEngagements.find((x) => x.id === engId);
                    setProgram((p) =>
                      normalizeProgram({
                        ...p,
                        atEngagementId: engId,
                        atProjectId: eng?.projects[0]?.id || null,
                        siepProjectId: eng?.projects[0]?.siepProjectId || null,
                      })
                    );
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="">{es ? '— autónomo / sem AT —' : '— autónomo / sem AT —'}</option>
                  {atEngagements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </label>
              {selectedEngagement && selectedEngagement.projects.length > 0 && (
                <label className="block text-sm">
                  {es ? 'Projeto do serviço' : 'Projeto do serviço'}
                  <select
                    value={program.atProjectId || ''}
                    onChange={(e) => {
                      const pid = e.target.value || null;
                      const proj = selectedEngagement.projects.find((p) => p.id === pid);
                      setProgram((p) =>
                        normalizeProgram({
                          ...p,
                          atProjectId: pid,
                          siepProjectId: proj?.siepProjectId || p.siepProjectId,
                        })
                      );
                    }}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    {selectedEngagement.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
          {targetCompanyId && (
            <p className="text-xs text-slate-500">
              {es ? 'Empresa alvo:' : 'Empresa alvo:'} <code className="text-[10px]">{targetCompanyId.slice(0, 12)}…</code>
            </p>
          )}
          <button
            type="button"
            onClick={() => setPhase('sector')}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {es ? 'Continuar → sector' : 'Continuar → setor'}
          </button>
        </div>
      )}

      {phase === 'sector' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold">{es ? '2. Sector económico' : '2. Setor económico'}</h2>
          <select
            value={sectorId}
            onChange={(e) => setSectorId(e.target.value)}
            className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">—</option>
            {sectorGroups.map((g) => (
              <optgroup key={g.groupId} label={g.groupLabel}>
                {g.sectors.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-2 text-xs text-slate-500">
            {allSteps.length} {es ? 'perguntas neste diagnóstico' : 'perguntas neste diagnóstico'}
          </p>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => setPhase('program')} className="rounded-lg border px-3 py-2 text-sm">
              {es ? 'Atrás' : 'Atrás'}
            </button>
            <button
              type="button"
              disabled={!sectorId}
              onClick={() => {
                setBaseIdx(0);
                setPhase('base');
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {es ? 'Iniciar questionário' : 'Iniciar questionário'}
            </button>
          </div>
        </div>
      )}

      {phase === 'base' && current && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 h-1.5 rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-teal-600 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-slate-500">
            {baseIdx + 1}/{allSteps.length} · {sectionLabel(current.section, loc)}
          </p>
          <h2 className="mt-2 text-lg font-semibold">{questionLabel(current, loc)}</h2>
          {current.section === 'custom' ? (
            <textarea
              value={customAnswers[current.id] || ''}
              onChange={(e) => setCustomAnswers((p) => ({ ...p, [current.id]: e.target.value }))}
              rows={3}
              className="mt-4 w-full rounded-xl border px-3 py-2 text-sm"
            />
          ) : (
            <div className="mt-4 grid gap-2">
              {current.options.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setAnswers((p) => ({ ...p, [current.id]: o.id }))}
                  className={`rounded-xl border px-4 py-3 text-left text-sm ${
                    answers[current.id] === o.id ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
                  }`}
                >
                  {optionLabel(o, loc)}
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-between">
            <button
              type="button"
              onClick={() => (baseIdx === 0 ? setPhase('sector') : setBaseIdx((i) => i - 1))}
              className="inline-flex items-center gap-1 text-sm"
            >
              <ChevronLeft className="h-4 w-4" /> {es ? 'Atrás' : 'Atrás'}
            </button>
            <button type="button" onClick={goNextBase} className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              {baseIdx >= allSteps.length - 1 ? (es ? 'Analisar' : 'Analisar') : es ? 'Siguiente' : 'Seguinte'}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={newCustomQ}
              onChange={(e) => setNewCustomQ(e.target.value)}
              placeholder={es ? 'Pregunta del técnico…' : 'Pergunta do técnico…'}
              className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const t = newCustomQ.trim();
                if (t.length < 8) return;
                setCustomQuestions((p) => [...p, { id: `c_${Date.now()}`, prompt: t, addedBy: 'technician' }]);
                setNewCustomQ('');
              }}
              className="rounded-lg bg-amber-700 px-3 text-white"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {phase === 'analyzing' && (
        <div className="flex flex-col items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
          <p className="mt-2 text-sm text-slate-600">{es ? 'A sintetizar mapa…' : 'A sintetizar mapa…'}</p>
        </div>
      )}

      {phase === 'extension' && extensionQuestions[extensionIdx] && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5">
          <p className="text-xs font-medium text-amber-900">{es ? 'Extensión IA (1 ronda)' : 'Extensão IA (1 ronda)'}</p>
          <h2 className="mt-2 font-semibold">{extensionQuestions[extensionIdx].prompt}</h2>
          <textarea
            value={extensionAnswers[extensionQuestions[extensionIdx].id] || ''}
            onChange={(e) =>
              setExtensionAnswers((p) => ({ ...p, [extensionQuestions[extensionIdx].id]: e.target.value }))
            }
            rows={3}
            className="mt-3 w-full rounded-xl border px-3 py-2 text-sm"
          />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => finishExtension(false)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              {es ? 'Continuar' : 'Continuar'}
            </button>
            <button type="button" onClick={() => finishExtension(true)} className="rounded-lg border px-4 py-2 text-sm">
              {es ? 'Saltar' : 'Saltar'}
            </button>
          </div>
        </div>
      )}

      {phase === 'map' && analyze && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex gap-2">
              <Sparkles className="h-5 w-5 text-emerald-700" />
              <div>
                <p className="font-semibold text-emerald-950">
                  {analyze.computed.sectorName} · {analyze.computed.overall}/100
                </p>
                <p className="mt-1 text-sm text-emerald-900">{analyze.summary}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <MapColumn title={es ? 'Fortalezas' : 'Fortalezas'} items={analyze.strengths.map((s) => s.label)} tone="emerald" />
            <MapColumn title={es ? 'Debilidades' : 'Debilidades'} items={analyze.weaknesses.map((s) => s.label)} tone="rose" />
            <MapColumn title={es ? 'Potenciales' : 'Potenciais'} items={analyze.potentials.map((s) => s.label)} tone="amber" />
          </div>
          <div className="rounded-xl border bg-white p-4">
            <p className="text-xs font-medium uppercase text-slate-500">{es ? 'Pilares de gestión' : 'Pilares de gestão'}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {analyze.pillarScores.map((p) => (
                <li key={p.slug} className="flex justify-between">
                  <span>{p.name}</span>
                  <span className="font-mono">{p.score}</span>
                </li>
              ))}
            </ul>
          </div>
          <button type="button" onClick={() => setPhase('workplan')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
            {es ? 'Ver plano de trabajo →' : 'Ver plano de trabalho →'}
          </button>
        </div>
      )}

      {phase === 'workplan' && (
        <div className="space-y-4">
          {layers.map((layer) => (
            <div key={layer.index} className="rounded-xl border bg-white p-4">
              <p className="font-semibold text-slate-900">{layer.title}</p>
              <p className="text-xs text-slate-500">
                {layer.hoursBudget}h · {layer.goals.join(' · ')}
              </p>
              <ul className="mt-2 space-y-2">
                {layer.items.map((it) => (
                  <li key={it.id} className="flex gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(it.id)}
                      onChange={(e) => {
                        setSelectedIds((prev) => {
                          const n = new Set(prev);
                          if (e.target.checked) n.add(it.id);
                          else n.delete(it.id);
                          return n;
                        });
                      }}
                    />
                    <span>
                      {it.title}
                      <span className="ml-2 text-[10px] text-slate-400">
                        {kindLabel(it.kind, loc)} · {it.estimatedHours}h
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {strategicPlan && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm">
              <p className="font-semibold text-indigo-950">
                {es ? 'Plan estratégico' : 'Plano estratégico'} · {strategicPlan.horizon}
              </p>
              <p className="mt-1 text-indigo-900">{strategicPlan.vision}</p>
            </div>
          )}
          <button
            type="button"
            disabled={committing || selectedIds.size === 0}
            onClick={() => void commitPlan()}
            className="rounded-xl bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {committing ? '…' : es ? `Criar ${selectedIds.size} ações na rota viva` : `Criar ${selectedIds.size} ações na rota viva`}
          </button>
        </div>
      )}

      {phase === 'summary' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <p className="font-semibold text-emerald-950">{es ? 'Processo registado' : 'Processo registado'}</p>
          <p className="text-sm text-emerald-900">
            {es
              ? 'Plano de trabalho na rota viva, camadas de desenvolvimento e histórico de incubação guardados no servidor. Casos AT críticos foram abertos se o serviço estava vinculado.'
              : 'Plano de trabalho na rota viva, camadas de desenvolvimento e histórico guardados no servidor.'}
          </p>
          {commitResult?.atCaseIds && commitResult.atCaseIds.length > 0 && (
            <p className="text-xs text-emerald-800">
              {commitResult.atCaseIds.length} {es ? 'casos AT criados' : 'casos AT criados'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href={withNet('/hub/nexus/roadmap')} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              {es ? 'Rota viva · executar' : 'Rota viva · executar'}
            </Link>
            <Link href={withNet('/hub/nexus/journey')} className="rounded-lg border px-4 py-2 text-sm">
              {es ? 'Jornada · avanços' : 'Jornada · avanços'}
            </Link>
            {(commitResult?.engagementId || program.atEngagementId) && (
              <Link
                href={`/hub/nexus/at/${encodeURIComponent(commitResult?.engagementId || program.atEngagementId || '')}`}
                className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm text-teal-900"
              >
                {es ? 'Serviço AT' : 'Serviço AT'}
              </Link>
            )}
          </div>
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}

function MapColumn({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'emerald' | 'rose' | 'amber';
}) {
  const bg = tone === 'emerald' ? 'bg-emerald-50' : tone === 'rose' ? 'bg-rose-50' : 'bg-amber-50';
  return (
    <div className={`rounded-xl border p-3 ${bg}`}>
      <p className="text-xs font-semibold uppercase">{title}</p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
        {items.length === 0 ? (
          <li className="text-slate-400">—</li>
        ) : (
          items.map((x, i) => (
            <li key={i}>
              · {x}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
