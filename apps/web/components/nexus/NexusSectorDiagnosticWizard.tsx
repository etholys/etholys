'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useApp } from '@/app/providers';
import { NexusSectorMultiSelect } from '@/components/nexus/NexusSectorMultiSelect';
import {
  answersPayloadForAnalyze,
  isOptionSelected,
  listDiagnosticQuestionsForSectors,
  optionLabel,
  questionLabel,
  sectionLabel,
  toggleQuestionAnswer,
  type DxCustomQuestion,
  type DxLocale,
  type DxQuestion,
} from '@/lib/nexus-sector-diagnostic';
import { appendDiagnosisSnapshot } from '@/lib/nexus-diagnosis-history';
import { touchRunwayChapter } from '@/lib/nexus-runway';
import { listSectorCatalog } from '@/lib/nexus-economic-sectors';
import type { DiagnosticAnalyzeResult, DiagnosticExtensionQuestion } from '@/lib/nexus-diagnostic-analyze';
import { diagnosisFromAnalyze } from '@/lib/nexus-incubation-run';
import {
  defaultIncubationProgram,
  defaultSelfAiProgram,
  depthFromProgram,
  expectedQuestionCount,
  normalizeProgram,
  PROGRAM_MODE_LABELS,
  type DiagnosticDepth,
  type IncubationProgram,
  applyContractKind,
  programLoopsAnnually,
  type IncubationProgramMode,
} from '@/lib/nexus-incubation-program';
import { AT_CONTRACT_LABELS, AT_QUAD_LABELS, type AtContractKind } from '@/lib/nexus-at-cycle';
import type { DevelopmentLayer, StrategicPlanOutline, WorkPlanItem } from '@/lib/nexus-incubation-workplan';
import { kindLabel } from '@/lib/nexus-incubation-run';
import { getSectorModule, L as moduleL, moduleActionHref } from '@/lib/nexus-sector-modules';
import { NexusIncubationProcessPanel } from '@/components/nexus/NexusIncubationProcessPanel';
import { stageLabel } from '@/lib/nexus-venture';
import { buildInterventionNarrative, buildStrategicDraft, buildTechnicalBrief } from '@/lib/nexus-diagnostic-brief';

type Phase =
  | 'program'
  | 'sector'
  | 'base'
  | 'analyzing'
  | 'extension'
  | 'analysis'
  | 'validate'
  | 'dialogue'
  | 'strategy'
  | 'map'
  | 'workplan'
  | 'summary';

const STORAGE_KEY = 'nexus-sector-dx-v6';

type DxDraft = {
  v: 6;
  phase: Phase;
  program: IncubationProgram;
  sectorIds: string[];
  baseIdx: number;
  answers: Record<string, string>;
  customQuestions: DxCustomQuestion[];
  customAnswers: Record<string, string>;
  extensionQuestions: DiagnosticExtensionQuestion[];
  extensionAnswers: Record<string, string>;
  extensionIdx: number;
  analyze: DiagnosticAnalyzeResult | null;
  layers: DevelopmentLayer[];
  planItems: WorkPlanItem[];
  strategicPlan: StrategicPlanOutline | null;
  selectedIds: string[];
  dialogueNotes: string;
  analysisValidated: boolean;
  savedAt: number;
};

function draftStorageKey(companyId: string, engagementId: string | null, networkId: string | null) {
  return `${STORAGE_KEY}:${companyId || 'none'}:${engagementId || ''}:${networkId || ''}`;
}

