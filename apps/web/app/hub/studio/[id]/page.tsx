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
  MessageSquare,
  Mic,
  MicOff,
  Crosshair,
  Sparkles,
  ImagePlus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Wand2,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { useSpeechDictation } from '@/hooks/useSpeechDictation';
import type {
  StudioBlock,
  StudioCanvasState,
  StudioConsentRequest,
  StudioPage,
  StudioPageOrientation,
  StudioPageSize,
  StudioStudioMode,
} from '@/lib/studio/types';
import {
  DEFAULT_STUDIO_MARGINS_MM,
  normalizeStudioCanvas,
  normalizeStudioMargins,
  studioMarginsToCssPx,
  studioPageCssSize,
} from '@/lib/studio/types';
import { StudioShareDialog } from '@/components/studio/StudioShareDialog';
import {
  StudioContextPanel,
  uploadStudioChatAttachment,
} from '@/components/studio/StudioContextPanel';
import { StudioCommentsPanel } from '@/components/studio/StudioCommentsPanel';
import { StudioBlockEditor } from '@/components/studio/StudioBlockEditor';
import { StudioDesignPlacedBlock } from '@/components/studio/StudioDesignPlacedBlock';
import { getStudioWriteFocus, runStudioWriteCommand } from '@/lib/studio/write-editor-bus';
import { StudioSheet } from '@/components/studio/StudioSheet';
import { StudioToolsSidebar } from '@/components/studio/StudioToolsSidebar';
import { DocumentLinksPanel } from '@/components/studio/DocumentLinksPanel';
import { StudioWriteRibbon } from '@/components/studio/StudioWriteRibbon';
import { StudioDesignAiPanel } from '@/components/studio/StudioDesignAiPanel';
import {
  emptyStudioDrawScene,
  serializeStudioDrawScene,
} from '@/lib/studio/draw-scene';
import {
  applyStudioPagination,
  mergeStudioDocument,
  reflowStudioDocument,
  studioLikelyOverPaginated,
  type StudioOverflowInfo,
} from '@/lib/studio/paginate';

