'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Loader2,
  Search,
  Sparkles,
  ListTodo,
  Copy,
  Check,
  Download,
  Video,
  Calendar,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { useEnsureActiveCompany } from '@/hooks/useEnsureActiveCompany';
import { CompanyRequiredPanel } from '@/components/hub/CompanyRequiredPanel';
import { meetRecapPath, meetRecapsPath, meetHubJoinPath } from '@/lib/meet/types';

type RecapListRow = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  endsAt: string | null;
  endedAt?: string | null;
  transcriptText?: string | null;
  summaryText?: string | null;
  projectId?: string | null;
  _count?: { participants?: number; actionItems?: number; transcriptSegments?: number };
};

type ActionItem = {
  id: string;
  title: string;
  notes: string | null;
  assigneeHint: string | null;
  status: string;
  taskId: string | null;
};

type RecapDetail = {
  id: string;
  title: string;
  status: string;
  scheduledAt: string | null;
  endsAt: string | null;
  endedAt?: string | null;
  summaryText: string | null;
  transcriptText: string | null;
  projectId: string | null;
  meetingUrl: string | null;
  actionItems: ActionItem[];
};

type TranscriptSegment = {
  messageId: string;
  participantName: string;
  text: string;
  startedAt: string;
};

type TabId = 'summary' | 'transcript' | 'actions';

