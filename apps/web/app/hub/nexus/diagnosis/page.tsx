'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/app/providers';
import {
  NEXUS_DIAGNOSTIC_QUIZ,
  computeDiagnosticResult,
  flattenDiagnosticQuiz,
  type QuizSector,
} from '@/lib/nexus-diagnostic-quiz';
import { touchRunwayChapter } from '@/lib/nexus-runway';
import { appendDiagnosisSnapshot } from '@/lib/nexus-diagnosis-history';

type NetworkDetail = {
  id: string;
  name: string;
  anchorCompanyId: string;
  siepProject: { id: string; name: string; companyId: string } | null;
  members: Array<{
    companyId: string;
    company: { name: string; shortName: string };
    siepProject: { id: string; name: string; companyId: string } | null;
  }>;
};

type Phase = 'welcome' | 'question' | 'summary';

const PERSIST_KEY = 'nexus-diagnosis-session-v1';

function loadQuizState(flatLen: number): { phase: Phase; idx: number; answers: Record<string, string> } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as {
      phase?: string;
      idx?: number;
      answers?: Record<string, string>;
      flatLen?: number;
    };
    if (j.flatLen !== flatLen) return null;
    if (j.phase !== 'question' && j.phase !== 'summary') return null;
    const idx = Number.isFinite(j.idx) ? Math.trunc(j.idx as number) : 0;
    const answers = j.answers && typeof j.answers === 'object' ? j.answers : {};
    return { phase: j.phase as Phase, idx, answers };
  } catch {
    return null;
  }
}

