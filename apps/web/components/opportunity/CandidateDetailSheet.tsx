'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import {
  availabilityBadgeClass,
  availabilityLabel,
  formatDateShort,
} from '@/lib/opportunity/availability';
import { pickInstitutionUrl, pickOfficialCallUrl } from '@/lib/opportunity/call-evidence';
import { buildCandidateWordHtml, downloadBlob } from '@/lib/opportunity/candidate-export';
import { StudioMarkdown } from '@/lib/studio/markdown-lite';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';
import {
  Bookmark,
  Check,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  ThumbsDown,
  X,
} from 'lucide-react';
import { PROPOSAL_CANDIDATE_KEY } from '@/lib/opportunity/proposal-workspace';

type FeedbackAction = 'save' | 'not_now' | 'reject_type';

export function CandidateDetailSheet({
  candidate: c,
  runId,
  open,
  onClose,
  busy,
  onFeedback,
  /** Página dedicada (nova janela) — sem overlay fullscreen. */
  variant = 'modal',
  initialTab,
}: {
  candidate: ScanCandidate;
  runId?: string | null;
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  onFeedback?: (
    action: FeedbackAction,
    opts?: { reasons?: string[]; note?: string },
  ) => void;
  variant?: 'modal' | 'page';
  initialTab?: 'overview' | 'analyze';
}) {
  const { locale, activeCompanyId } = useApp();
  const companyId = useMemo(() => {
    const s = String(activeCompanyId ?? '').trim();
    return isLikelyDbId(s) ? s : '';
  }, [activeCompanyId]);

  const t = (pt: string, es: string, en: string) =>
    locale === 'pt' ? pt : locale === 'es' ? es : en;

  const q = (path: string) =>
    `${path}${path.includes('?') ? '&' : '?'}companyId=${encodeURIComponent(companyId)}`;

  const [tab, setTab] = useState<'overview' | 'analyze'>(initialTab ?? 'overview');
  const [chat, setChat] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [input, setInput] = useState('');
  const [asking, setAsking] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [live, setLive] = useState(c);
  const [docsOpen, setDocsOpen] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab ?? 'overview');
    setChat([]);
    setInput('');
    setBrief(null);
    setRejectOpen(false);
    setDocsOpen(false);
    setLive(c);
  }, [open, c.tempId, initialTab, c]);

  useEffect(() => {
    if (!open || !companyId) return;
    const hasPage = Boolean(c.callUrl || c.linkOficial || c.sourceUrl);
    if (!hasPage) return;
    let cancelled = false;
    setEnriching(true);
    void (async () => {
      try {
        const r = await fetch(q('/api/opportunity/candidates/enrich'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate: c, runId: runId ?? c.runId, tempId: c.tempId }),
        });
        const d = (await r.json()) as { candidate?: typeof c };
        if (!cancelled && r.ok && d.candidate) setLive(d.candidate);
      } catch {
        /* keep the original candidate */
      } finally {
        if (!cancelled) setEnriching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // q/companyId are stable enough for this sheet open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, c.tempId, companyId, runId]);

  if (!open) return null;

  const countries = c.eligibleCountries ?? c.countries;
  const closes = c.closesAt ?? c.deadline;
  const opensLabel = formatDateShort(c.opensAt, locale);
  const closesLabel = formatDateShort(closes, locale);
  const previewHref =
    runId && c.tempId
      ? `/hub/fundhub/discover/c/${encodeURIComponent(c.tempId)}?runId=${encodeURIComponent(runId)}`
      : null;

  const ask = async (message: string, asBrief = false) => {
    if (!companyId) return;
    if (asBrief) setBriefLoading(true);
    else setAsking(true);
    try {
      const r = await fetch(q('/api/opportunity/candidates/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidate: live,
          message: asBrief ? undefined : message,
          mode: asBrief ? 'brief' : 'chat',
          history: asBrief ? undefined : chat,
        }),
      });
      const d = (await r.json()) as { reply?: string; error?: string };
      if (!r.ok) throw new Error(d.error || 'Erro');
      if (asBrief) {
        setBrief(d.reply ?? '');
      } else {
        setChat((prev) => [
          ...prev,
          { role: 'user', content: message },
          { role: 'assistant', content: d.reply ?? '' },
        ]);
        setInput('');
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Erro';
      if (asBrief) setBrief(err);
      else setChat((prev) => [...prev, { role: 'user', content: message }, { role: 'assistant', content: err }]);
    } finally {
      setAsking(false);
      setBriefLoading(false);
    }
  };

  const downloadDoc = async () => {
    let analysis = brief;
    if (!analysis) {
      setBriefLoading(true);
      try {
        const r = await fetch(q('/api/opportunity/candidates/analyze'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ candidate: live, mode: 'brief' }),
        });
        const d = (await r.json()) as { reply?: string };
        analysis = d.reply ?? '';
        setBrief(analysis);
      } finally {
        setBriefLoading(false);
      }
    }
    const blob = buildCandidateWordHtml({
      title: c.name,
      institution: c.institution,
      bodyMarkdownish: analysis || c.description || '',
      meta: {
        Tipo: c.type,
        Categoria: c.category,
        Montante:
          c.amount != null ? `${c.amount.toLocaleString()} ${c.currency ?? 'USD'}` : undefined,
        Janela: [opensLabel, closesLabel].filter(Boolean).join(' → ') || c.applicationWindow,
        Países: countries,
        'Quem pode candidatar': c.whoCanApply,
        Elegibilidade: c.eligibility,
        Requisitos: c.requirements,
        'Como candidatar': c.howToApply,
        Avisos: c.risksCaveats,
        Link: c.linkOficial,
        Match: c.matchScore != null ? `${Math.round(c.matchScore)}%` : undefined,
      },
    });
    const safe = c.name.replace(/[^\w\-]+/g, '_').slice(0, 60);
    downloadBlob(blob, `${safe || 'oportunidade'}.doc`);
  };

  const callPage = pickOfficialCallUrl(live);
  const institutionPage = pickInstitutionUrl(live);
  const docs = live.documents ?? [];

  const downloadOfficial = async (urls: string[], zip: boolean, key: string) => {
    if (!companyId || urls.length === 0) return;
    setDownloading(key);
    try {
      const r = await fetch(q('/api/opportunity/candidates/documents'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zip ? { urls, zip: true } : { url: urls[0] }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error || 'Falha no download');
      }
      const blob = await r.blob();
      const name = zip ? 'documentos-convocatoria.zip' : urls[0]?.split('/').pop()?.split('?')[0] || 'documento';
      downloadBlob(blob, decodeURIComponent(name));
    } catch (e) {
      setBrief((prev) => prev ?? (e instanceof Error ? e.message : 'Falha no download'));
    } finally {
      setDownloading(null);
    }
  };

  const shell =
    variant === 'page'
      ? 'flex w-full max-w-3xl flex-col rounded-2xl border border-gray-200 bg-white shadow-sm mx-auto'
      : 'flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl';

  const body = (
      <div role="dialog" className={shell}>
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-1.5">
              {c.availabilityStatus && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${availabilityBadgeClass(c.availabilityStatus)}`}
                >
                  {availabilityLabel(c.availabilityStatus, locale)}
                </span>
              )}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-700">
                {c.type}
              </span>
              {c.matchScore != null && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {Math.round(c.matchScore)}%
                </span>
              )}
            </div>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">{c.name}</h2>
            <p className="text-sm text-gray-600">{c.institution}</p>
          </div>
          {variant === 'modal' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex gap-1 border-b border-gray-100 px-4">
          {(
            [
              ['overview', t('Resumo', 'Resumen', 'Overview')],
              ['analyze', t('Analisar com IA', 'Analizar con IA', 'Analyze with AI')],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`border-b-2 px-3 py-2.5 text-sm font-medium ${
                tab === key
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'overview' && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                {(opensLabel || closesLabel || c.applicationWindow) && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                      {t('Janela', 'Ventana', 'Window')}
                    </p>
                    <p className="mt-0.5 font-medium text-white">
                      {opensLabel && closesLabel
                        ? `${opensLabel} → ${closesLabel}`
                        : closesLabel || opensLabel || c.applicationWindow}
                    </p>
                  </div>
                )}
                {c.amount != null && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                      {t('Montante', 'Monto', 'Amount')}
                    </p>
                    <p className="mt-0.5 font-medium text-white">
                      {c.amount.toLocaleString()} {c.currency ?? 'USD'}
                    </p>
                  </div>
                )}
                {countries && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2 sm:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                      {t('Países elegíveis', 'Países elegibles', 'Eligible countries')}
                    </p>
                    <p className="mt-0.5 flex gap-1 font-medium text-white">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                      {countries}
                    </p>
                  </div>
                )}
              </div>

              {c.description && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    {t('Descrição', 'Descripción', 'Description')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-100">
                    {c.description}
                  </p>
                </div>
              )}

              {(c.whoCanApply || c.eligibility || c.requirements) && (
                <div className="rounded-lg border border-gray-100 bg-slate-50/80 px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    {t(
                      'Resumo de requisitos / elegibilidade',
                      'Resumen de requisitos / elegibilidad',
                      'Requirements / eligibility summary',
                    )}
                  </p>
                  <div className="mt-2 space-y-3">
                    {c.whoCanApply && (
                      <div>
                        <p className="text-[11px] font-semibold text-white">
                          {t('Quem pode candidatar', 'Quién puede postular', 'Who can apply')}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-slate-100">{c.whoCanApply}</p>
                      </div>
                    )}
                    {c.eligibility && (
                      <div>
                        <p className="text-[11px] font-semibold text-white">
                          {t('Elegibilidade', 'Elegibilidad', 'Eligibility')}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-slate-100">{c.eligibility}</p>
                      </div>
                    )}
                    {c.requirements && (
                      <div>
                        <p className="text-[11px] font-semibold text-white">
                          {t('Requisitos-chave', 'Requisitos clave', 'Key requirements')}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-slate-100">{c.requirements}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {c.howToApply && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    {t('Como candidatar', 'Cómo postular', 'How to apply')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-100">{c.howToApply}</p>
                </div>
              )}

              {c.risksCaveats && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-amber-800/80">
                    {t('Riscos / avisos', 'Riesgos / avisos', 'Risks / caveats')}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-slate-100">{c.risksCaveats}</p>
                </div>
              )}

              {c.matchJustification && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-gray-500">
                    {t('Porquê este match', 'Por qué este match', 'Why this match')}
                  </p>
                  <p className="mt-1 text-slate-100">{c.matchJustification}</p>
                </div>
              )}
              {(c.availabilityNote || c.classificationNote) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase text-gray-500">
                    {t('Notas', 'Notas', 'Notes')}
                  </p>
                  <p className="mt-1 text-slate-200">
                    {[c.availabilityNote, c.classificationNote].filter(Boolean).join(' · ')}
                  </p>
                </div>
              )}

              {brief && (
                <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-amber-900">
                    {t('Resumo executivo (IA)', 'Resumen ejecutivo (IA)', 'Executive brief (AI)')}
                  </p>
                  <div className="mt-2 text-sm text-gray-800 [&_h2]:text-base [&_h3]:text-sm [&_h4]:text-sm [&_p]:text-sm">
                    <StudioMarkdown text={brief} />
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'analyze' && (
            <div className="flex h-full min-h-[280px] flex-col">
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={briefLoading}
                  onClick={() => void ask('', true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
                >
                  {briefLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                  {t('Gerar resumo executivo', 'Generar resumen ejecutivo', 'Generate executive brief')}
                </button>
                {(
                  [
                    t('Somos elegíveis?', '¿Somos elegibles?', 'Are we eligible?'),
                    t('Riscos principais?', '¿Riesgos principales?', 'Main risks?'),
                    t('Como candidatar?', '¿Cómo postular?', 'How to apply?'),
                  ] as string[]
                ).map((qHint) => (
                  <button
                    key={qHint}
                    type="button"
                    disabled={asking}
                    onClick={() => void ask(qHint)}
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-[10px] text-gray-700 hover:bg-gray-50"
                  >
                    {qHint}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-gray-100 bg-gray-50 p-3">
                {chat.length === 0 && (
                  <p className="text-xs text-gray-500">
                    {t(
                      'Pergunte o que quiser sobre este fundo — elegibilidade, prazos, estratégia…',
                      'Pregunte lo que quiera sobre este fondo…',
                      'Ask anything about this fund — eligibility, deadlines, strategy…',
                    )}
                  </p>
                )}
                {chat.map((m, i) => (
                  <div
                    key={`${i}-${m.role}`}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      m.role === 'user' ? 'ml-8 bg-white text-gray-900' : 'mr-4 bg-amber-50 text-gray-800'
                    }`}
                  >
                    {m.role === 'assistant' ? (
                      <div className="[&_h2]:text-base [&_h3]:text-sm [&_h4]:text-sm [&_p]:text-sm">
                        <StudioMarkdown text={m.content} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                ))}
                {asking && (
                  <p className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('A analisar…', 'Analizando…', 'Analyzing…')}
                  </p>
                )}
              </div>

              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (input.trim()) void ask(input.trim());
                }}
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('Escreva a sua pergunta…', 'Escriba su pregunta…', 'Write your question…')}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={asking || !input.trim()}
                  className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 px-5 py-3">
          <div className="flex flex-wrap gap-2">
            {onFeedback && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onFeedback('save', { reasons: ['more_like_this'] })}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  {t('Guardar + aprender', 'Guardar + aprender', 'Save + learn')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onFeedback('not_now')}
                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Clock className="h-3.5 w-3.5" />
                  {t('Não agora', 'No ahora', 'Not now')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRejectOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-800 hover:bg-red-100"
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  {t('Evitar este tipo', 'Evitar este tipo', 'Avoid this type')}
                </button>
              </>
            )}
            <Link
              href="/hub/fundhub/proposals?from=candidate"
              onClick={() => {
                try {
                  sessionStorage.setItem(PROPOSAL_CANDIDATE_KEY, JSON.stringify(live));
                } catch {
                  /* ignore */
                }
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
            >
              <FileText className="h-3.5 w-3.5" />
              {t('Proposta', 'Propuesta', 'Proposal')}
            </Link>
            <button
              type="button"
              disabled={briefLoading}
              onClick={() => void downloadDoc()}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {briefLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {t('Descarregar .doc', 'Descargar .doc', 'Download .doc')}
            </button>
            <button
              type="button"
              onClick={() => setDocsOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              {enriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              {t('Documentos', 'Documentos', 'Documents')}
              {docs.length > 0 ? ` (${docs.length})` : ''}
            </button>
            {callPage && (
              <a
                href={callPage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('Página da convocatória', 'Página de la convocatoria', 'Call page')}
              </a>
            )}
            {institutionPage && institutionPage !== callPage && (
              <a
                href={institutionPage}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Bookmark className="h-3.5 w-3.5" />
                {t('Site da instituição', 'Sitio de la institución', 'Institution site')}
              </a>
            )}
            {!callPage && (
              <span className="inline-flex items-center rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-medium text-amber-900">
                {t('Sem página oficial da convocatória', 'Sin página oficial de la convocatoria', 'No official call page')}
              </span>
            )}
            {previewHref && variant === 'modal' && (
              <Link
                href={previewHref}
                target="_blank"
                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t('Abrir em nova janela', 'Abrir en nueva ventana', 'Open in new window')}
              </Link>
            )}
          </div>

          {rejectOpen && onFeedback && (
            <div className="mt-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                placeholder={t(
                  'Porquê evitar este tipo? (ex.: só elegível para ministérios…)',
                  '¿Por qué evitar este tipo?',
                  'Why avoid this type?',
                )}
                className="w-full rounded-lg border border-red-200 px-3 py-2 text-xs"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onFeedback('reject_type', {
                    reasons: ['other'],
                    note: rejectNote.trim() || undefined,
                  });
                  setRejectOpen(false);
                }}
                className="mt-2 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
              >
                {t('Confirmar rejeição de tipo', 'Confirmar rechazo', 'Confirm type reject')}
              </button>
            </div>
          )}
        </div>
      </div>
  );

  const docsModal = docsOpen ? (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              {t('Documentos da convocatória', 'Documentos de la convocatoria', 'Call documents')}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {t(
                'Anexos oficiais para ler, para a IA e para a proposta.',
                'Anexos oficiales para leer, para la IA y para la propuesta.',
                'Official attachments for reading, AI, and the proposal.',
              )}
            </p>
          </div>
          <button type="button" onClick={() => setDocsOpen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>
        {enriching && (
          <p className="mt-3 flex items-center gap-2 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('A procurar anexos na página oficial…', 'Buscando anexos en la página oficial…', 'Looking for attachments on the official page…')}
          </p>
        )}
        {docs.length === 0 && !enriching && (
          <p className="mt-4 text-sm text-gray-600">
            {callPage
              ? t(
                  'Ainda sem anexos extraídos. Abra a página da convocatória — a IA usará esse endereço.',
                  'Aún sin anexos extraídos. Abra la página de la convocatoria.',
                  'No attachments extracted yet. Open the call page — AI will use that URL.',
                )
              : t(
                  'Sem página oficial da convocatória. Não descarregue nada até haver um edital real.',
                  'Sin página oficial de la convocatoria.',
                  'No official call page. Do not download until a real call exists.',
                )}
          </p>
        )}
        {docs.length > 0 && (
          <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
            {docs.map((doc) => (
              <li key={doc.url} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{doc.title}</p>
                  <p className="truncate text-[11px] text-gray-400">{doc.kind ?? 'file'}</p>
                </div>
                <button
                  type="button"
                  disabled={downloading !== null}
                  onClick={() => void downloadOfficial([doc.url], false, doc.url)}
                  className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
                >
                  {downloading === doc.url ? <Loader2 className="h-3 w-3 animate-spin" /> : t('Baixar', 'Descargar', 'Download')}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {docs.length > 1 && (
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => void downloadOfficial(docs.map((d) => d.url), true, 'zip')}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {downloading === 'zip' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              {t('Baixar todos (ZIP)', 'Descargar todos (ZIP)', 'Download all (ZIP)')}
            </button>
          )}
          {docs.length === 1 && (
            <button
              type="button"
              disabled={downloading !== null}
              onClick={() => void downloadOfficial([docs[0]!.url], false, docs[0]!.url)}
              className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              {t('Baixar ficheiro', 'Descargar archivo', 'Download file')}
            </button>
          )}
          {callPage && (
            <a
              href={callPage}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('Abrir convocatória', 'Abrir convocatoria', 'Open call')}
            </a>
          )}
        </div>
      </div>
    </div>
  ) : null;

  if (variant === 'page') {
    return (
      <>
        {body}
        {docsModal}
      </>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      {body}
      {docsModal}
    </div>
  );
}
