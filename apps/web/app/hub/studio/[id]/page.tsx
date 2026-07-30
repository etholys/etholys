'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Save,
  Send,
  PenLine,
  Check,
  X,
  FileDown,
  FileType,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import type {
  StudioCanvasState,
  StudioConsentRequest,
  StudioBlock,
} from '@/lib/studio/types';
import { StudioMermaidPreview } from '@/components/studio/StudioMermaidPreview';

type ChatMsg = { id: string; role: string; content: string };

export default function StudioDocumentPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const { locale, activeCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  const [title, setTitle] = useState('');
  const [canvas, setCanvas] = useState<StudioCanvasState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [consent, setConsent] = useState<StudioConsentRequest | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!id || !companyId) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/studio/documents/${id}?companyId=${encodeURIComponent(companyId)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);
      setTitle(d.document.title);
      setCanvas(d.document.canvasState as StudioCanvasState);
      setDirty(false);

      const mr = await fetch(`/api/studio/documents/${id}/copilot?companyId=${encodeURIComponent(companyId)}`);
      if (mr.ok) {
        const md = await mr.json();
        setMessages(
          (md.messages || []).map((m: { id: string; role: string; content: string }) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          })),
        );
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [id, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, consent]);

  function updateBlock(pageId: string, blockId: string, text: string) {
    setCanvas((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pages: prev.pages.map((p) =>
          p.id !== pageId
            ? p
            : {
                ...p,
                blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, text } : b)),
              },
        ),
      };
    });
    setDirty(true);
  }

  async function save() {
    if (!canvas || !companyId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/studio/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, title, canvasState: canvas }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error);
      setDirty(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function sendChat(opts?: { text?: string; approvedSources?: string[] }) {
    const text = (opts?.text ?? input).trim();
    if (!text || !canvas || !companyId || chatBusy) return;
    setChatBusy(true);
    setConsent(null);
    setInput('');
    const tempId = `local-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'user', content: text }]);

    try {
      const r = await fetch(`/api/studio/documents/${id}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          locale,
          message: text,
          canvasState: canvas,
          approvedSources: opts?.approvedSources || [],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);

      if (d.canvasState) {
        setCanvas(d.canvasState as StudioCanvasState);
        setDirty(false);
      }
      if (typeof d.title === 'string' && d.title) setTitle(d.title);
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'assistant', content: d.message || '…' }]);

      if (d.consentRequest?.question && Array.isArray(d.consentRequest.sources)) {
        setConsent(d.consentRequest as StudioConsentRequest);
        setPendingPrompt(text);
      } else {
        setPendingPrompt(null);
      }
    } catch (e: unknown) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Erro no copiloto',
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  async function exportFile(format: 'pdf' | 'docx') {
    if (!canvas || !companyId) return;
    setExporting(format);
    try {
      if (dirty) await save();
      const r = await fetch(`/api/studio/documents/${id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, format, title, canvasState: canvas }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.detail || d.error || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(title || 'studio').replace(/[^\w\-]+/g, '_').slice(0, 60)}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro no export');
    } finally {
      setExporting(null);
    }
  }

  function approveConsent() {
    if (!consent || !pendingPrompt) return;
    const sources = consent.sources.map((s) => s.id);
    setConsent(null);
    void sendChat({ text: pendingPrompt, approvedSources: sources });
  }

  function denyConsent() {
    setConsent(null);
    setPendingPrompt(null);
    setMessages((m) => [
      ...m,
      {
        id: `deny-${Date.now()}`,
        role: 'assistant',
        content: t(
          'Ok — continuo sem esses dados da empresa. Peça outra abordagem ou escreva o que precisa.',
          'Ok — continúo sin esos datos. Pida otro enfoque o escriba lo que necesita.',
          'OK — continuing without that company data. Ask another way or type what you need.',
        ),
      },
    ]);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        {t('A carregar documento…', 'Cargando documento…', 'Loading document…')}
      </div>
    );
  }

  if (error || !canvas) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-700">{error || 'Not found'}</p>
        <Link href="/hub/studio" className="mt-4 inline-block text-amber-800 underline">
          Studio
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/hub/studio" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <PenLine className="hidden h-4 w-4 text-orange-600 sm:block" />
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-slate-900 outline-none focus:ring-0 sm:text-lg"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void exportFile('docx')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {exporting === 'docx' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType className="h-4 w-4" />}
            DOCX
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void exportFile('pdf')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {exporting === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            PDF
          </button>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('Guardar', 'Guardar', 'Save')}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Canvas */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-3xl space-y-8">
            {canvas.pages.map((page) => (
              <section
                key={page.id}
                className="rounded-sm border border-slate-200 bg-white px-8 py-10 shadow-sm sm:px-12"
              >
                <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {page.title}
                </p>
                <div className="space-y-6">
                  {page.blocks.map((block) => (
                    <BlockEditor
                      key={block.id}
                      block={block}
                      onChange={(text) => updateBlock(page.id, block.id, text)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Chat */}
        <aside className="flex h-[42vh] shrink-0 flex-col border-t border-slate-200 bg-white lg:h-auto lg:w-[380px] lg:border-l lg:border-t-0">
          <div className="border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">
              {t('Agente Studio', 'Agente Studio', 'Studio agent')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t(
                'Pede consentimento antes de usar dados da empresa.',
                'Pide consentimiento antes de usar datos de la empresa.',
                'Asks consent before using company data.',
              )}
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                {t(
                  'Ex.: «Escreve o resumo executivo» ou «Desenha o fluxo de aprovação».',
                  'Ej.: «Escribe el resumen ejecutivo» o «Dibuja el flujo de aprobación».',
                  'E.g. “Write the executive summary” or “Draw the approval flow”.',
                )}
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user' ? 'ml-6 bg-orange-50 text-slate-900' : 'mr-4 bg-slate-50 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            ))}
            {consent && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
                <p className="font-semibold">{consent.question}</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {consent.sources.map((s) => (
                    <li key={s.id}>
                      · {s.label}
                      {s.system ? ` (${s.system})` : ''}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={approveConsent}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-700 px-2 py-1.5 text-xs font-semibold text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('Sim, usar', 'Sí, usar', 'Yes, use')}
                  </button>
                  <button
                    type="button"
                    onClick={denyConsent}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-semibold text-amber-900"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('Não', 'No', 'No')}
                  </button>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <form
            className="flex gap-2 border-t border-slate-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void sendChat();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={chatBusy}
              placeholder={t('Pedir ao agente…', 'Pedir al agente…', 'Ask the agent…')}
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-400"
            />
            <button
              type="submit"
              disabled={chatBusy || !input.trim()}
              className="rounded-lg bg-orange-600 p-2 text-white disabled:opacity-40"
            >
              {chatBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}

function BlockEditor({ block, onChange }: { block: StudioBlock; onChange: (text: string) => void }) {
  const isHeading = block.kind === 'heading';
  const isDiagram = block.kind === 'diagram';

  return (
    <div>
      {block.title && (
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
          {block.title}
        </label>
      )}
      {isDiagram ? (
        <div className="space-y-2">
          <textarea
            value={block.text}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none focus:border-orange-400"
            spellCheck={false}
          />
          <StudioMermaidPreview source={block.text} />
        </div>
      ) : (
        <textarea
          value={block.text}
          onChange={(e) => onChange(e.target.value)}
          rows={isHeading ? 2 : block.kind === 'bullets' ? 5 : 4}
          className={`w-full resize-y border-0 bg-transparent p-0 outline-none focus:ring-0 ${
            isHeading
              ? 'text-2xl font-bold leading-snug text-slate-900'
              : 'text-[15px] leading-relaxed text-slate-800'
          }`}
          placeholder={block.title || '…'}
        />
      )}
    </div>
  );
}