function previewText(value?: string | null, max = 140): string {
  const clean = (value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

export function MeetRecapWorkspace({ sessionId }: { sessionId?: string }) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
  const {
    companies,
    companiesReady,
    companiesLoadError,
    companiesHttpStatus,
    companyId,
    setActiveCompanyId,
    reloadCompanies,
  } = useEnsureActiveCompany();

  const [rows, setRows] = useState<RecapListRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<RecapDetail | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [detailLoading, setDetailLoading] = useState(Boolean(sessionId));
  const [tab, setTab] = useState<TabId>('summary');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadList = useCallback(async () => {
    if (!companyId) return;
    setListLoading(true);
    try {
      const r = await fetch(`/api/meet/sessions?companyId=${encodeURIComponent(companyId)}&limit=200`);
      const d = (await r.json()) as { sessions?: RecapListRow[]; error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      setRows(d.sessions || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setListLoading(false);
    }
  }, [companyId]);

  const loadDetail = useCallback(async () => {
    if (!companyId || !sessionId) {
      setDetail(null);
      setSegments([]);
      setDetailLoading(false);
      return;
    }
    setDetailLoading(true);
    setError(null);
    try {
      const [sr, tr] = await Promise.all([
        fetch(`/api/meet/sessions/${sessionId}?companyId=${encodeURIComponent(companyId)}`),
        fetch(`/api/meet/sessions/${sessionId}/transcript?companyId=${encodeURIComponent(companyId)}`),
      ]);
      const sd = (await sr.json()) as { session?: RecapDetail; error?: string };
      const td = (await tr.json()) as { segments?: TranscriptSegment[]; transcriptText?: string };
      if (!sr.ok) throw new Error(sd.error || 'Error');
      const session = sd.session ?? null;
      if (session && !session.transcriptText && td.transcriptText) {
        session.transcriptText = td.transcriptText;
      }
      setDetail(session);
      setSegments(Array.isArray(td.segments) ? td.segments : []);
      if (!session?.summaryText && (session?.transcriptText || (td.segments && td.segments.length))) {
        setTab('transcript');
      } else {
        setTab('summary');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [companyId, sessionId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const scored = rows
      .map((row) => {
        const hasText = Boolean(
          (row.transcriptText && row.transcriptText.trim()) ||
            (row.summaryText && row.summaryText.trim()) ||
            (row._count?.transcriptSegments || 0) > 0,
        );
        return { row, hasText };
      })
      .filter(({ row }) => {
        if (!q) return true;
        const hay = `${row.title} ${row.summaryText || ''} ${row.transcriptText || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (a.hasText !== b.hasText) return a.hasText ? -1 : 1;
        const da = new Date(a.row.endedAt || a.row.scheduledAt || 0).getTime();
        const db = new Date(b.row.endedAt || b.row.scheduledAt || 0).getTime();
        return db - da;
      });
    return scored.map((x) => x.row);
  }, [rows, query]);

  const transcriptBody = useMemo(() => {
    if (detail?.transcriptText?.trim()) return detail.transcriptText.trim();
    if (segments.length) {
      return segments.map((s) => `${s.participantName}: ${s.text}`).join('\n');
    }
    return '';
  }, [detail?.transcriptText, segments]);

  async function generateSummary() {
    if (!companyId || !sessionId || transcriptBody.trim().length < 20) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/meet/sessions/${sessionId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          transcriptText: transcriptBody,
          endMeeting: false,
          replaceDrafts: true,
          locale,
        }),
      });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(d.error || 'Error');
      await loadDetail();
      await loadList();
      setTab('summary');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  async function copyTranscript() {
    if (!transcriptBody) return;
    try {
      await navigator.clipboard.writeText(transcriptBody);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function downloadTranscript() {
    if (!transcriptBody || !detail) return;
    const blob = new Blob([transcriptBody], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${detail.title.replace(/[^\w\-]+/g, '_').slice(0, 40)}-transcript.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatWhen(row: { scheduledAt?: string | null; endedAt?: string | null; endsAt?: string | null }) {
    const raw = row.endedAt || row.scheduledAt || row.endsAt;
    if (!raw) return t('Sem data', 'Sin fecha', 'No date');
    return new Date(raw).toLocaleString(intl, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href={companyId ? `/hub/meet?companyId=${encodeURIComponent(companyId)}` : '/hub/meet'}
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4" />
            CHORUS
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {t('Transcrições e resumos', 'Transcripciones y resúmenes', 'Transcripts & summaries')}
            </h1>
            <p className="hidden text-xs text-slate-500 sm:block">
              {t(
                'Todas as reuniões com texto, no estilo Otter / Read.ai',
                'Todas las reuniones con texto, al estilo Otter / Read.ai',
                'All meetings with text, Otter / Read.ai style',
              )}
            </p>
          </div>
        </div>
      </header>

      {!companyId ? (
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
          <CompanyRequiredPanel
            locale={locale}
            companies={companies}
            ready={companiesReady}
            error={companiesLoadError}
            httpStatus={companiesHttpStatus}
            activeCompanyId={companyId}
            onSelect={setActiveCompanyId}
            onRetry={() => void reloadCompanies()}
          />
        </main>
      ) : (
        <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col md:flex-row">
          <aside className="w-full shrink-0 border-b border-slate-200 bg-white md:w-[22rem] md:border-b-0 md:border-r">
            <div className="border-b border-slate-100 p-3">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t('Buscar reunião…', 'Buscar reunión…', 'Search meeting…')}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </label>
            </div>
            <div className="max-h-[40vh] overflow-y-auto md:max-h-none md:h-[calc(100vh-7.5rem)]">
              {listLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">
                  {t('Ainda não há reuniões nesta empresa.', 'Aún no hay reuniones en esta empresa.', 'No meetings in this company yet.')}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filtered.map((row) => {
                    const hasText = Boolean(
                      row.summaryText?.trim() ||
                        row.transcriptText?.trim() ||
                        (row._count?.transcriptSegments || 0) > 0,
                    );
                    const active = row.id === sessionId;
                    return (
                      <li key={row.id}>
                        <Link
                          href={meetRecapPath(row.id, companyId)}
                          className={`block px-4 py-3 hover:bg-slate-50 ${active ? 'bg-teal-50' : ''}`}
                        >
                          <p className={`truncate text-sm font-semibold ${active ? 'text-teal-900' : 'text-slate-900'}`}>
                            {row.title}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">{formatWhen(row)}</p>
                          <p className="mt-1 line-clamp-2 text-xs text-slate-600">
                            {previewText(row.summaryText) ||
                              previewText(row.transcriptText) ||
                              (hasText
                                ? t('Há transcrição', 'Hay transcripción', 'Has transcript')
                                : t('Sem transcrição ainda', 'Sin transcripción aún', 'No transcript yet'))}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          <main className="min-w-0 flex-1 px-4 py-5 sm:px-6">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            {!sessionId ? (
              <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
                <FileText className="h-10 w-10 text-slate-300" />
                <p className="mt-3 text-base font-semibold text-slate-800">
                  {t('Escolhe uma reunião à esquerda', 'Elige una reunión a la izquierda', 'Pick a meeting on the left')}
                </p>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  {t(
                    'Aqui vês a transcrição completa, o resumo e as tarefas. No calendário CHORUS, abre o evento e clica em Transcrição.',
                    'Aquí ves la transcripción completa, el resumen y las tareas. En el calendario CHORUS, abre el evento y pulsa Transcripción.',
                    'Here you see the full transcript, summary and tasks. From the CHORUS calendar, open the event and click Transcript.',
                  )}
                </p>
              </div>
            ) : detailLoading ? (
              <div className="flex min-h-[40vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
              </div>
            ) : !detail ? (
              <p className="text-sm text-slate-600">
                {t('Reunião não encontrada.', 'Reunión no encontrada.', 'Meeting not found.')}
              </p>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {t('Recap da reunião', 'Recap de la reunión', 'Meeting recap')}
                    </p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{detail.title}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatWhen(detail)}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase text-slate-600">
                        {detail.status}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detail.status !== 'ended' && detail.status !== 'cancelled' && (
                      <Link
                        href={meetHubJoinPath(detail.id, companyId)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        <Video className="h-3.5 w-3.5" />
                        {t('Entrar', 'Unirse', 'Join')}
                      </Link>
                    )}
                    <Link
                      href={meetRecapsPath(companyId)}
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 md:hidden"
                    >
                      {t('Todas', 'Todas', 'All')}
                    </Link>
                  </div>
                </div>

                <div className="flex gap-1 rounded-xl bg-slate-100 p-1">
                  {(
                    [
                      ['summary', t('Resumo', 'Resumen', 'Summary')],
                      ['transcript', t('Transcrição', 'Transcripción', 'Transcript')],
                      ['actions', t('Tarefas', 'Tareas', 'Tasks')],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
                        tab === id ? 'bg-white text-teal-800 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {tab === 'summary' && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    {detail.summaryText?.trim() ? (
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                        {detail.summaryText}
                      </pre>
                    ) : (
                      <div className="text-center">
                        <Sparkles className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2 text-sm font-medium text-slate-800">
                          {t('Ainda não há resumo', 'Aún no hay resumen', 'No summary yet')}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {transcriptBody.trim().length >= 20
                            ? t(
                                'Há transcrição. Gera o resumo com IA.',
                                'Hay transcripción. Genera el resumen con IA.',
                                'There is a transcript. Generate the AI summary.',
                              )
                            : t(
                                'Sem transcrição suficiente. Entra na reunião com o microfone ligado ou cola o texto na transcrição.',
                                'Sin transcripción suficiente. Entra a la reunión con el micrófono o pega el texto en Transcripción.',
                                'Not enough transcript. Join with the mic on, or paste text in Transcript.',
                              )}
                        </p>
                        {transcriptBody.trim().length >= 20 && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void generateSummary()}
                            className="mt-4 inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            {t('Gerar resumo', 'Generar resumen', 'Generate summary')}
                          </button>
                        )}
                      </div>
                    )}
                  </section>
                )}

                {tab === 'transcript' && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void copyTranscript()}
                        disabled={!transcriptBody}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {t('Copiar', 'Copiar', 'Copy')}
                      </button>
                      <button
                        type="button"
                        onClick={downloadTranscript}
                        disabled={!transcriptBody}
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {t('Descarregar .txt', 'Descargar .txt', 'Download .txt')}
                      </button>
                    </div>
                    {segments.length > 0 ? (
                      <ol className="space-y-4">
                        {segments.map((row) => (
                          <li key={row.messageId}>
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-semibold text-teal-800">{row.participantName}</span>
                              <time className="text-[10px] text-slate-400">
                                {new Date(row.startedAt).toLocaleTimeString(intl, {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </time>
                            </div>
                            <p className="mt-0.5 text-sm leading-relaxed text-slate-800">{row.text}</p>
                          </li>
                        ))}
                      </ol>
                    ) : transcriptBody ? (
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                        {transcriptBody}
                      </pre>
                    ) : (
                      <p className="text-sm text-slate-500">
                        {t(
                          'Esta reunião ainda não tem transcrição guardada.',
                          'Esta reunión aún no tiene transcripción guardada.',
                          'This meeting does not have a saved transcript yet.',
                        )}
                      </p>
                    )}
                  </section>
                )}

                {tab === 'actions' && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    {detail.actionItems?.length ? (
                      <ul className="space-y-3">
                        {detail.actionItems.map((item) => (
                          <li key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                            <p className="text-sm font-medium text-slate-900">{item.title}</p>
                            {item.notes && <p className="mt-0.5 text-xs text-slate-600">{item.notes}</p>}
                            <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{item.status}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-center text-sm text-slate-500">
                        <ListTodo className="mx-auto h-8 w-8 text-slate-300" />
                        <p className="mt-2">
                          {t(
                            'Ainda sem tarefas. Gera o resumo para a IA sugerir próximos passos.',
                            'Aún sin tareas. Genera el resumen para que la IA sugiera próximos pasos.',
                            'No tasks yet. Generate the summary so AI can suggest next steps.',
                          )}
                        </p>
                      </div>
                    )}
                  </section>
                )}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