function readDraft(key: string): DxDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DxDraft;
    if (!parsed || parsed.v !== 6) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: DxDraft) {
  try {
    window.localStorage.setItem(key, JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

function clearDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

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
  const resumeParam = searchParams.get('resume'); // 'plan' | null

  const targetCompanyId = companyParam || activeCompanyId || '';
  /** AT a cliente vs autodesenvolvimento da empresa do seletor */
  const isAtFlow = Boolean(
    engagementParam || (companyParam && activeCompanyId && companyParam !== activeCompanyId)
  );
  const isAtClientSubject = isAtFlow;

  type AtEngagementLite = {
    id: string;
    title: string;
    projects: Array<{ id: string; name: string; siepProjectId?: string | null }>;
  };
  const [atEngagements, setAtEngagements] = useState<AtEngagementLite[]>([]);
  const [commitResult, setCommitResult] = useState<{ engagementId?: string | null; atCaseIds?: string[] } | null>(null);
  const [subjectCompany, setSubjectCompany] = useState<{
    name: string;
    shortName?: string;
    sectorIds?: string[];
  } | null>(null);

  const [phase, setPhase] = useState<Phase>('program');
  const [program, setProgram] = useState<IncubationProgram>(() => {
    if (engagementParam || (companyParam && companyParam !== '')) {
      // refined after mount when we know activeCompanyId
      return normalizeProgram({
        ...defaultIncubationProgram(),
        deliveryKind: 'at_assisted',
        atEngagementId: engagementParam || undefined,
        atProjectId: atProjectParam || undefined,
      });
    }
    return defaultSelfAiProgram();
  });

  useEffect(() => {
    setProgram((p) => {
      if (isAtFlow) {
        return normalizeProgram({
          ...p,
          deliveryKind: 'at_assisted',
          atEngagementId: engagementParam || p.atEngagementId || undefined,
          atProjectId: atProjectParam || p.atProjectId || undefined,
        });
      }
      if (p.deliveryKind === 'self_ai') return p;
      return normalizeProgram({
        ...defaultSelfAiProgram(p.ventureStage),
        diagnosticDepth: p.diagnosticDepth || 'standard',
        ventureStage: p.ventureStage,
      });
    });
  }, [isAtFlow, engagementParam, atProjectParam]);
  const [sectorIds, setSectorIds] = useState<string[]>([]);
  const sectorId = sectorIds[0] || '';
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
  const [draftReady, setDraftReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [dialogueNotes, setDialogueNotes] = useState('');
  const [analysisValidated, setAnalysisValidated] = useState(false);

  const storageKey = useMemo(
    () => draftStorageKey(targetCompanyId, engagementParam, networkId),
    [targetCompanyId, engagementParam, networkId]
  );

  const sectorOptions = useMemo(
    () => listSectorCatalog().map((s) => ({ id: s.id, label: s.label[loc] })),
    [loc]
  );
  const depth = useMemo(() => depthFromProgram(program), [program]);
  const qExpect = useMemo(() => expectedQuestionCount(depth), [depth]);

  const scoredQuestions = useMemo(
    () => (sectorIds.length > 0 ? listDiagnosticQuestionsForSectors(sectorIds, program) : []),
    [sectorIds, program]
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

  /** Restaura progresso ao atualizar a página. */
  useEffect(() => {
    setDraftReady(false);
    const draft = readDraft(storageKey);
    if (draft) {
      const phaseRestored: Phase =
        draft.phase === 'analyzing'
          ? draft.analyze
            ? 'analysis'
            : 'base'
          : draft.phase === 'map'
            ? 'analysis'
            : draft.phase === 'summary'
              ? 'summary'
              : draft.phase;
      setPhase(phaseRestored);
      setProgram(normalizeProgram(draft.program));
      setSectorIds(Array.isArray(draft.sectorIds) ? draft.sectorIds : []);
      setBaseIdx(typeof draft.baseIdx === 'number' ? draft.baseIdx : 0);
      setAnswers(draft.answers || {});
      setCustomQuestions(draft.customQuestions || []);
      setCustomAnswers(draft.customAnswers || {});
      setExtensionQuestions(draft.extensionQuestions || []);
      setExtensionAnswers(draft.extensionAnswers || {});
      setExtensionIdx(typeof draft.extensionIdx === 'number' ? draft.extensionIdx : 0);
      setAnalyze(draft.analyze || null);
      setLayers(draft.layers || []);
      setPlanItems(draft.planItems || []);
      setStrategicPlan(draft.strategicPlan || null);
      setSelectedIds(new Set(draft.selectedIds || []));
      setDialogueNotes(draft.dialogueNotes || '');
      setAnalysisValidated(Boolean(draft.analysisValidated));
      setRestoredDraft(true);
    } else {
      setRestoredDraft(false);
    }
    setDraftReady(true);
  }, [storageKey]);

  /** Persiste avanço (programa, respostas, fase). */
  useEffect(() => {
    if (!draftReady) return;
    if (phase === 'summary') return;
    writeDraft(storageKey, {
      v: 6,
      phase: phase === 'analyzing' ? 'base' : phase === 'map' ? 'analysis' : phase,
      program,
      sectorIds,
      baseIdx,
      answers,
      customQuestions,
      customAnswers,
      extensionQuestions,
      extensionAnswers,
      extensionIdx,
      analyze,
      layers,
      planItems,
      strategicPlan,
      selectedIds: [...selectedIds],
      dialogueNotes,
      analysisValidated,
      savedAt: Date.now(),
    });
  }, [
    draftReady,
    storageKey,
    phase,
    program,
    sectorIds,
    baseIdx,
    answers,
    customQuestions,
    customAnswers,
    extensionQuestions,
    extensionAnswers,
    extensionIdx,
    analyze,
    layers,
    planItems,
    strategicPlan,
    selectedIds,
    dialogueNotes,
    analysisValidated,
  ]);

  useEffect(() => {
    if (!draftReady || allSteps.length === 0) return;
    if (baseIdx >= allSteps.length) setBaseIdx(allSteps.length - 1);
  }, [draftReady, allSteps.length, baseIdx]);

  const resetDraft = useCallback(() => {
    clearDraft(storageKey);
    setRestoredDraft(false);
    setPhase('program');
    setProgram(isAtFlow ? normalizeProgram({ ...defaultIncubationProgram(), deliveryKind: 'at_assisted', atEngagementId: engagementParam || undefined, atProjectId: atProjectParam || undefined }) : defaultSelfAiProgram());
    setSectorIds([]);
    setBaseIdx(0);
    setAnswers({});
    setCustomQuestions([]);
    setCustomAnswers({});
    setExtensionQuestions([]);
    setExtensionAnswers({});
    setExtensionIdx(0);
    setAnalyze(null);
    setLayers([]);
    setPlanItems([]);
    setStrategicPlan(null);
    setSelectedIds(new Set());
    setCommitResult(null);
    setDialogueNotes('');
    setAnalysisValidated(false);
    setErr(null);
  }, [storageKey, isAtFlow, engagementParam, atProjectParam]);

  useEffect(() => {
    setProgram((p) => ({
      ...p,
      totalHours: p.durationMonths * p.hoursPerMonth,
      strategicHorizon: p.mode === 'graduate' && p.strategicHorizon === 'none' ? '12m' : p.strategicHorizon,
    }));
  }, [program.durationMonths, program.hoursPerMonth, program.mode]);

  useEffect(() => {
    if (!targetCompanyId) {
      setSubjectCompany(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (engagementParam) {
          const r = await fetch(`/api/nexus/at/engagements/${encodeURIComponent(engagementParam)}`);
          const d = await r.json();
          const m = (d.engagement?.members || []).find(
            (x: { companyId: string; sectorId?: string | null; sectorIds?: string[] | null; company?: { name?: string; shortName?: string } }) =>
              x.companyId === targetCompanyId
          );
          if (m?.company && !cancelled) {
            const ids =
              m.sectorIds && m.sectorIds.length > 0
                ? m.sectorIds
                : m.sectorId
                  ? [m.sectorId]
                  : [];
            setSubjectCompany({
              name: m.company.name || m.company.shortName || targetCompanyId,
              shortName: m.company.shortName,
              sectorIds: ids,
            });
            if (ids.length) setSectorIds((prev) => (prev.length ? prev : ids));
            return;
          }
        }
        const r = await fetch('/api/nexus/at/client-companies?q=&take=80');
        const d = await r.json();
        const mine = (d.companies || []).find((c: { id: string }) => c.id === targetCompanyId);
        if (!cancelled && mine) {
          const ids = mine.sectorIds?.length
            ? mine.sectorIds
            : mine.sectorId
              ? [mine.sectorId]
              : [];
          setSubjectCompany({
            name: mine.name || mine.shortName || targetCompanyId,
            shortName: mine.shortName,
            sectorIds: ids,
          });
          if (ids.length) setSectorIds((prev) => (prev.length ? prev : ids));
        }
      } catch {
        if (!cancelled) setSubjectCompany(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetCompanyId, engagementParam]);

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
          setPhase('analysis');
          if (d.inferredStage) {
            setProgram((p) =>
              normalizeProgram({
                ...p,
                ventureStage: d.inferredStage,
              })
            );
          }
          touchRunwayChapter('diagnosis');
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
            void fetch('/api/nexus/diagnoses', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId: targetCompanyId,
                engagementId: engagementParam || program.atEngagementId || null,
                sectorId,
                overall: d.computed.overall,
                scoresJson: {
                  strengths: d.strengths,
                  weaknesses: d.weaknesses,
                  potentials: d.potentials,
                  pillarScores: d.pillarScores,
                  summary: d.summary,
                },
                answersJson: answers,
              }),
            });
            void fetch('/api/nexus/incubation/run', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                companyId: targetCompanyId,
                networkId,
                engagementId: engagementParam,
                atEngagementId: engagementParam,
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
      engagementParam,
    ]
  );

  /** ?resume=plan — abrir no plano (não no início do questionário). */
  useEffect(() => {
    if (!draftReady) return;
    if (resumeParam !== 'plan') return;
    if (phase === 'map' || phase === 'analysis' || phase === 'validate' || phase === 'dialogue' || phase === 'strategy' || phase === 'workplan' || phase === 'summary') return;
    if (analyze) {
      setPhase(resumeParam === 'plan' ? 'workplan' : 'analysis');
      if (resumeParam === 'plan') setAnalysisValidated(true);
      return;
    }
    if (Object.keys(answers).length >= 4 && sectorId) {
      void runAnalyze(true);
    }
  }, [draftReady, resumeParam, analyze, phase, answers, sectorId, runAnalyze]);

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
      setErr(
        current.multi
          ? es
            ? 'Marque al menos una opción.'
            : 'Marque pelo menos uma opção.'
          : es
            ? 'Escolha uma opção.'
            : 'Escolha uma opção.'
      );
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
      clearDraft(storageKey);
      setRestoredDraft(false);
      setPhase('summary');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setCommitting(false);
    }
  };

  const Lmode = (m: IncubationProgramMode) => PROGRAM_MODE_LABELS[m][loc];

  const selfSteps = es
    ? ['Enfoque', 'Diagnóstico', 'Análisis', 'Diálogo', 'Estrategia']
    : ['Enfoque', 'Diagnóstico', 'Análise', 'Diálogo', 'Estratégia'];
  const atSteps = es
    ? ['Programa', 'Diagnóstico', 'Análisis', 'Diálogo', 'Plan']
    : ['Programa', 'Diagnóstico', 'Análise', 'Diálogo', 'Plano'];
  const stepIndex =
    phase === 'program'
      ? 0
      : phase === 'sector' || phase === 'base' || phase === 'analyzing' || phase === 'extension'
        ? 1
        : phase === 'analysis' || phase === 'validate' || phase === 'map'
          ? 2
          : phase === 'dialogue'
            ? 3
            : 4;
  const depthOptions: Array<{ id: DiagnosticDepth; label: string; hint: string }> = [
    {
      id: 'screening',
      label: es ? 'Rápido' : 'Rápido',
      hint: es ? '~6 preguntas' : '~6 perguntas',
    },
    {
      id: 'standard',
      label: 'Standard',
      hint: es ? '~20 preguntas' : '~20 perguntas',
    },
    {
      id: 'deep',
      label: es ? 'Profundo' : 'Profundo',
      hint: es ? '~30 preguntas' : '~30 perguntas',
    },
    {
      id: 'exhaustive',
      label: es ? 'Completo' : 'Completo',
      hint: es ? '~45+ preguntas' : '~45+ perguntas',
    },
  ];
  const currentDepth = (program.diagnosticDepth || depth) as DiagnosticDepth;

  return (
    <div
      className={
        isAtFlow
          ? 'mx-auto max-w-3xl space-y-4 pb-12'
          : 'relative mx-auto max-w-3xl space-y-6 pb-16'
      }
    >
      {!isAtFlow && (
        <div
          className="pointer-events-none absolute -inset-x-6 -top-4 bottom-0 -z-10 opacity-90 sm:-inset-x-10"
          aria-hidden
          style={{
            background:
              'radial-gradient(ellipse 70% 40% at 20% 0%, rgba(13,148,136,0.12), transparent 55%), radial-gradient(ellipse 50% 35% at 90% 10%, rgba(251,146,60,0.08), transparent 50%)',
          }}
        />
      )}

      {!isAtFlow && targetCompanyId && (
        <NexusIncubationProcessPanel
          companyId={targetCompanyId}
          networkId={networkId}
          locale={loc}
          hideWhenEmpty
        />
      )}

      {restoredDraft && phase !== 'summary' && phase !== 'program' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50/80 px-3 py-2 text-sm text-teal-950">
          <span>{es ? 'Continuando donde lo dejó.' : 'A continuar de onde ficou.'}</span>
          <button type="button" onClick={resetDraft} className="text-xs font-semibold underline underline-offset-2">
            {es ? 'Empezar de nuevo' : 'Começar de novo'}
          </button>
        </div>
      )}

      <header className={isAtFlow ? undefined : 'space-y-4'}>
        {isAtFlow ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {es
                ? 'Asistencia técnica · diagnóstico de cliente'
                : 'Assistência técnica · diagnóstico de cliente'}
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">
              {es ? 'Diagnóstico + plan de desarrollo AT' : 'Diagnóstico + plano de desenvolvimento AT'}
            </h1>
          </>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-[#0c1222] px-6 py-8 text-white shadow-lg sm:px-8">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-teal-300/90">NEXUS</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
              {es ? 'Autodiagnóstico' : 'Autodiagnóstico'}
            </h1>
            <p className="mt-2 max-w-md text-sm text-slate-300">
              {es
                ? 'Un recorrido guiado para tu empresa activa.'
                : 'Um percurso guiado para a tua empresa ativa.'}
            </p>
            <div className="mt-6 flex gap-1.5" role="list" aria-label={es ? 'Progreso' : 'Progresso'}>
              {selfSteps.map((label, i) => (
                <div key={label} className="min-w-0 flex-1" role="listitem">
                  <div
                    className={`h-1 rounded-full transition-colors duration-500 ${
                      i <= stepIndex ? 'bg-teal-400' : 'bg-white/15'
                    }`}
                  />
                  <p
                    className={`mt-1.5 truncate text-[10px] ${
                      i === stepIndex ? 'font-medium text-teal-200' : 'text-slate-500'
                    }`}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
        {isAtFlow && subjectCompany && (
          <div className="mt-3 rounded-xl border border-teal-300 bg-teal-50 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              {es ? 'MIPYME en diagnóstico' : 'MIPYME em diagnóstico'}
            </p>
            <p className="mt-0.5 text-base font-semibold text-slate-900">{subjectCompany.name}</p>
            {engagementParam && (
              <Link
                href={`/hub/nexus/at/${encodeURIComponent(engagementParam)}`}
                className="mt-2 inline-block text-xs font-medium text-teal-800 underline"
              >
                {es ? '← Volver al contrato AT' : '← Voltar ao contrato AT'}
              </Link>
            )}
          </div>
        )}
        {isAtFlow && (
          <ol className="mt-3 flex flex-wrap gap-2 text-[10px] font-medium uppercase text-slate-500">
            {atSteps.map((s, i) => {
              const active = i === stepIndex;
              return (
                <li
                  key={s}
                  className={`rounded-full px-2 py-0.5 ${active ? 'bg-teal-100 text-teal-900' : 'bg-slate-100'}`}
                >
                  {i + 1}. {s}
                </li>
              );
            })}
          </ol>
        )}
      </header>

      {isAtFlow && phase !== 'program' && phase !== 'summary' && (
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span className="rounded-full bg-slate-100 px-2 py-0.5">
            {program.totalHours}h · {program.durationMonths}m
          </span>
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-teal-900">{Lmode(program.mode)}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700">{qExpect.label}</span>
        </div>
      )}

      {phase === 'program' && !isAtFlow && (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              {es ? '¿Cuánto profundidad querés?' : 'Quanta profundidade queres?'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {es ? 'Elegí el ritmo del recorrido.' : 'Escolhe o ritmo do percurso.'}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {depthOptions.map((opt) => {
                const on = currentDepth === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() =>
                      setProgram((p) =>
                        normalizeProgram({
                          ...p,
                          deliveryKind: 'self_ai',
                          diagnosticDepth: opt.id,
                        })
                      )
                    }
                    className={`rounded-2xl border px-4 py-4 text-left transition duration-200 ${
                      on
                        ? 'border-teal-600/60 bg-teal-50/80 shadow-sm ring-1 ring-teal-600/20'
                        : 'border-slate-200/80 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-900">{opt.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPhase('sector')}
            className="inline-flex items-center gap-2 rounded-2xl bg-[#0c1222] px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            {es ? 'Empezar diagnóstico' : 'Começar diagnóstico'}
            <span aria-hidden>→</span>
          </button>
        </div>
      )}

      {phase === 'program' && isAtFlow && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">{es ? '1. Tipo de contrato AT' : '1. Tipo de contrato AT'}</h2>
          <p className="text-xs text-slate-500">
            {es
              ? 'El contrato decide si el ciclo cierra o vuelve: cliente directo, proyecto o servicio puntual.'
              : 'O contrato decide se o ciclo fecha ou volta: cliente direto, projeto ou serviço pontual.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['permanent', 'project', 'punctual'] as AtContractKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setProgram((p) => applyContractKind({ ...p, deliveryKind: 'at_assisted' }, k))}
                className={`rounded-xl border p-3 text-left text-sm ${
                  (program.contractKind || 'project') === k ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
                }`}
              >
                <p className="font-medium">{AT_CONTRACT_LABELS[k][loc]}</p>
                <p className="mt-1 text-xs text-slate-600">{AT_CONTRACT_LABELS[k].desc[loc]}</p>
              </button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {(['intensive', 'ongoing', 'graduate'] as IncubationProgramMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() =>
                  setProgram((p) => normalizeProgram({ ...p, deliveryKind: 'at_assisted', mode: m }))
                }
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
                  setProgram((p) =>
                    normalizeProgram({
                      ...p,
                      deliveryKind: 'at_assisted',
                      durationMonths: Number(e.target.value),
                    })
                  )
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
                  setProgram((p) =>
                    normalizeProgram({
                      ...p,
                      deliveryKind: 'at_assisted',
                      hoursPerMonth: Number(e.target.value),
                    })
                  )
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
                setProgram((p) => ({
                  ...p,
                  deliveryKind: 'at_assisted',
                  diagnosticDepth: e.target.value as DiagnosticDepth,
                }))
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
                    deliveryKind: 'at_assisted',
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
          {atEngagements.length > 0 && (
            <div className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <label className="block text-sm">
                {es ? 'Contrato AT' : 'Contrato AT'}
                <select
                  value={program.atEngagementId || ''}
                  onChange={(e) => {
                    const engId = e.target.value || null;
                    const eng = atEngagements.find((x) => x.id === engId);
                    setProgram((p) =>
                      normalizeProgram({
                        ...p,
                        deliveryKind: 'at_assisted',
                        atEngagementId: engId,
                        atProjectId: eng?.projects[0]?.id || null,
                        siepProjectId: eng?.projects[0]?.siepProjectId || null,
                      })
                    );
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="">{es ? '— elegir —' : '— escolher —'}</option>
                  {atEngagements.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.title}
                    </option>
                  ))}
                </select>
              </label>
              {selectedEngagement && selectedEngagement.projects.length > 0 && (
                <label className="block text-sm">
                  {es ? 'Proyecto del contrato' : 'Projeto do contrato'}
                  <select
                    value={program.atProjectId || ''}
                    onChange={(e) => {
                      const pid = e.target.value || null;
                      const proj = selectedEngagement.projects.find((p) => p.id === pid);
                      setProgram((p) =>
                        normalizeProgram({
                          ...p,
                          deliveryKind: 'at_assisted',
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
        <div className={isAtFlow ? 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm' : 'space-y-5'}>
          <div>
            <h2 className={isAtFlow ? 'text-sm font-semibold' : 'text-lg font-semibold tracking-tight text-slate-900'}>
              {isAtFlow
                ? es
                  ? '2. Temáticas'
                  : '2. Temáticas'
                : es
                  ? '¿En qué temáticas enfocamos?'
                  : 'Em que temáticas focamos?'}
            </h2>
            {!isAtFlow && (
              <p className="mt-1 text-sm text-slate-500">
                {es ? 'Podés elegir una o varias.' : 'Podes escolher uma ou várias.'}
              </p>
            )}
          </div>
          <div className={isAtFlow ? 'mt-3' : undefined}>
            <NexusSectorMultiSelect
              options={sectorOptions}
              value={sectorIds}
              onChange={setSectorIds}
              placeholder={es ? 'Elegir temáticas…' : 'Escolher temáticas…'}
              emptyLabel={es ? 'Ninguna' : 'Nenhuma'}
            />
          </div>
          {allSteps.length > 0 && (
            <p className="text-xs text-slate-500">
              {allSteps.length} {es ? 'preguntas en este recorrido' : 'perguntas neste percurso'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPhase('program')}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              {es ? 'Atrás' : 'Atrás'}
            </button>
            <button
              type="button"
              disabled={sectorIds.length === 0}
              onClick={() => {
                setBaseIdx(0);
                setPhase('base');
              }}
              className="rounded-2xl bg-[#0c1222] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {es ? 'Empezar preguntas' : 'Começar perguntas'}
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
          {current.help && (
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {current.help[loc] || current.help.es}
            </p>
          )}
          {current.areaName && (
            <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-teal-800">
              {current.areaName}
            </p>
          )}
          {current.section === 'custom' ? (
            <textarea
              value={customAnswers[current.id] || ''}
              onChange={(e) => setCustomAnswers((p) => ({ ...p, [current.id]: e.target.value }))}
              rows={3}
              className="mt-4 w-full rounded-xl border px-3 py-2 text-sm"
            />
          ) : (
            <div className="mt-4 grid gap-2">
              {current.multi && (
                <p className="text-[11px] font-medium text-slate-500">
                  {es ? 'Puede marcar más de una' : 'Pode marcar mais de uma'}
                </p>
              )}
              {current.options.map((o) => {
                const selected = isOptionSelected(answers[current.id], o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() =>
                      setAnswers((p) => ({
                        ...p,
                        [current.id]: toggleQuestionAnswer(current, p[current.id], o.id),
                      }))
                    }
                    className={`rounded-xl border px-4 py-3 text-left text-sm ${
                      selected ? 'border-teal-600 bg-teal-50' : 'border-slate-200'
                    }`}
                  >
                    {optionLabel(o, loc)}
                  </button>
                );
              })}
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
              placeholder={
                isAtFlow
                  ? es
                    ? 'Pregunta del técnico…'
                    : 'Pergunta do técnico…'
                  : es
                    ? 'Agregar pregunta…'
                    : 'Adicionar pergunta…'
              }
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

      {(phase === 'analysis' || phase === 'map') && analyze && (
        <div className="space-y-4">
          {(() => {
            const brief =
              analyze.technicalBrief ||
              buildTechnicalBrief(sectorId, analyze.computed, answers, loc);
            const intervention =
              analyze.intervention || buildInterventionNarrative(brief, loc);
            const inferred = analyze.inferredStage || brief.inferredStage;
            return (
              <>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex gap-2">
              <Sparkles className="h-5 w-5 shrink-0 text-emerald-700" />
              <div>
                <p className="font-semibold text-emerald-950">
                  {analyze.computed.sectorName} · {analyze.computed.overall}/100
                </p>
                <p className="mt-1 text-sm text-emerald-900">{analyze.summary}</p>
                {brief.quantitative ? (
                  <p className="mt-2 text-xs text-emerald-900">{brief.quantitative}</p>
                ) : null}
                {brief.qualitative ? (
                  <p className="mt-1 text-xs text-emerald-800">{brief.qualitative}</p>
                ) : null}
                <p className="mt-2 text-xs font-medium text-emerald-950">
                  {es ? 'Fase inferida por el diagnóstico' : 'Fase inferida pelo diagnóstico'}:{' '}
                  {stageLabel(inferred, loc)}
                  <span className="mt-1 block font-normal text-emerald-800">{brief.stageRationale}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                {es ? 'Análisis técnico' : 'Análise técnica'}
              </h3>
              <p className="text-sm text-slate-700">{brief.overallReading}</p>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {es ? 'Lentes teóricas' : 'Lentes teóricas'}
                </p>
                <ul className="mt-1 space-y-1 text-xs text-slate-600">
                  {brief.theoreticalLenses.map((x, i) => (
                    <li key={i}>· {x}</li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-lg bg-slate-50 p-2 text-xs">
                  <p className="font-semibold">{es ? 'Económico' : 'Económico'}</p>
                  <p className="mt-1 text-slate-600">{brief.tripleImpact.economic}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-xs">
                  <p className="font-semibold">{es ? 'Social' : 'Social'}</p>
                  <p className="mt-1 text-slate-600">{brief.tripleImpact.social}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-xs">
                  <p className="font-semibold">{es ? 'Ambiental' : 'Ambiental'}</p>
                  <p className="mt-1 text-slate-600">{brief.tripleImpact.environmental}</p>
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {es ? 'Referencias' : 'Referências'}: {brief.references.join(' · ')}
              </p>
            </div>

          {analyze.computed.quads && analyze.computed.quads.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-4">
              {analyze.computed.quads.map((q) => (
                <div key={q.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">
                    {AT_QUAD_LABELS[q.id][loc]}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900">{q.score}</p>
                  <p className="mt-1 text-[11px] leading-snug text-slate-600">{q.reading}</p>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <MapColumn title={es ? 'Fortalezas' : 'Fortalezas'} items={analyze.strengths.map((s) => s.label)} tone="emerald" />
            <MapColumn title={es ? 'Debilidades' : 'Debilidades'} items={analyze.weaknesses.map((s) => s.label)} tone="rose" />
            <MapColumn title={es ? 'Potenciales' : 'Potenciais'} items={analyze.potentials.map((s) => s.label)} tone="amber" />
          </div>

          <button
            type="button"
            onClick={() => {
              setAnalyze((prev) =>
                prev
                  ? {
                      ...prev,
                      inferredStage: inferred,
                      technicalBrief: brief,
                      intervention,
                      strategicDraft: prev.strategicDraft || buildStrategicDraft(brief, loc),
                    }
                  : prev
              );
              setAnalysisValidated(false);
              setPhase('validate');
            }}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
          >
            {es ? 'Validar este análisis →' : 'Validar esta análise →'}
          </button>
              </>
            );
          })()}
        </div>
      )}

      {phase === 'validate' && analyze && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="font-semibold text-slate-900">
            {es ? 'Validación del análisis' : 'Validação da análise'}
          </h3>
          <p className="text-sm text-slate-600">
            {es
              ? 'Antes de proponer intervención: ¿el mapa refleja la realidad de la MIPYME? Puede volver atrás o confirmar.'
              : 'Antes de propor intervenção: o mapa reflete a realidade da MIPYME? Pode voltar atrás ou confirmar.'}
          </p>
          <ul className="space-y-1 text-sm text-slate-700">
            {(analyze.priorities || []).slice(0, 6).map((p, i) => (
              <li key={i}>· {p}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setPhase('analysis')} className="rounded-lg border px-4 py-2 text-sm">
              {es ? 'Ajustar lectura' : 'Ajustar leitura'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAnalysisValidated(true);
                setPhase('dialogue');
              }}
              className="rounded-xl bg-teal-800 px-4 py-2 text-sm font-medium text-white"
            >
              {es ? 'Análisis validado → diálogo' : 'Análise validada → diálogo'}
            </button>
          </div>
        </div>
      )}

      {phase === 'dialogue' && analyze && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          {(() => {
            const brief =
              analyze.technicalBrief ||
              buildTechnicalBrief(sectorId, analyze.computed, answers, loc);
            const intervention =
              analyze.intervention || buildInterventionNarrative(brief, loc);
            return (
              <>
          <h3 className="font-semibold text-slate-900">
            {es ? 'Propuesta de intervención (diálogo)' : 'Proposta de intervenção (diálogo)'}
          </h3>
          <p className="text-sm text-slate-700">{intervention.opening}</p>
          <div className="space-y-3">
            {intervention.levers.map((lever, i) => (
              <div key={i} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-sm">
                <p className="font-medium text-slate-900">{lever.title}</p>
                <p className="mt-1 text-slate-600">{lever.why}</p>
                <p className="mt-2 text-teal-900">{lever.approach}</p>
              </div>
            ))}
          </div>
          <p className="text-xs font-medium text-slate-500">{intervention.dialoguePrompt}</p>
          <textarea
            value={dialogueNotes}
            onChange={(e) => setDialogueNotes(e.target.value)}
            rows={4}
            placeholder={
              es
                ? 'Escriba aquí acuerdos, correcciones y prioridades del diálogo…'
                : 'Escreva aqui acordos, correções e prioridades do diálogo…'
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => setPhase('strategy')}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white"
          >
            {es ? 'Construir plan estratégico →' : 'Construir plano estratégico →'}
          </button>
              </>
            );
          })()}
        </div>
      )}

      {phase === 'strategy' && analyze && (
        <div className="space-y-4">
          {(() => {
            const draft =
              dialogueNotes.trim() && analyze.technicalBrief
                ? buildStrategicDraft(analyze.technicalBrief, loc, dialogueNotes)
                : analyze.strategicDraft;
            if (!draft) return null;
            return (
              <>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
                  <h3 className="font-semibold text-indigo-950">
                    {es ? 'Plan estratégico de ejecución' : 'Plano estratégico de execução'}
                  </h3>
                  <p className="mt-1 text-xs text-indigo-900">
                    {es
                      ? 'Incluye modelo de negocio, plan comercial y ejecución (actividades, contrataciones, herramientas).'
                      : 'Inclui modelo de negócio, plano comercial e execução (atividades, contratações, ferramentas).'}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border bg-white p-4 text-sm">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {es ? 'Modelo de negocio' : 'Modelo de negócio'}
                    </p>
                    <ul className="mt-2 space-y-1.5 text-slate-700">
                      <li>· {draft.businessModel.valueProp}</li>
                      <li>· {draft.businessModel.customers}</li>
                      <li>· {draft.businessModel.channels}</li>
                      <li>· {draft.businessModel.revenue}</li>
                      <li>· {draft.businessModel.costs}</li>
                    </ul>
                  </div>
                  <div className="rounded-xl border bg-white p-4 text-sm">
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {es ? 'Plan comercial' : 'Plano comercial'}
                    </p>
                    <p className="mt-2 font-medium text-slate-900">{draft.commercialPlan.focus}</p>
                    <ul className="mt-2 space-y-1 text-slate-700">
                      {draft.commercialPlan.actions.map((a, i) => (
                        <li key={i}>· {a}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-slate-500">
                      KPIs: {draft.commercialPlan.kpis.join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border bg-white p-4 text-sm">
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {es ? 'Ejecución' : 'Execução'}
                  </p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="font-medium">{es ? 'Contrataciones' : 'Contratações'}</p>
                      <ul className="mt-1 text-xs text-slate-600">
                        {draft.execution.hires.map((x, i) => (
                          <li key={i}>· {x}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">{es ? 'Compras' : 'Compras'}</p>
                      <ul className="mt-1 text-xs text-slate-600">
                        {(draft.execution.purchases || []).map((x, i) => (
                          <li key={i}>· {x}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">{es ? 'Indicadores' : 'Indicadores'}</p>
                      <ul className="mt-1 text-xs text-slate-600">
                        {(draft.execution.indicators || []).map((x, i) => (
                          <li key={i}>· {x}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">{es ? 'Herramientas' : 'Ferramentas'}</p>
                      <ul className="mt-1 text-xs text-slate-600">
                        {draft.execution.tools.map((x, i) => (
                          <li key={i}>· {x}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium">{es ? 'Hitos' : 'Marcos'}</p>
                      <ul className="mt-1 text-xs text-slate-600">
                        {draft.execution.milestones.map((x, i) => (
                          <li key={i}>· {x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-teal-900">{draft.nextDialogueQuestion}</p>
                </div>
              </>
            );
          })()}
          <button type="button" onClick={() => setPhase('workplan')} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">
            {es ? 'Actividades de la ruta viva →' : 'Atividades da rota viva →'}
          </button>
        </div>
      )}

      {phase === 'workplan' && (
        <div className="space-y-4">
          {sectorId ? (
            <p className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2 text-sm text-teal-950">
              {moduleL(getSectorModule(sectorId).intro, loc)}{' '}
              <span className="text-xs text-teal-800">
                · {moduleL(getSectorModule(sectorId).bookLabel, loc)} / {moduleL(getSectorModule(sectorId).monitorLabel, loc)}
              </span>
            </p>
          ) : null}
          <p className="text-sm text-slate-600">
            {es
              ? 'Cada brecha del diagnóstico abre una acción en el módulo (cuaderno, unidad o sensor) — no un texto genérico de AT.'
              : 'Cada lacuna do diagnóstico abre uma ação no módulo (caderno, unidade ou sensor) — não um texto genérico de AT.'}
          </p>
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
                        {it.dueMonth ? ` · M${it.dueMonth}` : ''}
                        {it.spendType && it.spendType !== 'action' ? ` · ${it.spendType}` : ''}
                      </span>
                      {it.description ? (
                        <span className="mt-0.5 block text-xs text-slate-500">{it.description}</span>
                      ) : null}
                      {it.kpi ? (
                        <span className="mt-0.5 block text-[11px] text-teal-800">
                          {es ? 'Indicador' : 'Indicador'}: {it.kpi}
                        </span>
                      ) : null}
                      {it.href ? (
                        <Link
                          href={moduleActionHref(it.href, {
                            companyId: targetCompanyId || null,
                            engagementId: engagementParam || program.atEngagementId || null,
                          })}
                          className="mt-1 inline-block text-[11px] font-medium text-teal-800 underline-offset-2 hover:underline"
                        >
                          {it.href === 'monitor'
                            ? es
                              ? 'Abrir monitoreo →'
                              : 'Abrir monitorização →'
                            : es
                              ? 'Abrir cuaderno del módulo →'
                              : 'Abrir caderno do módulo →'}
                        </Link>
                      ) : null}
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
            disabled={committing || selectedIds.size === 0 || !analysisValidated}
            onClick={() => void commitPlan()}
            className="rounded-xl bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {committing
              ? '…'
              : es
                ? `Registrar ${selectedIds.size} acciones en la ruta viva`
                : `Registar ${selectedIds.size} ações na rota viva`}
          </button>
          {!analysisValidated && (
            <p className="text-xs text-amber-800">
              {es
                ? 'Valide el análisis y complete el diálogo antes de registrar la ruta.'
                : 'Valide a análise e complete o diálogo antes de registar a rota.'}
            </p>
          )}
        </div>
      )}

      {phase === 'summary' && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-3">
          <p className="font-semibold text-emerald-950">{es ? 'Processo registado' : 'Processo registado'}</p>
          <p className="text-sm text-emerald-900">
            {es
              ? 'Plan de desarrollo y diagnóstico guardados. Si había un servicio vinculado, se abrieron casos de asistencia.'
              : 'Plano de desenvolvimento e diagnóstico guardados. Se havia um serviço vinculado, foram abertos casos de assistência.'}
          </p>
          {programLoopsAnnually(program) ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
              {es
                ? 'Contrato permanente: al cierre del año hay que hacer el análisis anual y repetir el diagnóstico 360 para un nuevo plan.'
                : 'Contrato permanente: no fecho do ano faz-se a análise anual e repete-se o diagnóstico 360 para um novo plano.'}
            </p>
          ) : (
            <p className="text-xs text-emerald-800">
              {es
                ? 'Contrato de proyecto o puntual: el ciclo cierra con la entrega. Un nuevo contrato abre otro 360.'
                : 'Contrato de projeto ou pontual: o ciclo fecha com a entrega. Um novo contrato abre outro 360.'}
            </p>
          )}
          {commitResult?.atCaseIds && commitResult.atCaseIds.length > 0 && (
            <p className="text-xs text-emerald-800">
              {commitResult.atCaseIds.length} {es ? 'casos AT criados' : 'casos AT criados'}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href={moduleActionHref('campo', {
                companyId: targetCompanyId || null,
                engagementId: commitResult?.engagementId || program.atEngagementId || engagementParam || null,
              })}
              className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white"
            >
              {es ? 'Abrir cuaderno del módulo' : 'Abrir caderno do módulo'}
            </Link>
            <Link
              href={moduleActionHref('monitor', {
                companyId: targetCompanyId || null,
                engagementId: commitResult?.engagementId || program.atEngagementId || engagementParam || null,
              })}
              className="rounded-lg border border-teal-300 bg-teal-50 px-4 py-2 text-sm text-teal-900"
            >
              {es ? 'Monitoreo / sensores' : 'Monitorização / sensores'}
            </Link>
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
