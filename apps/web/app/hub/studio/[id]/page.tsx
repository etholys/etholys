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
  Share2,
  Paperclip,
  BookMarked,
  Undo2,
  Redo2,
  History,
  Plus,
  LayoutTemplate,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import type {
  StudioBlock,
  StudioCanvasState,
  StudioConsentRequest,
  StudioPage,
  StudioPageSize,
} from '@/lib/studio/types';
import {
  STUDIO_PAGE_SIZES,
  normalizeStudioCanvas,
  studioPageCssSize,
} from '@/lib/studio/types';
import { StudioMermaidPreview } from '@/components/studio/StudioMermaidPreview';
import { StudioShareDialog } from '@/components/studio/StudioShareDialog';
import {
  StudioContextPanel,
  uploadStudioChatAttachment,
} from '@/components/studio/StudioContextPanel';

type ChatMsg = { id: string; role: string; content: string };
type VersionRow = { id: string; title: string; label: string | null; createdAt: string };
type MoldRow = {
  id: string;
  name: string;
  pageSize: string;
  imageUrl?: string;
  imagePath?: string;
};

const MAX_UNDO = 40;

export default function StudioDocumentPage() {
  const params = useParams();
  const id = String(params?.id || '');
  const { locale, activeCompanyId, setActiveCompanyId } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  const [title, setTitle] = useState('');
  const [canvas, setCanvas] = useState<StudioCanvasState | null>(null);
  const [docFolderId, setDocFolderId] = useState<string | null>(null);
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
  const [access, setAccess] = useState<string>('owner');
  const [shareOpen, setShareOpen] = useState(false);
  const [showFolderContext, setShowFolderContext] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [folderContextCount, setFolderContextCount] = useState(0);
  const [chatWidth, setChatWidth] = useState(400);
  const [undoStack, setUndoStack] = useState<StudioCanvasState[]>([]);
  const [redoStack, setRedoStack] = useState<StudioCanvasState[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [molds, setMolds] = useState<MoldRow[]>([]);
  const [showMolds, setShowMolds] = useState(false);
  const [activePageId, setActivePageId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const moldFileRef = useRef<HTMLInputElement | null>(null);
  const dragging = useRef(false);
  const skipHistory = useRef(false);

  const canEdit = access !== 'viewer' && access !== 'none';

  const pushHistory = useCallback((prev: StudioCanvasState) => {
    setUndoStack((s) => [...s.slice(-(MAX_UNDO - 1)), structuredClone(prev)]);
    setRedoStack([]);
  }, []);

  const applyCanvas = useCallback(
    (updater: (prev: StudioCanvasState) => StudioCanvasState, recordHistory = true) => {
      setCanvas((prev) => {
        if (!prev) return prev;
        if (recordHistory && !skipHistory.current) pushHistory(prev);
        return updater(prev);
      });
      setDirty(true);
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    setUndoStack((stack) => {
      if (!stack.length || !canvas) return stack;
      const prev = stack[stack.length - 1]!;
      setRedoStack((r) => [...r, structuredClone(canvas)]);
      skipHistory.current = true;
      setCanvas(prev);
      skipHistory.current = false;
      setDirty(true);
      return stack.slice(0, -1);
    });
  }, [canvas]);

  const redo = useCallback(() => {
    setRedoStack((stack) => {
      if (!stack.length || !canvas) return stack;
      const next = stack[stack.length - 1]!;
      setUndoStack((u) => [...u, structuredClone(canvas)]);
      skipHistory.current = true;
      setCanvas(next);
      skipHistory.current = false;
      setDirty(true);
      return stack.slice(0, -1);
    });
  }, [canvas]);

  const loadVersions = useCallback(async () => {
    const r = await fetch(`/api/studio/documents/${id}/versions`, { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    setVersions(d.versions || []);
  }, [id]);

  const loadMolds = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/studio/molds?companyId=${encodeURIComponent(companyId)}`, {
      cache: 'no-store',
    });
    if (!r.ok) return;
    const d = await r.json();
    setMolds(d.molds || []);
  }, [companyId]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const r = await fetch(`/api/studio/documents/${id}${q}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);
      setTitle(d.document.title);
      const c = normalizeStudioCanvas(d.document.canvasState);
      setCanvas(c);
      setActivePageId(c.pages[0]?.id || null);
      setUndoStack([]);
      setRedoStack([]);
      setDocFolderId(typeof d.document.folderId === 'string' ? d.document.folderId : null);
      if (typeof d.document.companyId === 'string' && isLikelyDbId(d.document.companyId) && !companyId) {
        setActiveCompanyId(d.document.companyId);
      }
      setAccess(typeof d.access === 'string' ? d.access : 'owner');
      setDirty(false);

      if (typeof d.document.folderId === 'string' && d.document.folderId) {
        const cq = new URLSearchParams({ folderId: d.document.folderId });
        if (companyId) cq.set('companyId', companyId);
        fetch(`/api/studio/context?${cq}`, { cache: 'no-store' })
          .then(async (cr) => {
            if (!cr.ok) return;
            const cd = await cr.json();
            setFolderContextCount(Array.isArray(cd.assets) ? cd.assets.length : 0);
          })
          .catch(() => {});
      }

      const mr = await fetch(
        `/api/studio/documents/${id}/copilot${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''}`,
      );
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
      void loadVersions();
      void loadMolds();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [id, companyId, setActiveCompanyId, loadVersions, loadMolds]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, consent]);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const next = Math.min(640, Math.max(280, e.clientX));
      setChatWidth(next);
    }
    function onUp() {
      dragging.current = false;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  function updateBlock(pageId: string, blockId: string, text: string) {
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              blocks: p.blocks.map((b) => (b.id === blockId ? { ...b, text } : b)),
            },
      ),
    }));
  }

  async function save() {
    if (!canvas) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/studio/documents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: companyId || undefined, title, canvasState: canvas }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error);
      setDirty(false);
      void loadVersions();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSaving(false);
    }
  }

  async function sendChat(opts?: { text?: string; approvedSources?: string[] }) {
    const text = (opts?.text ?? input).trim();
    if (!text || !canvas || chatBusy) return;
    setChatBusy(true);
    setConsent(null);
    setInput('');
    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    const tempId = `local-${Date.now()}`;
    const attachNote =
      filesToSend.length > 0
        ? `\n\n[${filesToSend.length} anexo(s): ${filesToSend.map((f) => f.name).join(', ')}]`
        : '';
    setMessages((m) => [...m, { id: tempId, role: 'user', content: text + attachNote }]);

    try {
      const attachmentIds: string[] = [];
      for (const file of filesToSend) {
        const asset = await uploadStudioChatAttachment({
          companyId: companyId || undefined,
          documentId: id,
          file,
        });
        attachmentIds.push(asset.id);
      }

      const r = await fetch(`/api/studio/documents/${id}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: companyId || undefined,
          locale,
          message: text,
          canvasState: canvas,
          approvedSources: opts?.approvedSources || [],
          attachmentIds,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);

      if (d.canvasState) {
        applyCanvas(() => normalizeStudioCanvas(d.canvasState), true);
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
    if (!canvas) return;
    setExporting(format);
    try {
      if (dirty) await save();
      const r = await fetch(`/api/studio/documents/${id}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: companyId || undefined, format, title, canvasState: canvas }),
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

  async function restoreVersion(versionId: string) {
    if (!confirm(t('Restaurar esta versão?', '¿Restaurar esta versión?', 'Restore this version?'))) return;
    const r = await fetch(`/api/studio/documents/${id}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', versionId }),
    });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error || 'Erro');
      return;
    }
    if (d.document?.canvasState) {
      applyCanvas(() => normalizeStudioCanvas(d.document.canvasState), true);
      if (typeof d.document.title === 'string') setTitle(d.document.title);
      setDirty(false);
    }
    setShowVersions(false);
    void loadVersions();
  }

  async function uploadMold(file: File) {
    if (!companyId) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('companyId', companyId);
    fd.append('name', file.name.replace(/\.[^.]+$/, ''));
    fd.append('pageSize', canvas?.pageSize || 'A4');
    const r = await fetch('/api/studio/molds', { method: 'POST', body: fd });
    const d = await r.json();
    if (!r.ok) {
      alert(d.error || 'Erro');
      return;
    }
    await loadMolds();
  }

  function setDocPageSize(size: StudioPageSize) {
    applyCanvas((prev) => ({
      ...prev,
      pageSize: size,
      pages: prev.pages.map((p) => ({ ...p, pageSize: size })),
    }));
  }

  function addPage() {
    applyCanvas((prev) => {
      const n = prev.pages.length + 1;
      const page: StudioPage = {
        id: `page-${Date.now()}`,
        title: `${t('Página', 'Página', 'Page')} ${n}`,
        order: prev.pages.length,
        pageSize: prev.pageSize || 'A4',
        layoutMode: 'blank',
        blocks: [
          {
            id: `block-${Date.now()}`,
            kind: 'paragraph',
            title: t('Corpo', 'Cuerpo', 'Body'),
            text: '',
            order: 0,
          },
        ],
      };
      setActivePageId(page.id);
      return { ...prev, pages: [...prev.pages, page] };
    });
  }

  function setPageLayout(pageId: string, mode: 'blank' | 'mold', moldId?: string | null) {
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              layoutMode: mode,
              moldId: mode === 'mold' ? moldId || p.moldId || null : null,
            }
          : p,
      ),
    }));
  }

  const libraryHref = docFolderId
    ? `/hub/studio?folder=${encodeURIComponent(docFolderId)}`
    : '/hub/studio';

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
        <Link href={libraryHref} className="mt-4 inline-block text-amber-800 underline">
          Studio
        </Link>
      </div>
    );
  }

  const pageSize = (canvas.pageSize || 'A4') as StudioPageSize;

  return (
    <div className="flex h-screen flex-col bg-slate-200/80">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Link href={libraryHref} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <PenLine className="hidden h-4 w-4 text-orange-600 sm:block" />
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setDirty(true);
            }}
            disabled={!canEdit}
            className="min-w-0 flex-1 border-0 bg-transparent text-base font-semibold text-slate-900 outline-none focus:ring-0 sm:text-lg"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={pageSize}
            disabled={!canEdit}
            onChange={(e) => setDocPageSize(e.target.value as StudioPageSize)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
            title={t('Tamanho da folha', 'Tamaño de hoja', 'Page size')}
          >
            {STUDIO_PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!canEdit || !undoStack.length}
            onClick={undo}
            title="Undo"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canEdit || !redoStack.length}
            onClick={redo}
            title="Redo"
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowVersions(true);
              void loadVersions();
            }}
            title={t('Versões', 'Versiones', 'Versions')}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowMolds(true);
              void loadMolds();
            }}
            title={t('Moldes / templates', 'Moldes / plantillas', 'Molds / templates')}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
          >
            <LayoutTemplate className="h-4 w-4" />
          </button>
          {(access === 'owner' || access === 'admin') && companyId && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
            >
              <Share2 className="h-3.5 w-3.5" />
              {t('Partilhar', 'Compartir', 'Share')}
            </button>
          )}
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void exportFile('docx')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            {exporting === 'docx' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileType className="h-3.5 w-3.5" />}
            DOCX
          </button>
          <button
            type="button"
            disabled={!!exporting}
            onClick={() => void exportFile('pdf')}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium disabled:opacity-40"
          >
            {exporting === 'pdf' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
            PDF
          </button>
          <button
            type="button"
            disabled={saving || !dirty || !canEdit}
            onClick={() => void save()}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t('Guardar', 'Guardar', 'Save')}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Chat — esquerda */}
        <aside
          className="flex h-[40vh] w-full shrink-0 flex-col border-b border-slate-200 bg-white lg:h-auto lg:w-[var(--studio-chat-w)] lg:border-b-0 lg:border-r"
          style={{ ['--studio-chat-w' as string]: `${chatWidth}px` }}
        >
          <div className="hidden border-b border-slate-100 px-4 py-3 lg:block">
            <h2 className="text-sm font-bold text-slate-900">
              {t('Agente Studio', 'Agente Studio', 'Studio agent')}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {t(
                'Enter = nova linha · Ctrl+Enter = enviar. Pedidos pontuais não reescrevem o resto.',
                'Enter = nueva línea · Ctrl+Enter = enviar. Pedidos puntuales no reescriben el resto.',
                'Enter = new line · Ctrl+Enter = send. Small asks won’t rewrite the rest.',
              )}
            </p>
            {folderContextCount > 0 && (
              <p className="mt-1 text-[11px] font-medium text-amber-800">
                {folderContextCount}{' '}
                {t('ficheiros de contexto da pasta', 'archivos de contexto de carpeta', 'folder context files')}
              </p>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 && (
              <p className="text-sm text-slate-500">
                {t(
                  'Ex.: «Acrescenta o prazo no resumo» (só muda o necessário).',
                  'Ej.: «Añade el plazo en el resumen» (solo cambia lo necesario).',
                  'E.g. “Add the deadline to the summary” (only changes what’s needed).',
                )}
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user' ? 'ml-4 bg-orange-50 text-slate-900' : 'mr-2 bg-slate-50 text-slate-800'
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
                    onClick={() => {
                      if (!consent || !pendingPrompt) return;
                      const sources = consent.sources.map((s) => s.id);
                      setConsent(null);
                      void sendChat({ text: pendingPrompt, approvedSources: sources });
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-amber-700 px-2 py-1.5 text-xs font-semibold text-white"
                  >
                    <Check className="h-3.5 w-3.5" />
                    {t('Sim, usar', 'Sí, usar', 'Yes, use')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConsent(null);
                      setPendingPrompt(null);
                    }}
                    className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs font-semibold"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t('Não', 'No', 'No')}
                  </button>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-slate-100 p-3">
            {pendingFiles.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {pendingFiles.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px]"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[9rem] truncate">{f.name}</span>
                    <button type="button" onClick={() => setPendingFiles((p) => p.filter((_, j) => j !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                accept=".pdf,.txt,.md,.csv,.json,.docx,image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : [];
                  e.target.value = '';
                  if (list.length) setPendingFiles((prev) => [...prev, ...list].slice(0, 6));
                }}
              />
              <button
                type="button"
                disabled={chatBusy || !canEdit}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 disabled:opacity-40"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              {docFolderId && (
                <button
                  type="button"
                  onClick={() => setShowFolderContext(true)}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600"
                >
                  <BookMarked className="h-5 w-5" />
                </button>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={chatBusy || !canEdit}
                rows={4}
                placeholder={t(
                  'Escreva instruções… (Enter = parágrafo)',
                  'Escriba instrucciones… (Enter = párrafo)',
                  'Write instructions… (Enter = paragraph)',
                )}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void sendChat();
                  }
                }}
                className="min-h-[96px] min-w-0 flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-orange-400"
              />
              <button
                type="button"
                disabled={chatBusy || !input.trim() || !canEdit}
                onClick={() => void sendChat()}
                className="rounded-lg bg-orange-600 p-2.5 text-white disabled:opacity-40"
                title="Ctrl+Enter"
              >
                {chatBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </aside>

        {/* Resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={() => {
            dragging.current = true;
          }}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-slate-200 hover:bg-orange-400 lg:block"
          title={t('Arrastar para redimensionar', 'Arrastrar para redimensionar', 'Drag to resize')}
        />

        {/* Documento — direita, folhas */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canEdit}
              onClick={addPage}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('Nova folha', 'Nueva hoja', 'New page')}
            </button>
            <span className="text-xs text-slate-500">
              {canvas.pages.length}{' '}
              {t('folha(s)', 'hoja(s)', 'page(s)')} · {pageSize}
            </span>
          </div>

          <div className="mx-auto flex flex-col items-center gap-10 pb-16">
            {canvas.pages
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((page, idx) => {
                const size = (page.pageSize || pageSize) as StudioPageSize;
                const { width, height } = studioPageCssSize(size, 680);
                const mold = page.moldId ? molds.find((m) => m.id === page.moldId) : null;
                const bg =
                  page.layoutMode === 'mold' && mold?.imageUrl
                    ? mold.imageUrl
                    : null;
                return (
                  <section key={page.id} className="relative">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2" style={{ width }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {page.title || `${t('Folha', 'Hoja', 'Sheet')} ${idx + 1}`} · {size}
                      </p>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setPageLayout(page.id, 'blank')}
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            page.layoutMode !== 'mold'
                              ? 'bg-slate-800 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {t('Do zero', 'Desde cero', 'Blank')}
                        </button>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => {
                            setActivePageId(page.id);
                            setShowMolds(true);
                            void loadMolds();
                          }}
                          className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                            page.layoutMode === 'mold'
                              ? 'bg-orange-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {t('Molde', 'Molde', 'Mold')}
                        </button>
                      </div>
                    </div>
                    <div
                      className="relative overflow-hidden bg-white shadow-lg ring-1 ring-slate-300"
                      style={{
                        width,
                        minHeight: height,
                        backgroundImage: bg ? `url(${bg})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    >
                      <div
                        className={`relative z-10 space-y-5 px-10 py-12 ${
                          bg ? 'bg-white/85 backdrop-blur-[1px]' : ''
                        }`}
                        style={{ minHeight: height - 8 }}
                      >
                        {page.blocks
                          .slice()
                          .sort((a, b) => a.order - b.order)
                          .map((block) => (
                            <BlockEditor
                              key={block.id}
                              block={block}
                              disabled={!canEdit}
                              onChange={(text) => updateBlock(page.id, block.id, text)}
                            />
                          ))}
                      </div>
                    </div>
                  </section>
                );
              })}
          </div>
        </div>
      </div>

      {shareOpen && companyId && (
        <StudioShareDialog
          companyId={companyId}
          documentId={id}
          title={title}
          open
          onClose={() => setShareOpen(false)}
        />
      )}

      {showFolderContext && docFolderId && (
        <StudioContextPanel
          companyId={companyId || undefined}
          folderId={docFolderId}
          canEdit={canEdit}
          open
          onClose={() => setShowFolderContext(false)}
        />
      )}

      {showVersions && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{t('Versões', 'Versiones', 'Versions')}</h3>
              <button type="button" onClick={() => setShowVersions(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            {versions.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t(
                  'Ainda sem snapshots. Guarde o documento para criar histórico.',
                  'Aún sin snapshots. Guarde el documento para crear historial.',
                  'No snapshots yet. Save the document to create history.',
                )}
              </p>
            ) : (
              <ul className="space-y-2">
                {versions.map((v) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{v.label || v.title}</p>
                      <p className="text-[10px] text-slate-500">
                        {new Date(v.createdAt).toLocaleString(locale === 'en' ? 'en' : locale)}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void restoreVersion(v.id)}
                        className="shrink-0 text-xs font-semibold text-orange-700"
                      >
                        {t('Restaurar', 'Restaurar', 'Restore')}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showMolds && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900">
                  {t('Moldes de folha', 'Moldes de hoja', 'Page molds')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t(
                    'Suba um PNG/JPG (kit visual). Em cada folha escolha Molde ou Do zero.',
                    'Suba un PNG/JPG (kit visual). En cada hoja elija Molde o Desde cero.',
                    'Upload a PNG/JPG (visual kit). On each sheet pick Mold or Blank.',
                  )}
                </p>
              </div>
              <button type="button" onClick={() => setShowMolds(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <input
              ref={moldFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void uploadMold(f);
              }}
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => moldFileRef.current?.click()}
                className="mb-4 w-full rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-900"
              >
                {t('Carregar molde (imagem)', 'Subir molde (imagen)', 'Upload mold (image)')}
              </button>
            )}
            {molds.length === 0 ? (
              <p className="text-sm text-slate-500">
                {t('Sem moldes ainda.', 'Sin moldes aún.', 'No molds yet.')}
              </p>
            ) : (
              <ul className="grid grid-cols-2 gap-3">
                {molds.map((m) => (
                  <li key={m.id} className="rounded-xl border border-slate-200 overflow-hidden">
                    {m.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.imageUrl} alt="" className="h-28 w-full object-cover bg-slate-100" />
                    )}
                    <div className="p-2">
                      <p className="truncate text-xs font-semibold">{m.name}</p>
                      <p className="text-[10px] text-slate-500">{m.pageSize}</p>
                      {canEdit && (
                        <button
                          type="button"
                          className="mt-1 text-[11px] font-semibold text-orange-700"
                          onClick={() => {
                            const target = activePageId || canvas.pages[0]?.id;
                            if (!target) return;
                            setPageLayout(target, 'mold', m.id);
                            setShowMolds(false);
                          }}
                        >
                          {t('Aplicar à folha', 'Aplicar a la hoja', 'Apply to sheet')}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  disabled,
}: {
  block: StudioBlock;
  onChange: (text: string) => void;
  disabled?: boolean;
}) {
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
            disabled={disabled}
            rows={8}
            className="w-full rounded-lg border border-slate-200 bg-slate-50/80 p-3 font-mono text-xs text-slate-800 outline-none focus:border-orange-400 disabled:opacity-60"
            spellCheck={false}
          />
          <StudioMermaidPreview source={block.text} />
        </div>
      ) : (
        <textarea
          value={block.text}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          rows={isHeading ? 2 : block.kind === 'bullets' ? 5 : 4}
          className={`w-full resize-y border-0 bg-transparent p-0 outline-none focus:ring-0 disabled:opacity-60 ${
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