function NexusDiagnosisInner() {
  const { activeCompanyId } = useApp();
  const searchParams = useSearchParams();
  const networkId = searchParams.get('network');
  const historyAnswersSig = useRef<string | null>(null);

  const [sectors, setSectors] = useState<QuizSector[]>(NEXUS_DIAGNOSTIC_QUIZ);
  const [quizBooting, setQuizBooting] = useState(true);
  const [quizSource, setQuizSource] = useState<'default' | 'file'>('default');

  const [phase, setPhase] = useState<Phase>('welcome');
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [network, setNetwork] = useState<NetworkDetail | null>(null);
  const [targetCompanyId, setTargetCompanyId] = useState('');
  const [onlyWithSiepContext, setOnlyWithSiepContext] = useState(false);

  const flat = useMemo(() => flattenDiagnosticQuiz(sectors), [sectors]);
  const total = flat.length;

  useEffect(() => {
    if (phase === 'summary') touchRunwayChapter('diagnosis');
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/nexus/diagnostic-quiz', { cache: 'no-store' });
        const d = (await r.json()) as {
          sectors?: QuizSector[];
          source?: string;
        };
        if (cancelled) return;
        if (Array.isArray(d.sectors) && d.sectors.length > 0) {
          setSectors(d.sectors);
          setQuizSource(d.source === 'file' ? 'file' : 'default');
          const len = flattenDiagnosticQuiz(d.sectors).length;
          const saved = loadQuizState(len);
          if (saved) {
            setPhase(saved.phase);
            setIdx(Math.min(Math.max(0, saved.idx), Math.max(0, len - 1)));
            setAnswers(saved.answers);
          }
        }
      } catch {
        // mantém questionário embutido
      } finally {
        if (!cancelled) setQuizBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (total === 0) return;
    setIdx((i) => Math.min(Math.max(0, i), total - 1));
  }, [total]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (phase === 'welcome') {
      sessionStorage.removeItem(PERSIST_KEY);
      return;
    }
    try {
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify({ phase, idx, answers, flatLen: total }));
    } catch {
      // quota / modo privado
    }
  }, [phase, idx, answers, total]);

  useEffect(() => {
    if (!networkId) {
      setNetwork(null);
      setTargetCompanyId('');
      return;
    }
    let cancelled = false;
    (async () => {
      const r = await fetch(`/api/nexus/networks/${encodeURIComponent(networkId)}`);
      const d = await r.json();
      if (cancelled) return;
      if (r.ok && d.network) {
        setNetwork(d.network);
        setTargetCompanyId(d.network.anchorCompanyId || '');
      } else {
        setNetwork(null);
        setTargetCompanyId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [networkId]);

  const current = flat[idx];
  const prevEntry = idx > 0 ? flat[idx - 1] : null;
  const isFirstOfSector = Boolean(current && (!prevEntry || prevEntry.sector.id !== current.sector.id));

  const answeredCount = useMemo(() => {
    let n = 0;
    for (const { question } of flat) {
      if (answers[question.id]) n += 1;
    }
    return n;
  }, [answers, flat]);

  const result = useMemo(() => computeDiagnosticResult(sectors, answers), [sectors, answers]);

  const selectableMembers = useMemo(
    () =>
      (network?.members || []).filter((m) =>
        onlyWithSiepContext ? Boolean(m.siepProject?.id || network?.siepProject?.id) : true
      ),
    [network, onlyWithSiepContext]
  );

  useEffect(() => {
    if (!networkId || !network) return;
    const hasCurrent = selectableMembers.some((m) => m.companyId === targetCompanyId);
    if (!hasCurrent) {
      setTargetCompanyId(selectableMembers[0]?.companyId || '');
    }
  }, [networkId, network, selectableMembers, targetCompanyId]);

  const selectedMember = network?.members.find((m) => m.companyId === targetCompanyId) || null;
  const selectedSiepName = selectedMember?.siepProject?.name || network?.siepProject?.name || null;

  const startQuiz = () => {
    historyAnswersSig.current = null;
    try {
      sessionStorage.removeItem(PERSIST_KEY);
      sessionStorage.removeItem(`nexus_dx_hist_sig:${activeCompanyId ?? 'noc'}:${networkId ?? 'nonet'}`);
    } catch {
      /* ignore */
    }
    setIdx(0);
    setAnswers({});
    setMsg(null);
    setPhase('question');
  };

  useEffect(() => {
    if (phase !== 'summary' || quizBooting || total === 0) return;
    if (answeredCount < total) return;
    const sig = Object.keys(answers)
      .sort()
      .map((k) => `${k}=${answers[k]}`)
      .join('&');
    const sigKey = `nexus_dx_hist_sig:${activeCompanyId ?? 'noc'}:${networkId ?? 'nonet'}`;
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(sigKey) === sig) return;
    } catch {
      /* ignore */
    }
    if (historyAnswersSig.current === sig) return;
    historyAnswersSig.current = sig;
    try {
      sessionStorage.setItem(sigKey, sig);
    } catch {
      /* ignore */
    }
    appendDiagnosisSnapshot(
      { companyId: activeCompanyId ?? null, networkId: networkId ?? null },
      result,
    );
  }, [
    phase,
    quizBooting,
    total,
    answeredCount,
    answers,
    result,
    activeCompanyId,
    networkId,
  ]);

  const pickOption = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const goNext = useCallback(() => {
    if (phase === 'question' && current) {
      if (!answers[current.question.id]) return;
      if (idx >= total - 1) {
        setPhase('summary');
        return;
      }
      setIdx(idx + 1);
    }
  }, [phase, current, answers, idx, total]);

  const goPrev = () => {
    if (phase === 'summary') {
      setPhase('question');
      setIdx(total - 1);
      return;
    }
    if (phase === 'question') {
      if (idx === 0) {
        try {
          sessionStorage.removeItem(PERSIST_KEY);
        } catch {
          /* ignore */
        }
        setPhase('welcome');
        return;
      }
      setPhase('question');
      setIdx(idx - 1);
    }
  };

  const createRoadmapFromDiagnosis = async () => {
    setSaving(true);
    setMsg(null);
    try {
      if (networkId && !targetCompanyId) {
        setMsg('Escolha a empresa alvo dentro da rede.');
        return;
      }
      const targets =
        result.weakestSectors.length > 0
          ? result.weakestSectors
          : [...result.sectors].sort((a, b) => a.score - b.score).slice(0, 3);

      if (targets.length === 0) {
        setMsg('Sem dados de sectores para priorizar.');
        return;
      }

      for (const sector of targets) {
        const weakAreas = sector.areas
          .filter((a) => a.score < 62)
          .map((a) => `${a.areaName} (${a.score})`)
          .slice(0, 4);
        const focus =
          sector.lowSignals[0] ||
          weakAreas[0] ||
          'Rever processos e indicadores deste sector com a equipa.';
        const areaLine =
          weakAreas.length > 0
            ? `Áreas mais frágeis: ${weakAreas.join('; ')}.`
            : 'Rever equilíbrio geral do sector.';

        const r = await fetch('/api/nexus/roadmap-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `Rota de desenvolvimento — ${sector.sectorName}`,
            description: `Gerado pelo diagnóstico Nexus (quiz por sectores). Score do sector: ${sector.score}/100. ${areaLine} Primeiro foco: ${focus}`,
            priority: sector.score < 45 ? 'HIGH' : 'MEDIUM',
            pillar: sector.sectorSlug,
            ...(networkId ? { networkId, targetCompanyId } : {}),
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Falha ao criar ação');
      }
      setMsg(`Foram criadas ${targets.length} ação(ões) de rota alinhadas aos sectores prioritários.`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao gerar ações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {networkId && network && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          Modo rede: <strong>{network.name}</strong>. As ações de rota serão criadas na empresa selecionada.
          <label className="mt-2 block text-xs font-medium text-indigo-800">
            <input
              type="checkbox"
              checked={onlyWithSiepContext}
              onChange={(e) => setOnlyWithSiepContext(e.target.checked)}
              className="mr-2 align-middle"
            />
            Mostrar apenas empresas com contexto SIEP
          </label>
          <label className="mt-2 block text-xs font-medium text-indigo-800">
            Empresa alvo
            <select
              value={
                selectableMembers.some((m) => m.companyId === targetCompanyId)
                  ? targetCompanyId
                  : selectableMembers[0]?.companyId ?? ''
              }
              onChange={(e) => setTargetCompanyId(e.target.value)}
              disabled={selectableMembers.length === 0}
              className="mt-1 w-full max-w-md rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100"
            >
              {selectableMembers.length === 0 ? (
                <option value="">Nenhuma empresa corresponde a este filtro</option>
              ) : (
                selectableMembers.map((m) => (
                  <option key={m.companyId} value={m.companyId}>
                    {m.company.shortName || m.company.name}
                  </option>
                ))
              )}
            </select>
          </label>
          {selectableMembers.length === 0 && (
            <p className="mt-2 text-xs text-amber-800">
              Desactive &quot;Mostrar apenas empresas com contexto SIEP&quot; ou associe projetos SIEP aos membros da
              rede.
            </p>
          )}
          {selectedSiepName && (
            <p className="mt-2 text-xs text-indigo-800">
              Contexto SIEP efetivo desta empresa: <strong>{selectedSiepName}</strong>
            </p>
          )}
        </div>
      )}

      {quizBooting && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-indigo-700" />
          A carregar questionário…
        </div>
      )}

      {!quizBooting && phase === 'welcome' && (
        <div className="flex max-w-2xl flex-col gap-3">
          <p className="text-sm text-gray-700">
            Questionário por sectores e áreas. No fim obtém um mapa de maturidade e pode gerar ações na rota viva.
          </p>
          <p className="text-xs text-gray-500">
            {total} perguntas · {sectors.length} sectores
            {quizSource === 'file' ? (
              <span className="ml-2 font-medium text-emerald-800">(configuração local quiz.json)</span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={startQuiz}
            disabled={total === 0}
            className="w-fit rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Começar
          </button>
        </div>
      )}

      {!quizBooting && phase === 'question' && !current && (
        <p className="text-sm text-red-700">
          Não foi possível carregar as perguntas (lista vazia). Recarregue a página ou contacte o suporte.
        </p>
      )}

      {!quizBooting && phase === 'question' && current && (
        <div className="space-y-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300"
              style={{ width: `${Math.min(100, Math.round(((idx + 1) / total) * 100))}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              Pergunta {idx + 1} de {total}
            </span>
            <span>
              {answeredCount}/{total} respondidas
            </span>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-md sm:p-6">
            {isFirstOfSector && (
              <p className="mb-4 border-l-2 border-indigo-300 pl-3 text-sm leading-relaxed text-gray-600">
                <span className="font-medium text-gray-900">{current.sector.name}</span>
                <span className="text-gray-400"> · </span>
                {current.sector.intro}
              </p>
            )}
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-600">
              <span className="font-semibold text-gray-800">{current.sector.name}</span>
              <span aria-hidden="true">/</span>
              <span>{current.area.name}</span>
            </div>
            <h3 className="text-base font-semibold leading-snug text-gray-900 sm:text-lg">{current.question.prompt}</h3>
            <p className="mt-2 text-sm text-gray-600">{current.question.help}</p>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {current.question.options.map((o) => {
                const selected = answers[current.question.id] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => pickOption(current.question.id, o.id)}
                    className={`rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition ${
                      selected
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-950 shadow-sm'
                        : 'border-gray-200 bg-gray-50/50 text-gray-800 hover:border-indigo-300 hover:bg-white'
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={goPrev}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!answers[current.question.id]}
                onClick={goNext}
                className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {idx >= total - 1 ? 'Ver resultado' : 'Próxima'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!quizBooting && phase === 'summary' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2 text-xs text-emerald-950">
            <span>Sessão registada no histórico local deste contexto (empresa / rede).</span>
            <Link
              href={networkId ? `/hub/nexus/history?network=${encodeURIComponent(networkId)}` : '/hub/nexus/history'}
              className="font-semibold text-emerald-900 underline decoration-emerald-400/80 hover:text-emerald-800"
            >
              Ver histórico
            </Link>
          </div>
          <p className="text-sm text-gray-800">
            <strong>Score global:</strong> {result.overall}/100. Sectores e áreas abaixo indicam onde concentrar
            esforço.
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {result.sectors.map((s) => (
              <div key={s.sectorId} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">{s.sectorName}</h4>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      s.score >= 68
                        ? 'bg-emerald-100 text-emerald-800'
                        : s.score >= 52
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {s.score}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${
                      s.score >= 68 ? 'bg-emerald-500' : s.score >= 52 ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${s.score}%` }}
                  />
                </div>
                <ul className="mt-3 space-y-2 text-xs text-gray-600">
                  {s.areas.map((a) => (
                    <li key={a.areaId} className="flex justify-between gap-2 border-b border-gray-50 pb-1">
                      <span>{a.areaName}</span>
                      <span className="shrink-0 font-mono text-gray-800">{a.score}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {result.weakestAreas.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Áreas prioritárias</p>
              <ul className="mt-2 list-inside list-disc text-sm text-gray-800">
                {result.weakestAreas.map((a) => (
                  <li key={a.areaId}>
                    <strong>{a.areaName}</strong> ({a.score}) — {a.sectorSlug}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={saving}
              onClick={createRoadmapFromDiagnosis}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'A gerar…' : 'Gerar ações de rota a partir do diagnóstico'}
            </button>
            <button
              type="button"
              onClick={startQuiz}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Refazer quiz
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase('question');
                setIdx(total - 1);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Rever última pergunta
            </button>
          </div>
          {msg && <p className="text-sm text-gray-700">{msg}</p>}
        </div>
      )}

      {!quizBooting && phase !== 'summary' && msg && <p className="text-sm text-gray-700">{msg}</p>}
    </div>
  );
}

export default function NexusDiagnosisPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500/30 border-t-blue-600" />
        </div>
      }
    >
      <NexusDiagnosisInner />
    </Suspense>
  );
}