type ChatMsg = {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
  actorName?: string | null;
};
type VersionRow = {
  id: string;
  title: string;
  label: string | null;
  createdAt: string;
  createdBy?: { id: string; name: string | null; email: string } | null;
};
type ActivityRow = {
  id: string;
  kind: string;
  summary: string;
  createdAt: string;
  actor?: { id: string; name: string | null; email: string } | null;
};
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
  const [showLinks, setShowLinks] = useState(false);
  const [showFolderContext, setShowFolderContext] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [folderContextCount, setFolderContextCount] = useState(0);
  const [chatWidth, setChatWidth] = useState(400);
  const [undoStack, setUndoStack] = useState<StudioCanvasState[]>([]);
  const [redoStack, setRedoStack] = useState<StudioCanvasState[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState<'activity' | 'versions'>('activity');
  const [lastEditedBy, setLastEditedBy] = useState<string | null>(null);
  const [lastEditedAt, setLastEditedAt] = useState<string | null>(null);
  const [molds, setMolds] = useState<MoldRow[]>([]);
  const [showMolds, setShowMolds] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentBlockId, setCommentBlockId] = useState<string | null>(null);
  const [openCommentCount, setOpenCommentCount] = useState(0);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [toolsOpen, setToolsOpen] = useState(true);
  const [presence, setPresence] = useState<
    Array<{
      userId: string;
      status: string;
      name: string | null;
      email: string;
      initials: string;
      isSelf: boolean;
    }>
  >([]);
  const [remoteUpdate, setRemoteUpdate] = useState<{
    at: string;
    by: string;
  } | null>(null);

  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const moldFileRef = useRef<HTMLInputElement | null>(null);
  const dragging = useRef(false);
  const skipHistory = useRef(false);
  const clientIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const knownUpdatedAt = useRef<string | null>(null);
  const selfUserIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const canvasRef = useRef<StudioCanvasState | null>(null);
  const titleRef = useRef('');
  const saveLockRef = useRef(false);
  const saveAgainRef = useRef(false);
  const saveEpochRef = useRef(0);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dictationInterim, setDictationInterim] = useState('');
  /** Blocos selecionados como âmbito da IA (anti-wipe) */
  const [aiTargetBlockIds, setAiTargetBlockIds] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageTargetPageId, setImageTargetPageId] = useState<string | null>(null);
  const [brandPrimary, setBrandPrimary] = useState('#ea580c');

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  const appendDictation = useCallback((text: string) => {
    const chunk = text.trim();
    if (!chunk) return;
    setInput((prev) => {
      const base = prev.trimEnd();
      return base ? `${base} ${chunk}` : chunk;
    });
  }, []);

  const {
    supported: dictationSupported,
    listening: dictating,
    toggle: toggleDictation,
    stop: stopDictation,
  } = useSpeechDictation(locale === 'es' || locale === 'en' ? locale : 'pt', {
    onCommittedText: appendDictation,
    onInterim: setDictationInterim,
  });

  useEffect(() => () => stopDictation(), [stopDictation]);

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
        const next = updater(prev);
        canvasRef.current = next;
        return next;
      });
      dirtyRef.current = true;
      setDirty(true);
      if (saveLockRef.current) saveAgainRef.current = true;
      saveEpochRef.current += 1;
    },
    [pushHistory],
  );

  /** Persistência com mutex — nunca grava um canvas antigo por cima de um merge recente. */
  const persistCanvas = useCallback(
    async (opts?: { quiet?: boolean; forceSnap?: StudioCanvasState | null }) => {
      if (!canEdit || !id) return false;
      if (saveLockRef.current) {
        saveAgainRef.current = true;
        return false;
      }
      saveLockRef.current = true;
      let ok = false;
      try {
        do {
          saveAgainRef.current = false;
          const snap = opts?.forceSnap || canvasRef.current;
          opts = { ...opts, forceSnap: null };
          if (!snap) break;
          const epoch = ++saveEpochRef.current;
          setAutoSaveState('saving');
          setSaving(true);
          const r = await fetch(`/api/studio/documents/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: companyId || undefined,
              title: titleRef.current,
              canvasState: snap,
              createVersion: opts?.quiet === false,
              quiet: opts?.quiet !== false,
              versionLabel: opts?.quiet === false ? 'Após reunir documento' : undefined,
            }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error((d as { detail?: string; error?: string }).detail || (d as { error?: string }).error || 'Erro');

          // Se houve alteração mais recente durante o PUT, gravar de novo
          if (epoch !== saveEpochRef.current || canvasRef.current !== snap) {
            saveAgainRef.current = true;
            continue;
          }

          dirtyRef.current = false;
          setDirty(false);
          if (d.document?.updatedAt) {
            knownUpdatedAt.current = d.document.updatedAt;
            setLastEditedAt(d.document.updatedAt);
            setRemoteUpdate(null);
          }
          if (d.document?.updatedBy) {
            setLastEditedBy(
              d.document.updatedBy.name?.trim() || d.document.updatedBy.email || null,
            );
          }
          setAutoSaveState('saved');
          window.setTimeout(() => setAutoSaveState('idle'), 2500);
          ok = true;
        } while (saveAgainRef.current);
      } catch (e) {
        setAutoSaveState('idle');
        throw e;
      } finally {
        saveLockRef.current = false;
        setSaving(false);
      }
      return ok;
    },
    [canEdit, id, companyId],
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

  const loadActivity = useCallback(async () => {
    const r = await fetch(`/api/studio/documents/${id}/activity`, { cache: 'no-store' });
    if (!r.ok) return;
    const d = await r.json();
    setActivities(d.activities || []);
    const ub = d.document?.updatedBy;
    if (ub) setLastEditedBy(ub.name?.trim() || ub.email || null);
    if (d.document?.updatedAt) setLastEditedAt(d.document.updatedAt);
  }, [id]);

  const openHistory = useCallback(
    (tab: 'activity' | 'versions' = 'activity') => {
      setHistoryTab(tab);
      setShowHistory(true);
      void loadActivity();
      void loadVersions();
    },
    [loadActivity, loadVersions],
  );

  const loadMolds = useCallback(async () => {
    if (!companyId) return;
    const r = await fetch(`/api/studio/molds?companyId=${encodeURIComponent(companyId)}`, {
      cache: 'no-store',
    });
    if (!r.ok) return;
    const d = await r.json();
    setMolds(d.molds || []);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/studio/brand?companyId=${encodeURIComponent(companyId)}`, {
          cache: 'no-store',
        });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const color = String(d.brand?.primaryColor || '').trim();
        if (color && /^#[0-9a-fA-F]{3,8}$/.test(color)) setBrandPrimary(color);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
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
      const c0 = normalizeStudioCanvas(d.document.canvasState);
      const c =
        c0.studioMode !== 'design' && studioLikelyOverPaginated(c0)
          ? mergeStudioDocument(c0, { pageTitlePrefix: 'Página' })
          : c0;
      canvasRef.current = c;
      dirtyRef.current = c !== c0;
      setCanvas(c);
      setActivePageId(c.pages[0]?.id || null);
      setUndoStack([]);
      setRedoStack([]);
      setDocFolderId(typeof d.document.folderId === 'string' ? d.document.folderId : null);
      if (typeof d.document.companyId === 'string' && isLikelyDbId(d.document.companyId) && !companyId) {
        setActiveCompanyId(d.document.companyId);
      }
      setAccess(typeof d.access === 'string' ? d.access : 'owner');
      setDirty(c !== c0);
      const ub = d.document.updatedBy;
      setLastEditedBy(ub ? ub.name?.trim() || ub.email || null : null);
      setLastEditedAt(typeof d.document.updatedAt === 'string' ? d.document.updatedAt : null);
      if (typeof d.document.updatedAt === 'string') {
        knownUpdatedAt.current = d.document.updatedAt;
      }

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
          (md.messages || []).map(
            (m: {
              id: string;
              role: string;
              content: string;
              createdAt?: string;
              actor?: { name?: string | null; email?: string | null } | null;
            }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              createdAt: m.createdAt,
              actorName: m.actor?.name?.trim() || m.actor?.email || null,
            }),
          ),
        );
      }
      void loadVersions();
      void loadActivity();
      void loadMolds();
      fetch(`/api/studio/documents/${id}/comments`, { cache: 'no-store' })
        .then(async (cr) => {
          if (!cr.ok) return;
          const cd = await cr.json();
          setOpenCommentCount(
            typeof cd.openCount === 'number'
              ? cd.openCount
              : (cd.comments || []).filter((c: { resolvedAt?: string | null }) => !c.resolvedAt).length,
          );
        })
        .catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [id, companyId, setActiveCompanyId, loadVersions, loadActivity, loadMolds]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, consent]);

  // Presença + deteção de edição remota (F5)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const clientId = clientIdRef.current;

    async function beat(status: 'viewing' | 'editing', leave = false) {
      try {
        await fetch(`/api/studio/documents/${id}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId, status, leave }),
          keepalive: leave,
        });
      } catch {
        /* ignore */
      }
    }

    async function poll() {
      try {
        await beat(dirty && canEdit ? 'editing' : 'viewing');
        const r = await fetch(`/api/studio/documents/${id}/presence`, { cache: 'no-store' });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        if (typeof d.selfUserId === 'string') selfUserIdRef.current = d.selfUserId;
        setPresence(Array.isArray(d.presence) ? d.presence : []);
        const remoteAt = d.document?.updatedAt as string | undefined;
        const remoteById = d.document?.updatedById as string | null | undefined;
        if (
          remoteAt &&
          knownUpdatedAt.current &&
          remoteAt !== knownUpdatedAt.current &&
          remoteById &&
          remoteById !== selfUserIdRef.current
        ) {
          const by =
            d.document?.updatedBy?.name?.trim() ||
            d.document?.updatedBy?.email ||
            t('outro utilizador', 'otro usuario', 'another user');

          // Sync suave: se não há edições locais, aplicar automaticamente
          if (!dirtyRef.current) {
            try {
              const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
              const gr = await fetch(`/api/studio/documents/${id}${q}`, { cache: 'no-store' });
              if (gr.ok && !cancelled && !dirtyRef.current) {
                const gd = await gr.json();
                skipHistory.current = true;
                const nextCanvas = normalizeStudioCanvas(gd.document.canvasState);
                canvasRef.current = nextCanvas;
                setCanvas(nextCanvas);
                if (typeof gd.document.title === 'string') setTitle(gd.document.title);
                skipHistory.current = false;
                dirtyRef.current = false;
                setDirty(false);
                knownUpdatedAt.current = remoteAt;
                setLastEditedAt(remoteAt);
                setLastEditedBy(by);
                setRemoteUpdate(null);
                return;
              }
            } catch {
              /* fall through to banner */
            }
          }
          setRemoteUpdate({ at: remoteAt, by });
        }
      } catch {
        /* ignore */
      }
    }

    void poll();
    const timer = window.setInterval(() => void poll(), 12_000);

    function onLeave() {
      void beat('viewing', true);
    }
    window.addEventListener('pagehide', onLeave);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onLeave);
      void beat('viewing', true);
    };
  }, [id, dirty, canEdit, locale, companyId]);

  // Auto-guardar (F6) — 2.5s após a última alteração (merge grava já à parte)
  useEffect(() => {
    if (!dirty || !canEdit || !id) {
      setAutoSaveState('idle');
      return;
    }
    setAutoSaveState('idle');
    const timer = window.setTimeout(() => {
      void persistCanvas({ quiet: true }).catch(() => {
        /* idle já tratado */
      });
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [dirty, canvas, title, canEdit, id, companyId, persistCanvas]);

  // Flush ao sair / refresh — evita perder o «Reunir»
  useEffect(() => {
    function flush() {
      if (!dirtyRef.current || !canEdit || !id) return;
      const snap = canvasRef.current;
      if (!snap) return;
      try {
        void fetch(`/api/studio/documents/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: companyId || undefined,
            title: titleRef.current,
            canvasState: snap,
            createVersion: false,
            quiet: true,
          }),
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    }
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, [canEdit, id, companyId]);

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

  function updateBlock(
    pageId: string,
    blockId: string,
    patch: {
      text?: string;
      kind?: StudioBlock['kind'];
      diagramLang?: StudioBlock['diagramLang'];
      style?: StudioBlock['style'];
      layout?: StudioBlock['layout'];
    },
  ) {
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              blocks: p.blocks.map((b) =>
                b.id === blockId
                  ? {
                      ...b,
                      ...(patch.text !== undefined ? { text: patch.text } : {}),
                      ...(patch.kind !== undefined
                        ? {
                            kind: patch.kind,
                            ...(patch.kind === 'diagram' && !patch.diagramLang
                              ? { diagramLang: 'draw' as const }
                              : {}),
                          }
                        : {}),
                      ...(patch.diagramLang !== undefined
                        ? { diagramLang: patch.diagramLang }
                        : {}),
                      ...(patch.style !== undefined
                        ? { style: { ...(b.style || {}), ...patch.style } }
                        : {}),
                      ...(patch.layout !== undefined ? { layout: patch.layout } : {}),
                    }
                  : b,
              ),
            },
      ),
    }));
  }

  function patchSelectedStyles(partial: NonNullable<StudioBlock['style']>) {
    if (!canvas || !aiTargetBlockIds.length) return;
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          aiTargetBlockIds.includes(b.id)
            ? { ...b, style: { ...(b.style || {}), ...partial } }
            : b,
        ),
      })),
    }));
  }

  async function save() {
    if (!canvasRef.current) return;
    try {
      await persistCanvas({ quiet: false, forceSnap: canvasRef.current });
      void loadVersions();
      void loadActivity();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    }
  }

  function toggleAiTarget(blockId: string) {
    setAiTargetBlockIds((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId],
    );
  }

  function blockLabel(blockId: string): string {
    if (!canvas) return blockId;
    for (const page of canvas.pages) {
      const b = page.blocks.find((x) => x.id === blockId);
      if (!b) continue;
      const raw = (b.title || b.text || b.kind).replace(/\s+/g, ' ').trim();
      return raw.slice(0, 48) || b.kind;
    }
    return blockId;
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
    const scopeNote =
      aiTargetBlockIds.length > 0
        ? `\n\n[${t('Âmbito', 'Ámbito', 'Scope')}: ${aiTargetBlockIds.map(blockLabel).join(' · ')}]`
        : '';
    setMessages((m) => [...m, { id: tempId, role: 'user', content: text + attachNote + scopeNote }]);

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
          targetBlockIds: aiTargetBlockIds,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);

      if (d.canvasState) {
        applyCanvas(() => layoutWriteDocument(normalizeStudioCanvas(d.canvasState)), true);
      }
      if (typeof d.title === 'string' && d.title) setTitle(d.title);
      setMessages((m) => [
        ...m,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: d.message || '…',
          createdAt: new Date().toISOString(),
        },
      ]);

      if (d.consentRequest?.question && Array.isArray(d.consentRequest.sources)) {
        setConsent(d.consentRequest as StudioConsentRequest);
        setPendingPrompt(text);
      } else {
        setPendingPrompt(null);
      }
      void loadActivity();
      void loadVersions();
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
    setShowHistory(false);
    void loadVersions();
    void loadActivity();
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

  function layoutWriteDocument(prev: StudioCanvasState): StudioCanvasState {
    if (prev.studioMode === 'design') return prev;
    return reflowStudioDocument(prev, {
      pageTitlePrefix: t('Página', 'Página', 'Page'),
      marginsMm: prev.marginsMm,
    });
  }

  function setDocPageSize(size: StudioPageSize) {
    applyCanvas((prev) =>
      layoutWriteDocument({
        ...prev,
        pageSize: size,
        orientation: size === 'Slide' ? 'landscape' : prev.orientation || 'portrait',
        pages: prev.pages.map((p) => ({ ...p, pageSize: size })),
      }),
    );
  }

  function setDocOrientation(orientation: StudioPageOrientation) {
    applyCanvas((prev) => layoutWriteDocument({ ...prev, orientation }));
  }

  function setDocMargins(marginsMm: StudioCanvasState['marginsMm']) {
    applyCanvas((prev) =>
      layoutWriteDocument({
        ...prev,
        marginsMm: normalizeStudioMargins(marginsMm),
      }),
    );
  }

  function setStudioMode(mode: StudioStudioMode) {
    setToolsOpen(true);
    applyCanvas((prev) => {
      const next = { ...prev, studioMode: mode };
      if (mode === 'write') return layoutWriteDocument(next);
      return next;
    });
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
            text: '',
            order: 0,
          },
        ],
      };
      setActivePageId(page.id);
      return { ...prev, pages: [...prev.pages, page] };
    });
  }

  function addBlock(
    pageId: string,
    kind: StudioBlock['kind'] = 'paragraph',
  ) {
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const order = p.blocks.length;
        return {
          ...p,
          blocks: [
            ...p.blocks,
            {
              id: `block-${Date.now()}-${order}`,
              kind,
              text:
                kind === 'diagram'
                  ? serializeStudioDrawScene(emptyStudioDrawScene())
                  : kind === 'bullets'
                    ? '- '
                    : kind === 'image'
                      ? ''
                      : '',
              order,
              ...(kind === 'diagram' ? { diagramLang: 'draw' as const } : {}),
              ...(kind === 'image' ? { imageUrl: null } : {}),
            },
          ],
        };
      }),
    }));
  }

  function moveBlock(pageId: string, blockId: string, dir: -1 | 1) {
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const blocks = p.blocks.slice().sort((a, b) => a.order - b.order);
        const idx = blocks.findIndex((b) => b.id === blockId);
        const swap = idx + dir;
        if (idx < 0 || swap < 0 || swap >= blocks.length) return p;
        const next = blocks.slice();
        const tmp = next[idx]!;
        next[idx] = next[swap]!;
        next[swap] = tmp;
        return { ...p, blocks: next.map((b, i) => ({ ...b, order: i })) };
      }),
    }));
  }

  function removeBlock(pageId: string, blockId: string) {
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        if (p.blocks.length <= 1) return p;
        return {
          ...p,
          blocks: p.blocks
            .filter((b) => b.id !== blockId)
            .map((b, i) => ({ ...b, order: i })),
        };
      }),
    }));
    setAiTargetBlockIds((ids) => ids.filter((id) => id !== blockId));
  }

  /** Só no modo desenho: move blocos inteiros (nunca parte texto). */
  function handleSheetOverflow(fromPageId: string, info: StudioOverflowInfo) {
    setCanvas((prev) => {
      if (!prev || prev.studioMode !== 'design') return prev;
      // Hard stop: nunca paginar docs já “explodidos”
      if ((prev.pages?.length || 0) > 12) return prev;
      const next = applyStudioPagination(prev, fromPageId, info, {
        pageTitlePrefix: t('Página', 'Página', 'Page'),
      });
      if (next === prev) return prev;
      canvasRef.current = next;
      dirtyRef.current = true;
      setDirty(true);
      if (saveLockRef.current) saveAgainRef.current = true;
      saveEpochRef.current += 1;
      return next;
    });
  }

  async function reloadFromServer() {
    setRemoteUpdate(null);
    await load();
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

  function focusBlockTarget(): { pageId: string; blockId: string } | null {
    if (!canvas) return null;
    const tip = getStudioWriteFocus();
    if (tip?.pageId && tip.blockId) return { pageId: tip.pageId, blockId: tip.blockId };
    if (aiTargetBlockIds[0]) {
      for (const p of canvas.pages) {
        if (p.blocks.some((b) => b.id === aiTargetBlockIds[0])) {
          return { pageId: p.id, blockId: aiTargetBlockIds[0]! };
        }
      }
    }
    const pageId = activePageId || canvas.pages[0]?.id;
    if (!pageId) return null;
    const page = canvas.pages.find((p) => p.id === pageId);
    const blockId = page?.blocks.slice().sort((a, b) => a.order - b.order)[0]?.id;
    if (!blockId) return null;
    return { pageId, blockId };
  }

  function ribbonWrap(before: string, after: string) {
    if (before === '**' && after === '**' && runStudioWriteCommand({ type: 'bold' })) return;
    if ((before === '_' || before === '*') && (after === '_' || after === '*') && runStudioWriteCommand({ type: 'italic' }))
      return;
    if (before === '<u>' && after === '</u>' && runStudioWriteCommand({ type: 'underline' })) return;
    const target = focusBlockTarget();
    if (!target || !canvas) return;
    const page = canvas.pages.find((p) => p.id === target.pageId);
    const block = page?.blocks.find((b) => b.id === target.blockId);
    if (!block) return;
    const text = String(block.text || '');
    updateBlock(target.pageId, target.blockId, { text: `${before}${text}${after}` });
  }

  function ribbonKind(kind: StudioBlock['kind']) {
    if (kind === 'heading' && runStudioWriteCommand({ type: 'heading' })) return;
    if (kind === 'paragraph' && runStudioWriteCommand({ type: 'paragraph' })) return;
    if (kind === 'bullets' && runStudioWriteCommand({ type: 'bulletList' })) return;
    const target = focusBlockTarget();
    if (!target) return;
    updateBlock(target.pageId, target.blockId, { kind });
  }

  function ribbonStyle(partial: NonNullable<StudioBlock['style']>) {
    if (partial.align && runStudioWriteCommand({ type: 'align', align: partial.align })) {
      /* also persist block style for export/design */
    }
    const ids = aiTargetBlockIds.length
      ? aiTargetBlockIds
      : (() => {
          const t = focusBlockTarget();
          return t ? [t.blockId] : [];
        })();
    if (!ids.length || !canvas) return;
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          ids.includes(b.id) ? { ...b, style: { ...(b.style || {}), ...partial } } : b,
        ),
      })),
    }));
  }

  const pageSize = (canvas.pageSize || 'A4') as StudioPageSize;
  const orientation: StudioPageOrientation =
    canvas.orientation || (pageSize === 'Slide' ? 'landscape' : 'portrait');
  const marginsMm = normalizeStudioMargins(canvas.marginsMm || DEFAULT_STUDIO_MARGINS_MM);
  const studioMode: StudioStudioMode = canvas.studioMode === 'design' ? 'design' : 'write';

  return (
    <div
      className={`flex h-screen flex-col ${
        studioMode === 'design'
          ? 'bg-[#1a1225]'
          : 'bg-[#ebe6dc]'
      }`}
    >
      <header
        className={`flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2.5 sm:px-4 ${
          studioMode === 'design'
            ? 'border-b border-violet-900/60 bg-[#120c1a] text-violet-50'
            : 'border-b border-stone-300/80 bg-[#f7f4ef] text-stone-900'
        }`}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={libraryHref}
              className={`rounded-lg p-1.5 ${
                studioMode === 'design'
                  ? 'text-violet-300 hover:bg-violet-900/50'
                  : 'text-stone-600 hover:bg-stone-200/60'
              }`}
              title={t('Voltar à pasta', 'Volver a la carpeta', 'Back to folder')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            {studioMode === 'design' ? (
              <Wand2 className="hidden h-4 w-4 text-violet-400 sm:block" />
            ) : (
              <PenLine className="hidden h-4 w-4 text-orange-600 sm:block" />
            )}
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              onBlur={() => {
                if (dirty && canEdit) void persistCanvas({ quiet: true });
              }}
              disabled={!canEdit}
              className={`min-w-0 flex-1 border-0 bg-transparent text-base font-semibold outline-none focus:ring-0 sm:text-lg ${
                studioMode === 'design' ? 'text-violet-50' : 'text-stone-900'
              }`}
              title={t('Nome do documento', 'Nombre del documento', 'Document name')}
            />
          </div>
          {(lastEditedBy || lastEditedAt) && (
            <p
              className={`truncate pl-9 text-[10px] ${
                studioMode === 'design' ? 'text-violet-400' : 'text-stone-500'
              }`}
            >
              {t('Última edição', 'Última edición', 'Last edit')}
              {lastEditedBy ? `: ${lastEditedBy}` : ''}
              {lastEditedAt
                ? ` · ${new Date(lastEditedAt).toLocaleString(locale === 'en' ? 'en' : locale)}`
                : ''}
            </p>
          )}
        </div>

        <div
          className={`flex rounded-xl p-1 ${
            studioMode === 'design' ? 'bg-violet-950 ring-1 ring-violet-700' : 'bg-stone-200/80 ring-1 ring-stone-300'
          }`}
        >
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setStudioMode('write')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              studioMode === 'write'
                ? 'bg-white text-stone-900 shadow-sm'
                : studioMode === 'design'
                  ? 'text-violet-300 hover:text-white'
                  : 'text-stone-600'
            }`}
          >
            <PenLine className="h-3.5 w-3.5" />
            {t('Redação', 'Redacción', 'Write')}
          </button>
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setStudioMode('design')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
              studioMode === 'design'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Wand2 className="h-3.5 w-3.5" />
            {t('Desenho', 'Diseño', 'Design')}
          </button>
        </div>

        {presence.filter((p) => !p.isSelf).length > 0 && (
          <div className="flex items-center -space-x-1.5 pr-1" title={t('Online agora', 'En línea ahora', 'Online now')}>
            {presence
              .filter((p) => !p.isSelf)
              .slice(0, 5)
              .map((p) => (
                <span
                  key={p.userId}
                  title={`${p.name || p.email} · ${p.status === 'editing' ? t('a editar', 'editando', 'editing') : t('a ver', 'viendo', 'viewing')}`}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold ${
                    p.status === 'editing'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-500 text-white'
                  }`}
                >
                  {p.initials}
                </span>
              ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={!canEdit || !undoStack.length}
            onClick={undo}
            title="Undo"
            className={`rounded-lg border p-2 disabled:opacity-40 ${
              studioMode === 'design'
                ? 'border-violet-700 bg-violet-950 text-violet-200 hover:bg-violet-900'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={!canEdit || !redoStack.length}
            onClick={redo}
            title="Redo"
            className={`rounded-lg border p-2 disabled:opacity-40 ${
              studioMode === 'design'
                ? 'border-violet-700 bg-violet-950 text-violet-200 hover:bg-violet-900'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => openHistory('activity')}
            title={t('Atividade e versões', 'Actividad y versiones', 'Activity & versions')}
            className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCommentBlockId(null);
              setShowComments(true);
            }}
            title={t('Comentários', 'Comentarios', 'Comments')}
            className="relative rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-50"
          >
            <MessageSquare className="h-4 w-4" />
            {openCommentCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
                {openCommentCount}
              </span>
            )}
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
          <button
            type="button"
            onClick={() => setShowLinks(true)}
            title={t('Vincular a sistemas', 'Vincular a sistemas', 'Link to systems')}
            className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1.5 text-xs font-medium text-orange-900 hover:bg-orange-100"
          >
            <Link2 className="h-3.5 w-3.5" />
            {t('Vincular', 'Vincular', 'Link')}
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
          {autoSaveState !== 'idle' && (
            <span className="text-[10px] font-medium text-slate-500">
              {autoSaveState === 'saving'
                ? t('A guardar…', 'Guardando…', 'Saving…')
                : t('Guardado', 'Guardado', 'Saved')}
            </span>
          )}
        </div>
      </header>

      {remoteUpdate && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-950">
          <p>
            {t(
              `${remoteUpdate.by} guardou uma versão mais recente.`,
              `${remoteUpdate.by} guardó una versión más reciente.`,
              `${remoteUpdate.by} saved a newer version.`,
            )}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRemoteUpdate(null)}
              className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold"
            >
              {t('Ignorar', 'Ignorar', 'Dismiss')}
            </button>
            <button
              type="button"
              onClick={() => void reloadFromServer()}
              className="rounded-lg bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white"
            >
              {t('Recarregar', 'Recargar', 'Reload')}
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Painel esquerdo: IA de redação OU IA de desenho */}
        <aside
          className={`flex h-[42vh] w-full shrink-0 flex-col lg:h-auto lg:w-[var(--studio-chat-w)] ${
            studioMode === 'design'
              ? 'border-b border-violet-900/50 lg:border-b-0 lg:border-r lg:border-violet-900/50'
              : 'border-b border-stone-200 bg-[#faf8f5] lg:border-b-0 lg:border-r'
          }`}
          style={{ ['--studio-chat-w' as string]: `${chatWidth}px` }}
        >
          {studioMode === 'design' ? (
            <StudioDesignAiPanel
              documentId={id}
              companyId={companyId || undefined}
              locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
              canEdit={canEdit}
              onApplied={(next, message) => {
                if (!skipHistory.current && canvas) pushHistory(canvas);
                const normalized = normalizeStudioCanvas(next);
                canvasRef.current = normalized;
                dirtyRef.current = true;
                setCanvas(normalized);
                setDirty(true);
                setActivePageId(normalized.pages[0]?.id || null);
                void persistCanvas({ quiet: true, forceSnap: normalized });
                if (message) {
                  setMessages((m) => [
                    ...m,
                    {
                      id: `design-${Date.now()}`,
                      role: 'assistant',
                      content: message,
                      createdAt: new Date().toISOString(),
                    },
                  ]);
                }
              }}
              labels={{
                title: t('IA de diagramação', 'IA de diagramación', 'Layout AI'),
                subtitle: t(
                  'Usa o texto da Redação + brand kit. Estilo Gamma/Canva.',
                  'Usa el texto de Redacción + brand kit. Estilo Gamma/Canva.',
                  'Uses Write text + brand kit. Gamma/Canva style.',
                ),
                placeholder: t(
                  'Ex.: capa institucional, callouts, tipografia forte…',
                  'Ej.: portada institucional, callouts, tipografía fuerte…',
                  'E.g. institutional cover, callouts, strong type…',
                ),
                run: t('Diagramar agora', 'Diagramar ahora', 'Lay out now'),
                presets: t('Estilos rápidos', 'Estilos rápidos', 'Quick styles'),
              }}
            />
          ) : (
          <>
          <div className="hidden border-b border-stone-200 px-4 py-3 lg:block">
            <h2 className="text-sm font-bold text-stone-900">
              {t('IA de redação', 'IA de redacción', 'Writing AI')}
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              {t(
                'Seleciona secções (mira) e pede reescritas cirúrgicas. Enter = linha · Ctrl+Enter = enviar.',
                'Selecciona secciones (mira) y pide reescrituras quirúrgicas. Enter = línea · Ctrl+Enter = enviar.',
                'Select sections (crosshair) and ask for surgical rewrites. Enter = line · Ctrl+Enter = send.',
              )}
            </p>
            {aiTargetBlockIds.length > 0 && (
              <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-orange-800">
                    <Crosshair className="h-3 w-3" />
                    {t('Âmbito IA', 'Ámbito IA', 'AI scope')}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAiTargetBlockIds([])}
                    className="text-[11px] font-semibold text-orange-700 underline"
                  >
                    {t('Limpar', 'Limpiar', 'Clear')}
                  </button>
                </div>
                <ul className="flex flex-wrap gap-1">
                  {aiTargetBlockIds.map((bid) => (
                    <li key={bid}>
                      <button
                        type="button"
                        onClick={() => toggleAiTarget(bid)}
                        className="inline-flex max-w-[12rem] items-center gap-1 truncate rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-orange-900 ring-1 ring-orange-200"
                        title={bid}
                      >
                        <Sparkles className="h-3 w-3 shrink-0" />
                        <span className="truncate">{blockLabel(bid)}</span>
                        <X className="h-3 w-3 shrink-0 opacity-60" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                  'Dica: passa o rato num bloco → mira → «usar na IA». Ex.: «reescreve só isto com tom mais formal».',
                  'Tip: pasa el ratón por un bloque → mira → «usar en IA». Ej.: «reescribe solo esto con tono más formal».',
                  'Tip: hover a block → crosshair → “use for AI”. E.g. “rewrite only this more formally”.',
                )}
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  m.role === 'user' ? 'ml-4 bg-orange-50 text-slate-900' : 'mr-2 bg-slate-50 text-slate-800'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  <span>
                    {m.role === 'user'
                      ? m.actorName || t('Utilizador', 'Usuario', 'User')
                      : t('Assistente IA', 'Asistente IA', 'AI assistant')}
                  </span>
                  {m.createdAt && (
                    <span className="font-normal normal-case tracking-normal">
                      {new Date(m.createdAt).toLocaleString(locale === 'en' ? 'en' : locale)}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap">{m.content}</div>
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
              {dictationSupported && (
                <button
                  type="button"
                  disabled={chatBusy || !canEdit}
                  onClick={() => toggleDictation()}
                  title={
                    dictating
                      ? t('Parar ditado', 'Detener dictado', 'Stop dictation')
                      : t('Ditar (microfone)', 'Dictar (micrófono)', 'Dictate (microphone)')
                  }
                  className={`rounded-lg border p-2 disabled:opacity-40 ${
                    dictating
                      ? 'border-red-300 bg-red-50 text-red-700 animate-pulse'
                      : 'border-slate-200 text-slate-600 hover:border-orange-300 hover:bg-orange-50'
                  }`}
                >
                  {dictating ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
              <div className="relative min-w-0 flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={chatBusy || !canEdit}
                  rows={4}
                  placeholder={
                    dictating
                      ? t('A ouvir… fale agora', 'Escuchando… hable ahora', 'Listening… speak now')
                      : t(
                          'Escreva ou dite instruções… (Enter = parágrafo)',
                          'Escriba o dicte instrucciones… (Enter = párrafo)',
                          'Write or dictate instructions… (Enter = paragraph)',
                        )
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      if (dictating) stopDictation();
                      void sendChat();
                    }
                  }}
                  className="min-h-[96px] w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-orange-400"
                />
                {dictating && dictationInterim && (
                  <p className="pointer-events-none absolute bottom-2 left-3 right-3 truncate text-[11px] italic text-orange-700/80">
                    {dictationInterim}
                  </p>
                )}
              </div>
              <button
                type="button"
                disabled={chatBusy || !input.trim() || !canEdit}
                onClick={() => {
                  if (dictating) stopDictation();
                  void sendChat();
                }}
                className="rounded-lg bg-orange-600 p-2.5 text-white disabled:opacity-40"
                title="Ctrl+Enter"
              >
                {chatBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
          </>
          )}
        </aside>

        {/* Resize handle */}
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={() => {
            dragging.current = true;
          }}
          className={`hidden w-1.5 shrink-0 cursor-col-resize lg:block ${
            studioMode === 'design' ? 'bg-violet-900 hover:bg-violet-500' : 'bg-stone-300 hover:bg-orange-400'
          }`}
          title={t('Arrastar para redimensionar', 'Arrastrar para redimensionar', 'Drag to resize')}
        />

        {/* Documento + ferramentas laterais */}
        <div className="flex min-h-0 min-w-0 flex-1">
        <div
          className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"
          style={
            {
              ['--studio-brand' as string]: brandPrimary,
              ...(studioMode === 'design'
                ? {
                    backgroundColor: '#120c1a',
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, rgba(167,139,250,0.08) 1px, transparent 0)',
                    backgroundSize: '20px 20px',
                  }
                : {
                    backgroundColor: '#ebe6dc',
                    backgroundImage:
                      'radial-gradient(circle at 1px 1px, rgba(68,64,60,0.05) 1px, transparent 0)',
                    backgroundSize: '18px 18px',
                  }),
            }
          }
        >
          {studioMode === 'write' && (
            <StudioWriteRibbon
              disabled={!canEdit}
              onWrap={ribbonWrap}
              onKind={ribbonKind}
              onStyle={ribbonStyle}
              labels={{
                format: t('Formato', 'Formato', 'Format'),
                bold: t('Negrito', 'Negrita', 'Bold'),
                italic: t('Itálico', 'Cursiva', 'Italic'),
                underline: t('Sublinhado', 'Subrayado', 'Underline'),
                heading: t('Título', 'Título', 'Heading'),
                body: t('Corpo', 'Cuerpo', 'Body'),
                list: t('Lista', 'Lista', 'List'),
                hint: t(
                  'Selecione texto no documento — a faixa formata a seleção',
                  'Seleccione texto en el documento — la cinta formatea la selección',
                  'Select text in the document — the ribbon formats the selection',
                ),
              }}
            />
          )}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!canEdit}
              onClick={addPage}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                studioMode === 'design'
                  ? 'border-violet-700 bg-violet-950 text-violet-100 hover:bg-violet-900'
                  : 'border-stone-300 bg-white text-stone-700'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              {t('Nova folha', 'Nueva hoja', 'New page')}
            </button>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                studioMode === 'write'
                  ? 'bg-orange-100 text-orange-900'
                  : 'bg-violet-600 text-white'
              }`}
            >
              {studioMode === 'write'
                ? t('Espaço Redação · Word', 'Espacio Redacción · Word', 'Write space · Word')
                : t('Espaço Desenho · Canva/Gamma', 'Espacio Diseño · Canva/Gamma', 'Design space · Canva/Gamma')}
            </span>
            <span
              className={`text-xs ${studioMode === 'design' ? 'text-violet-300' : 'text-stone-500'}`}
            >
              {canvas.pages.length}{' '}
              {t('folha(s)', 'hoja(s)', 'page(s)')} · {pageSize}
            </span>
            {aiTargetBlockIds.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-900">
                <Crosshair className="h-3 w-3" />
                {aiTargetBlockIds.length}{' '}
                {t('secção(ões) para IA', 'sección(es) para IA', 'section(s) for AI')}
              </span>
            )}
          </div>

          {canEdit && studioMode === 'design' && (
            <div className="mx-auto mb-4 flex w-full max-w-[720px] flex-wrap items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50/90 px-2.5 py-2 shadow-sm">
              <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-violet-600">
                {t('Desenho', 'Diseño', 'Design')}
              </span>
              <button
                type="button"
                onClick={() => {
                  const pageId = activePageId || canvas.pages[0]?.id;
                  if (pageId) addBlock(pageId, 'diagram');
                }}
                className="inline-flex items-center gap-1 rounded-md border border-violet-300 bg-white px-2 py-1.5 text-[11px] font-bold text-violet-950 hover:bg-violet-100"
              >
                {t('Quadro de desenho', 'Lienzo de dibujo', 'Drawing board')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const pageId = activePageId || canvas.pages[0]?.id;
                  if (!pageId) return;
                  setImageTargetPageId(pageId);
                  setActivePageId(pageId);
                  imageInputRef.current?.click();
                }}
                className="rounded-md border border-violet-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-violet-900 hover:bg-violet-100"
              >
                {t('Imagem', 'Imagen', 'Image')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMolds(true);
                  void loadMolds();
                }}
                className="rounded-md border border-violet-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-violet-900 hover:bg-violet-100"
              >
                {t('Moldes', 'Moldes', 'Molds')}
              </button>
              <button
                type="button"
                onClick={() => {
                  const pageId = activePageId || canvas.pages[0]?.id;
                  if (!pageId) return;
                  applyCanvas((prev) => ({
                    ...prev,
                    pages: prev.pages.map((p) => {
                      if (p.id !== pageId) return p;
                      const sorted = p.blocks.slice().sort((a, b) => a.order - b.order);
                      return {
                        ...p,
                        blocks: sorted.map((b, j) => ({
                          ...b,
                          layout: {
                            xPct: j === 0 ? 8 : 6,
                            yPct: Math.min(78, 10 + j * 16),
                            wPct: j === 0 ? 84 : 88,
                          },
                        })),
                      };
                    }),
                  }));
                }}
                className="rounded-md border border-violet-300 bg-violet-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-violet-500"
              >
                {t('Posicionar na folha', 'Posicionar en hoja', 'Place on page')}
              </button>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              const pageId = imageTargetPageId || activePageId || canvas.pages[0]?.id;
              if (!file || !pageId) return;
              if (file.size > 2_500_000) {
                alert(
                  t(
                    'Imagem demasiado grande (máx. ~2,5 MB).',
                    'Imagen demasiado grande (máx. ~2,5 MB).',
                    'Image too large (max ~2.5 MB).',
                  ),
                );
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = typeof reader.result === 'string' ? reader.result : '';
                if (!dataUrl) return;
                applyCanvas((prev) => ({
                  ...prev,
                  pages: prev.pages.map((p) => {
                    if (p.id !== pageId) return p;
                    const order = p.blocks.length;
                    return {
                      ...p,
                      blocks: [
                        ...p.blocks,
                        {
                          id: `block-${Date.now()}-${order}`,
                          kind: 'image' as const,
                          text: file.name,
                          imageUrl: dataUrl,
                          order,
                        },
                      ],
                    };
                  }),
                }));
              };
              reader.readAsDataURL(file);
            }}
          />

          {canEdit && aiTargetBlockIds.length > 0 && (
            <div className="mx-auto mb-4 flex w-full max-w-[720px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white/95 px-2 py-1.5 shadow-sm">
              <span className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {t('Estilo', 'Estilo', 'Style')}
              </span>
              {(
                [
                  ['left', AlignLeft],
                  ['center', AlignCenter],
                  ['right', AlignRight],
                  ['justify', AlignJustify],
                ] as const
              ).map(([align, Icon]) => (
                <button
                  key={align}
                  type="button"
                  title={align}
                  onClick={() => patchSelectedStyles({ align })}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:border-orange-300 hover:bg-orange-50"
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
              {(
                [
                  ['sm', 'S'],
                  ['md', 'M'],
                  ['lg', 'L'],
                  ['xl', 'XL'],
                ] as const
              ).map(([textScale, label]) => (
                <button
                  key={textScale}
                  type="button"
                  onClick={() => patchSelectedStyles({ textScale })}
                  className="rounded-md border border-slate-200 px-1.5 py-1 text-[10px] font-bold text-slate-600 hover:border-orange-300 hover:bg-orange-50"
                >
                  {label}
                </button>
              ))}
              {(
                [
                  ['none', t('Sem moldura', 'Sin marco', 'No frame')],
                  ['subtle', t('Suave', 'Suave', 'Subtle')],
                  ['card', 'Card'],
                  ['accent', t('Destaque', 'Acento', 'Accent')],
                ] as const
              ).map(([frame, label]) => (
                <button
                  key={frame}
                  type="button"
                  onClick={() => patchSelectedStyles({ frame })}
                  className="rounded-md border border-slate-200 px-1.5 py-1 text-[10px] font-semibold text-slate-600 hover:border-orange-300 hover:bg-orange-50"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="mx-auto flex flex-col items-center gap-10 pb-16">
            {canvas.pages
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((page, idx) => {
                const size = (page.pageSize || pageSize) as StudioPageSize;
                const { width, height, wMm, hMm } = studioPageCssSize(size, 680, orientation);
                const marginPx = studioMarginsToCssPx(marginsMm, { w: wMm, h: hMm }, { width, height });
                const mold = page.moldId ? molds.find((m) => m.id === page.moldId) : null;
                const bg =
                  page.layoutMode === 'mold' && mold?.imageUrl
                    ? mold.imageUrl
                    : null;
                return (
                  <section
                    key={page.id}
                    className="relative"
                    onFocusCapture={() => setActivePageId(page.id)}
                    onMouseDown={() => setActivePageId(page.id)}
                    onBlurCapture={(e) => {
                      if (studioMode !== 'write' || !canEdit) return;
                      const next = e.relatedTarget as Node | null;
                      if (next && e.currentTarget.contains(next)) return;
                      window.setTimeout(() => {
                        const snap = canvasRef.current;
                        if (!snap || snap.studioMode === 'design') return;
                        const laid = layoutWriteDocument(snap);
                        if (laid === snap) return;
                        if (JSON.stringify(laid.pages) === JSON.stringify(snap.pages)) return;
                        applyCanvas(() => laid, false);
                      }, 80);
                    }}
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2" style={{ width }}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {page.title || `${t('Folha', 'Hoja', 'Sheet')} ${idx + 1}`} · {size} ·{' '}
                        {Math.round(wMm)}×{Math.round(hMm)} mm
                      </p>
                      {studioMode === 'design' && (
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
                                ? 'bg-violet-600 text-white'
                                : 'bg-white text-slate-600 border border-slate-200'
                            }`}
                          >
                            {t('Molde', 'Molde', 'Mold')}
                          </button>
                        </div>
                      )}
                    </div>
                    <div
                      className={
                        studioMode === 'design'
                          ? 'rounded-sm ring-2 ring-violet-300/70 ring-offset-2 ring-offset-[#e8e4dc]'
                          : undefined
                      }
                    >
                    <StudioSheet
                      width={width}
                      height={height}
                      pageLabel={`${idx + 1} / ${canvas.pages.length}`}
                      backgroundImage={bg}
                      canEdit={canEdit}
                      brandAccent={studioMode === 'design' ? brandPrimary : null}
                      freeform={
                        studioMode === 'design' &&
                        page.blocks.some((b) => b.layout && (b.layout.xPct != null || b.layout.yPct != null))
                      }
                      layout={
                        studioMode === 'write' && idx === canvas.pages.length - 1
                          ? 'flow'
                          : 'fixed'
                      }
                      marginPx={marginPx}
                      onOverflow={
                        studioMode === 'design' && canEdit
                          ? (info) => handleSheetOverflow(page.id, info)
                          : undefined
                      }
                    >
                      {page.blocks
                        .slice()
                        .sort((a, b) => a.order - b.order)
                        .map((block, blockIdx, arr) => (
                          <div key={block.id} data-studio-block-id={block.id} className="shrink-0">
                            <StudioDesignPlacedBlock
                              freeform={studioMode === 'design'}
                              layout={block.layout}
                              canEdit={canEdit}
                              onLayoutChange={(layout) => updateBlock(page.id, block.id, { layout })}
                            >
                            <StudioBlockEditor
                              block={block}
                              pageId={page.id}
                              writeMode={studioMode === 'write'}
                              disabled={!canEdit}
                              aiSelected={aiTargetBlockIds.includes(block.id)}
                              onToggleAiSelect={() => toggleAiTarget(block.id)}
                              canMoveUp={blockIdx > 0}
                              canMoveDown={blockIdx < arr.length - 1}
                              canDelete={arr.length > 1}
                              onChange={(text) => updateBlock(page.id, block.id, { text })}
                              onKindChange={(kind) => updateBlock(page.id, block.id, { kind })}
                              onDiagramLangChange={(diagramLang) =>
                                updateBlock(page.id, block.id, { diagramLang })
                              }
                              onStyleChange={(style) => updateBlock(page.id, block.id, { style })}
                              onMoveUp={() => moveBlock(page.id, block.id, -1)}
                              onMoveDown={() => moveBlock(page.id, block.id, 1)}
                              onDelete={() => removeBlock(page.id, block.id)}
                              onComment={() => {
                                setCommentBlockId(block.id);
                                setShowComments(true);
                              }}
                              labels={{
                                edit: t('Editar', 'Editar', 'Edit'),
                                preview: t('Ver documento', 'Ver documento', 'Preview'),
                                bold: t('Negrito', 'Negrita', 'Bold'),
                                italic: t('Itálico', 'Cursiva', 'Italic'),
                                list: t('Lista', 'Lista', 'List'),
                                heading: t('Subtítulo', 'Subtítulo', 'Subheading'),
                                code: t('Código', 'Código', 'Code'),
                                empty:
                                  studioMode === 'write'
                                    ? t('Comece a escrever…', 'Empiece a escribir…', 'Start typing…')
                                    : t('Clique para escrever…', 'Clic para escribir…', 'Click to write…'),
                                editSource: t('Editar código', 'Editar código', 'Edit source'),
                                templates: t('Modelos', 'Plantillas', 'Templates'),
                                asHeading: t('Como título', 'Como título', 'As heading'),
                                asText: t('Como texto', 'Como texto', 'As text'),
                                asList: t('Como lista', 'Como lista', 'As list'),
                                visual: t('Visual', 'Visual', 'Visual'),
                                mermaid: 'Mermaid',
                                drawHint: t(
                                  'Formas, setas, texto e lápis — estilo quadro branco',
                                  'Formas, flechas, texto y lápiz — estilo pizarra',
                                  'Shapes, arrows, text and pen — whiteboard style',
                                ),
                                expandDraw: t('Ecrã completo', 'Pantalla completa', 'Full screen'),
                                collapseDraw: t('Fechar', 'Cerrar', 'Close'),
                                selectForAi: t('Usar na IA', 'Usar en la IA', 'Use for AI'),
                                selectedForAi: t('No âmbito da IA', 'En ámbito de IA', 'In AI scope'),
                              }}
                            />
                            </StudioDesignPlacedBlock>
                          </div>
                        ))}
                    </StudioSheet>
                    </div>
                    {canEdit && studioMode === 'write' && idx === canvas.pages.length - 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5" style={{ width }}>
                        <button
                          type="button"
                          onClick={() => addBlock(page.id, 'paragraph')}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:border-orange-300 hover:bg-orange-50"
                        >
                          {t('+ Continuar a escrever', '+ Seguir escribiendo', '+ Keep writing')}
                        </button>
                      </div>
                    )}
                    {canEdit && studioMode === 'design' && idx === canvas.pages.length - 1 && (
                      <div className="mt-2 flex flex-wrap gap-1.5" style={{ width }}>
                        <button
                          type="button"
                          onClick={() => addBlock(page.id, 'diagram')}
                          className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-900 shadow-sm hover:bg-violet-100"
                        >
                          {t('+ Quadro de desenho', '+ Lienzo de dibujo', '+ Drawing board')}
                        </button>
                        <button
                          type="button"
                          onClick={addPage}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm hover:border-violet-300 hover:bg-violet-50"
                        >
                          {t('+ Folha', '+ Hoja', '+ Page')}
                        </button>
                      </div>
                    )}
                  </section>
                );
              })}
          </div>
        </div>

        <StudioToolsSidebar
          open={toolsOpen}
          onOpenChange={setToolsOpen}
          mode={studioMode}
          onModeChange={setStudioMode}
          pageSize={pageSize}
          orientation={orientation}
          margins={marginsMm}
          disabled={!canEdit}
          pageCount={canvas.pages.length}
          onPageSize={setDocPageSize}
          onOrientation={setDocOrientation}
          onMargins={setDocMargins}
          onOpenMolds={() => {
            setShowMolds(true);
            void loadMolds();
          }}
          onInsert={(kind) => {
            const pageId = activePageId || canvas.pages[0]?.id;
            if (!pageId) return;
            if (kind === 'image') {
              setImageTargetPageId(pageId);
              setActivePageId(pageId);
              imageInputRef.current?.click();
              return;
            }
            addBlock(pageId, kind);
          }}
          labels={{
            tools: t('Ferramentas', 'Herramientas', 'Tools'),
            collapse: t('Minimizar', 'Minimizar', 'Collapse'),
            expand: t('Abrir ferramentas', 'Abrir herramientas', 'Open tools'),
            mode: t('Etapa', 'Etapa', 'Stage'),
            write: t('Redação', 'Redacción', 'Write'),
            writeHint: t(
              'Espaço Word: texto + IA de redação',
              'Espacio Word: texto + IA de redacción',
              'Word space: text + writing AI',
            ),
            writeIntro: t(
              'Redação contínua nas folhas. Usa a barra Formato e a IA à esquerda.',
              'Redacción continua en las hojas. Usa la barra Formato y la IA a la izquierda.',
              'Continuous writing on sheets. Use the Format bar and the AI on the left.',
            ),
            design: t('Desenho', 'Diseño', 'Design'),
            designHint: t('Espaço Canva/Gamma + IA layout', 'Espacio Canva/Gamma + IA layout', 'Canva/Gamma space + layout AI'),
            designIntro: t(
              'Folhas fixas + IA de diagramação (brand kit). O texto vem da Redação.',
              'Hojas fijas + IA de diagramación (brand kit). El texto viene de Redacción.',
              'Fixed sheets + layout AI (brand kit). Text comes from Write.',
            ),
            page: t('Página', 'Página', 'Page'),
            size: t('Tamanho', 'Tamaño', 'Size'),
            orientation: t('Orientação', 'Orientación', 'Orientation'),
            portrait: t('Retrato', 'Vertical', 'Portrait'),
            landscape: t('Paisagem', 'Horizontal', 'Landscape'),
            margins: t('Margens', 'Márgenes', 'Margins'),
            normal: t('Normal', 'Normal', 'Normal'),
            narrow: t('Estreitas', 'Estrechas', 'Narrow'),
            moderate: t('Moderadas', 'Moderados', 'Moderate'),
            wide: t('Largas', 'Anchos', 'Wide'),
            custom: t('Personalizadas', 'Personalizados', 'Custom'),
            top: t('Superior', 'Superior', 'Top'),
            right: t('Direita', 'Derecha', 'Right'),
            bottom: t('Inferior', 'Inferior', 'Bottom'),
            left: t('Esquerda', 'Izquierda', 'Left'),
            allSides: t('Usar superior em todos', 'Usar superior en todos', 'Use top on all sides'),
            insert: t('Inserir', 'Insertar', 'Insert'),
            text: t('Texto', 'Texto', 'Text'),
            heading: t('Título', 'Título', 'Heading'),
            list: t('Lista', 'Lista', 'List'),
            callout: t('Destaque', 'Destacado', 'Callout'),
            diagram: t('Diagrama', 'Diagrama', 'Diagram'),
            image: t('Imagem', 'Imagen', 'Image'),
            designTools: t('Ferramentas de desenho', 'Herramientas de diseño', 'Design tools'),
            drawBoard: t('Quadro de desenho', 'Lienzo de dibujo', 'Drawing board'),
            molds: t('Moldes de página', 'Moldes de página', 'Page molds'),
            aiScope: t(
              'Mira / Shift+clique = âmbito IA',
              'Mira / Shift+clic = ámbito IA',
              'Crosshair / Shift+click = AI scope',
            ),
          }}
        />
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

      <DocumentLinksPanel
        targetType="studio"
        documentId={id}
        companyId={companyId || undefined}
        canEdit={canEdit}
        open={showLinks}
        onClose={() => setShowLinks(false)}
        labels={{
          title: t('Vínculos do documento', 'Vínculos del documento', 'Document links'),
          hint: t(
            'Liga este documento a NEXUS (AT), SIEP, FUNDHUB, empresa, etc. A IA usa estes vínculos como contexto.',
            'Vincula este documento a NEXUS (AT), SIEP, FUNDHUB, empresa, etc. La IA usa estos vínculos como contexto.',
            'Link this document to NEXUS (AT), SIEP, FUNDHUB, company, etc. AI uses these links as context.',
          ),
          system: t('Sistema', 'Sistema', 'System'),
          entity: t('Entidade', 'Entidad', 'Entity'),
          add: t('Adicionar vínculo', 'Añadir vínculo', 'Add link'),
          empty: t('Ainda sem vínculos — escolhe um sistema abaixo.', 'Aún sin vínculos — elige un sistema abajo.', 'No links yet — pick a system below.'),
          close: t('Fechar', 'Cerrar', 'Close'),
          loading: t('A carregar…', 'Cargando…', 'Loading…'),
        }}
      />

      {showFolderContext && docFolderId && (
        <StudioContextPanel
          companyId={companyId || undefined}
          folderId={docFolderId}
          canEdit={canEdit}
          open
          onClose={() => setShowFolderContext(false)}
        />
      )}

      {showHistory && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-bold text-slate-900">
                {t('Rastreabilidade', 'Trazabilidad', 'Traceability')}
              </h3>
              <button type="button" onClick={() => setShowHistory(false)}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setHistoryTab('activity')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                  historyTab === 'activity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {t('Atividade', 'Actividad', 'Activity')}
              </button>
              <button
                type="button"
                onClick={() => setHistoryTab('versions')}
                className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold ${
                  historyTab === 'versions' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                {t('Versões', 'Versiones', 'Versions')}
              </button>
            </div>

            {historyTab === 'activity' ? (
              activities.length === 0 ? (
                <p className="text-sm text-slate-500">
                  {t(
                    'Ainda sem eventos. Guardar ou falar com a IA cria o histórico.',
                    'Aún sin eventos. Guardar o hablar con la IA crea el historial.',
                    'No events yet. Saving or chatting with AI creates the trail.',
                  )}
                </p>
              ) : (
                <ul className="space-y-2">
                  {activities.map((a) => {
                    const who = a.actor?.name?.trim() || a.actor?.email || '—';
                    const kindLabel =
                      a.kind === 'ai_prompt'
                        ? t('IA · pedido', 'IA · pedido', 'AI · prompt')
                        : a.kind === 'ai_response'
                          ? t('IA · resposta', 'IA · respuesta', 'AI · reply')
                          : a.kind === 'ai_edit'
                            ? t('IA · edição', 'IA · edición', 'AI · edit')
                            : a.kind === 'saved'
                              ? t('Guardado', 'Guardado', 'Saved')
                              : a.kind === 'restored'
                                ? t('Restaurado', 'Restaurado', 'Restored')
                                : a.kind === 'imported'
                                  ? t('Importado', 'Importado', 'Imported')
                                  : a.kind === 'created'
                                    ? t('Criado', 'Creado', 'Created')
                                    : a.kind === 'shared'
                                      ? t('Partilha', 'Compartido', 'Shared')
                                      : a.kind === 'comment'
                                        ? t('Comentário', 'Comentario', 'Comment')
                                        : a.kind;
                    return (
                      <li
                        key={a.id}
                        className="rounded-lg border border-slate-100 px-3 py-2 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            {kindLabel}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(a.createdAt).toLocaleString(locale === 'en' ? 'en' : locale)}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-800">{a.summary}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">
                          {t('Por', 'Por', 'By')} {who}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )
            ) : versions.length === 0 ? (
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
                        {v.createdBy
                          ? ` · ${v.createdBy.name?.trim() || v.createdBy.email}`
                          : ''}
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

      {showComments && (
        <StudioCommentsPanel
          documentId={id}
          locale={locale}
          open
          focusBlockId={commentBlockId}
          blockTitles={Object.fromEntries(
            (canvas?.pages || []).flatMap((p) =>
              p.blocks.map((b) => [b.id, b.title || b.kind] as [string, string]),
            ),
          )}
          onCountChange={setOpenCommentCount}
          onClose={() => {
            setShowComments(false);
            setCommentBlockId(null);
          }}
        />
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

