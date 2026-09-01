'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  Save,
  Send,
  Check,
  X,
  FileType,
  Paperclip,
  Undo2,
  Redo2,
  History,
  Plus,
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
  Table2,
  Layers,
  ChevronUp,
  Play,
  Monitor,
  Presentation,
  Download,
  Pencil,
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
import { getStudioWriteFocus, requestStudioWriteBlockFocus, runStudioWriteCommand, subscribeStudioWriteFocus } from '@/lib/studio/write-editor-bus';
import { StudioSheet } from '@/components/studio/StudioSheet';
import {
  StudioCascadeToolsRail,
  type CascadeSection,
} from '@/components/studio/StudioCascadeToolsRail';
import { DocumentLinksPanel } from '@/components/studio/DocumentLinksPanel';
import { StudioDocumentTitle } from '@/components/studio/StudioDocumentTitle';
import { StudioDesignAiPanel } from '@/components/studio/StudioDesignAiPanel';
import { StudioCopilotComposer } from '@/components/studio/StudioCopilotComposer';
import { StudioCollapsibleRail } from '@/components/studio/StudioCollapsibleRail';
import { StudioDocMoreMenu } from '@/components/studio/StudioDocMoreMenu';
import { StudioChatAttachmentChips } from '@/components/studio/StudioChatAttachmentChips';
import { StudioStoryboardPlayer } from '@/components/studio/StudioStoryboardPlayer';
import { StudioPresenterMode } from '@/components/studio/StudioPresenterMode';
import {
  collectStudioVideoScenes,
  patchBlockMediaMeta,
  storyboardToSrt,
} from '@/lib/studio/video-timeline';
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
import { defaultTableMarkdown } from '@/lib/studio/table-markdown';
import {
  shouldApplyStudioDocumentFetch,
  shouldPersistStudioDocument,
  detectStudioContentMismatch,
} from '@/lib/studio/document-scope';
import type { StudioCopilotAction, StudioCopilotMode } from '@/lib/studio/copilot-modes';
import { actionUserMessage } from '@/lib/studio/copilot-modes';
import { StudioCollapsedChatContent } from '@/components/studio/StudioCollapsedChatContent';
import { StudioStructureActionBar } from '@/components/studio/StudioStructureActionBar';
import { StudioSelectionScopeBar } from '@/components/studio/StudioSelectionScopeBar';
import {
  blockLabelWithPage,
  pageSelectionState,
  togglePageBlockSelection,
} from '@/lib/studio/selection-scope';
import {
  findPageIdForBlock,
  previewStructurePatches,
} from '@/lib/studio/canvas-patch-preview';
import { canvasWarrantsStructureMigration } from '@/lib/studio/structure-migrate';
import type { StudioStructureSessionState } from '@/lib/studio/structure-apply';
import { parseStudioChatMessageContent } from '@/lib/studio/chat-message-display';
import { copilotStatusHint } from '@/lib/studio/copilot-status';
import {
  readStudioCascadeSection,
  readStudioChatPanelOpen,
  readStudioToolsPanelOpen,
  writeStudioCascadeSection,
  writeStudioChatPanelOpen,
  writeStudioToolsPanelOpen,
} from '@/lib/studio/editor-panel-prefs';
import { canDeleteStudioDocument, type StudioAccessLevel } from '@/lib/studio/access-levels';
import { parseStudioApiResponse } from '@/lib/studio/api-response';

type ChatMsg = {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
  actorName?: string | null;
  attachmentNames?: string[];
  scopeLabel?: string;
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
const STUDIO_CHAT_FILE_MAX = 6;

function filterStudioChatFiles(files: Iterable<File>): File[] {
  return Array.from(files).filter((f) => {
    const name = f.name.toLowerCase();
    const type = (f.type || '').toLowerCase();
    if (/\.(pdf|txt|md|csv|json|docx)$/.test(name)) return true;
    if (/^image\/(png|jpeg|webp|gif)$/i.test(type)) return true;
    if (
      type === 'application/pdf' ||
      type === 'application/json' ||
      type === 'text/plain' ||
      type === 'text/csv' ||
      type === 'text/markdown' ||
      type.includes('wordprocessingml')
    ) {
      return true;
    }
    return false;
  });
}

export default function StudioDocumentPage() {
  const params = useParams();
  const router = useRouter();
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [consent, setConsent] = useState<StudioConsentRequest | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [exporting, setExporting] = useState<'pdf' | 'docx' | 'pptx' | 'xlsx' | null>(null);
  const [slideFocusMode, setSlideFocusMode] = useState(false);
  const [presenterOpen, setPresenterOpen] = useState(false);
  const [storyboardOpen, setStoryboardOpen] = useState(false);
  const [access, setAccess] = useState<string>('owner');
  const [shareOpen, setShareOpen] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [showFolderContext, setShowFolderContext] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [chatFileDragOver, setChatFileDragOver] = useState(false);
  const [folderContextCount, setFolderContextCount] = useState(0);
  const [chatWidth, setChatWidth] = useState(320);
  const [undoStack, setUndoStack] = useState<StudioCanvasState[]>([]);
  const [redoStack, setRedoStack] = useState<StudioCanvasState[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState<'activity' | 'versions'>('activity');
  const [lastEditedBy, setLastEditedBy] = useState<string | null>(null);
  const [lastEditedAt, setLastEditedAt] = useState<string | null>(null);
  const [molds, setMolds] = useState<MoldRow[]>([]);
  const [showMolds, setShowMolds] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentBlockId, setCommentBlockId] = useState<string | null>(null);
  const [openCommentCount, setOpenCommentCount] = useState(0);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [toolsPanelOpen, setToolsPanelOpen] = useState(true);
  const [cascadeSection, setCascadeSection] = useState<CascadeSection>('format');
  const [chatPanelOpen, setChatPanelOpen] = useState(true);
  const [duplicating, setDuplicating] = useState(false);
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
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatBranchRef = useRef<{ fromId?: string; afterId?: string } | null>(null);
  const chatFileDragDepthRef = useRef(0);
  const moldFileRef = useRef<HTMLInputElement | null>(null);
  const dragging = useRef(false);
  const chatDragStart = useRef({ x: 0, w: 320 });
  const skipHistory = useRef(false);
  const clientIdRef = useRef(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `c-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  const knownUpdatedAt = useRef<string | null>(null);
  /** Bumped on every [id] change — stale fetches must not mutate state. */
  const docEpochRef = useRef(0);
  const activeDocIdRef = useRef<string | null>(null);
  const selfUserIdRef = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const canvasRef = useRef<StudioCanvasState | null>(null);
  const titleRef = useRef('');
  const saveLockRef = useRef(false);
  const saveAgainRef = useRef(false);
  const saveEpochRef = useRef(0);
  const textEditBaselineRef = useRef<StudioCanvasState | null>(null);
  const activePageSpyTimerRef = useRef<number | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [dictationInterim, setDictationInterim] = useState('');
  /** Blocos selecionados como âmbito da IA (anti-wipe) */
  const [aiTargetBlockIds, setAiTargetBlockIds] = useState<string[]>([]);
  const [copilotMode, setCopilotMode] = useState<StudioCopilotMode>('discuss');
  const [pendingStructureActions, setPendingStructureActions] = useState<StudioCopilotAction[]>([]);
  const [structureSessionState, setStructureSessionState] =
    useState<StudioStructureSessionState | null>(null);
  /** Highlight temporário após edição IA (scroll + flash). */
  const [aiEditedBlockIds, setAiEditedBlockIds] = useState<string[]>([]);
  const aiEditHighlightTimerRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageTargetPageId, setImageTargetPageId] = useState<string | null>(null);
  const [brandPrimary, setBrandPrimary] = useState('#ea580c');

  useEffect(() => {
    setChatPanelOpen(readStudioChatPanelOpen());
    setToolsPanelOpen(readStudioToolsPanelOpen());
    setCascadeSection(readStudioCascadeSection());
  }, []);

  useEffect(() => {
    writeStudioChatPanelOpen(chatPanelOpen);
  }, [chatPanelOpen]);

  useEffect(() => {
    writeStudioToolsPanelOpen(toolsPanelOpen);
  }, [toolsPanelOpen]);

  useEffect(() => {
    writeStudioCascadeSection(cascadeSection);
  }, [cascadeSection]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    canvasRef.current = canvas;
  }, [canvas]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useLayoutEffect(() => {
    docEpochRef.current += 1;
    saveEpochRef.current += 1;
    activeDocIdRef.current = null;
    setLoading(true);
    setError(null);
    setTitle('');
    setCanvas(null);
    canvasRef.current = null;
    dirtyRef.current = false;
    knownUpdatedAt.current = null;
    setDirty(false);
    setMessages([]);
    setVersions([]);
    setActivities([]);
    setConsent(null);
    setPendingPrompt(null);
    setAiTargetBlockIds([]);
    setUndoStack([]);
    setRedoStack([]);
    setShowHistory(false);
    setRemoteUpdate(null);
    setOpenCommentCount(0);
    setInput('');
    setPendingFiles([]);
  }, [id]);

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

  useEffect(() => {
    return () => {
      if (activePageSpyTimerRef.current) window.clearTimeout(activePageSpyTimerRef.current);
    };
  }, []);

  /** Persistência com mutex — nunca grava um canvas antigo por cima de um merge recente. */
  const persistCanvas = useCallback(
    async (opts?: { quiet?: boolean; forceSnap?: StudioCanvasState | null }) => {
      if (!canEdit || !id) return false;
      const docId = id;
      const epochAtStart = docEpochRef.current;
      if (saveLockRef.current) {
        saveAgainRef.current = true;
        return false;
      }
      saveLockRef.current = true;
      let ok = false;
      try {
        do {
          saveAgainRef.current = false;
          if (!shouldPersistStudioDocument(docId, epochAtStart, id, docEpochRef.current)) {
            break;
          }
          const snap = opts?.forceSnap || canvasRef.current;
          opts = { ...opts, forceSnap: null };
          if (!snap) break;
          const epoch = ++saveEpochRef.current;
          setAutoSaveState('saving');
          setSaving(true);
          const r = await fetch(`/api/studio/documents/${docId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: companyId || undefined,
              documentId: docId,
              title: titleRef.current,
              canvasState: snap,
              clientRevision: knownUpdatedAt.current,
              createVersion: opts?.quiet === false,
              quiet: opts?.quiet !== false,
              versionLabel: opts?.quiet === false ? 'Após reunir documento' : undefined,
            }),
          });
          const d = await r.json().catch(() => ({}));
          if (!shouldPersistStudioDocument(docId, epochAtStart, id, docEpochRef.current)) {
            break;
          }
          if (!r.ok) throw new Error((d as { detail?: string; error?: string }).detail || (d as { error?: string }).error || 'Erro');

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

  const commitTextEditHistory = useCallback(() => {
    const baseline = textEditBaselineRef.current;
    textEditBaselineRef.current = null;
    const cur = canvasRef.current;
    if (baseline && cur && !skipHistory.current && JSON.stringify(cur) !== JSON.stringify(baseline)) {
      pushHistory(baseline);
    }
  }, [pushHistory]);

  useEffect(() => {
    return subscribeStudioWriteFocus(() => {
      const focus = getStudioWriteFocus();
      if (focus) {
        if (!textEditBaselineRef.current && canvasRef.current) {
          textEditBaselineRef.current = structuredClone(canvasRef.current);
        }
        return;
      }
      commitTextEditHistory();
    });
  }, [commitTextEditHistory]);

  const undo = useCallback(() => {
    commitTextEditHistory();
    setUndoStack((stack) => {
      if (!stack.length) return stack;
      const cur = canvasRef.current;
      if (!cur) return stack;
      const prev = stack[stack.length - 1]!;
      setRedoStack((r) => [...r, structuredClone(cur)]);
      skipHistory.current = true;
      canvasRef.current = prev;
      setCanvas(prev);
      skipHistory.current = false;
      dirtyRef.current = true;
      setDirty(true);
      return stack.slice(0, -1);
    });
  }, [commitTextEditHistory]);

  const redo = useCallback(() => {
    commitTextEditHistory();
    setRedoStack((stack) => {
      if (!stack.length) return stack;
      const cur = canvasRef.current;
      if (!cur) return stack;
      const next = stack[stack.length - 1]!;
      setUndoStack((u) => [...u, structuredClone(cur)]);
      skipHistory.current = true;
      canvasRef.current = next;
      setCanvas(next);
      skipHistory.current = false;
      dirtyRef.current = true;
      setDirty(true);
      return stack.slice(0, -1);
    });
  }, [commitTextEditHistory]);

  const loadVersions = useCallback(async () => {
    const docId = id;
    const epoch = docEpochRef.current;
    const r = await fetch(`/api/studio/documents/${docId}/versions?_=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!r.ok) return;
    const d = await r.json();
    if (!shouldApplyStudioDocumentFetch(docId, id, epoch, docEpochRef.current)) return;
    if (d.documentId && d.documentId !== docId) return;
    setVersions(d.versions || []);
  }, [id]);

  const loadActivity = useCallback(async () => {
    const docId = id;
    const epoch = docEpochRef.current;
    const r = await fetch(`/api/studio/documents/${docId}/activity?_=${Date.now()}`, {
      cache: 'no-store',
    });
    if (!r.ok) return;
    const d = await r.json();
    if (!shouldApplyStudioDocumentFetch(docId, id, epoch, docEpochRef.current)) return;
    if (d.document?.id && d.document.id !== docId) return;
    setActivities(d.activities || []);
    const ub = d.document?.updatedBy;
    if (ub) setLastEditedBy(ub.name?.trim() || ub.email || null);
    if (d.document?.updatedAt) setLastEditedAt(d.document.updatedAt);
  }, [id]);

  const openHistory = useCallback(
    (tab: 'activity' | 'versions' = 'activity') => {
      setHistoryTab(tab);
      setShowHistory(true);
      setHistoryLoading(true);
      setActivities([]);
      setVersions([]);
      void Promise.all([loadActivity(), loadVersions()]).finally(() => setHistoryLoading(false));
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
    const docId = id;
    const epoch = docEpochRef.current;
    setLoading(true);
    setError(null);
    try {
      const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const r = await fetch(`/api/studio/documents/${docId}${q}`);
      const d = await r.json();
      if (!shouldApplyStudioDocumentFetch(docId, id, epoch, docEpochRef.current)) return;
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
        `/api/studio/documents/${docId}/copilot${companyId ? `?companyId=${encodeURIComponent(companyId)}` : ''}`,
      );
      if (shouldApplyStudioDocumentFetch(docId, id, epoch, docEpochRef.current) && mr.ok) {
        const md = await mr.json();
        setMessages(
          (md.messages || []).map(
            (m: {
              id: string;
              role: string;
              content: string;
              createdAt?: string;
              actor?: { name?: string | null; email?: string | null } | null;
            }) => {
              const parsed =
                m.role === 'user' ? parseStudioChatMessageContent(m.content) : { text: m.content };
              return {
                id: m.id,
                role: m.role,
                content: parsed.text,
                createdAt: m.createdAt,
                actorName: m.actor?.name?.trim() || m.actor?.email || null,
                attachmentNames: parsed.attachmentNames,
                scopeLabel: parsed.scopeLabel,
              };
            },
          ),
        );
        if (md.copilotSession) {
          if (typeof md.copilotSession.mode === 'string') {
            setCopilotMode(md.copilotSession.mode as StudioCopilotMode);
          }
          setPendingStructureActions(
            Array.isArray(md.copilotSession.pendingActions)
              ? md.copilotSession.pendingActions
              : [],
          );
          setStructureSessionState(
            md.copilotSession.structureState &&
              typeof md.copilotSession.structureState === 'object'
              ? (md.copilotSession.structureState as StudioStructureSessionState)
              : null,
          );
        }
      }
      void loadVersions();
      void loadActivity();
      void loadMolds();
      fetch(`/api/studio/documents/${docId}/comments`, { cache: 'no-store' })
        .then(async (cr) => {
          if (!shouldApplyStudioDocumentFetch(docId, id, epoch, docEpochRef.current)) return;
          if (!cr.ok) return;
          const cd = await cr.json();
          setOpenCommentCount(
            typeof cd.openCount === 'number'
              ? cd.openCount
              : (cd.comments || []).filter((c: { resolvedAt?: string | null }) => !c.resolvedAt).length,
          );
        })
        .catch(() => {});
      activeDocIdRef.current = docId;
    } catch (e: unknown) {
      if (!shouldApplyStudioDocumentFetch(docId, id, epoch, docEpochRef.current)) return;
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      if (shouldApplyStudioDocumentFetch(docId, id, epoch, docEpochRef.current)) {
        setLoading(false);
      }
    }
  }, [id, companyId, setActiveCompanyId, loadVersions, loadActivity, loadMolds]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const scroller = chatScrollRef.current;
    const hasContent =
      messages.length > 0 || !!consent || pendingStructureActions.length > 0;
    if (!hasContent) {
      if (scroller) scroller.scrollTop = 0;
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, consent, pendingStructureActions.length]);

  useEffect(() => {
    if (aiTargetBlockIds.length > 0) {
      setCopilotMode('edit_selection');
    }
  }, [aiTargetBlockIds.length]);

  const pageAiSelectionMap = useMemo(() => {
    if (!canvas) return {};
    const out: Record<string, ReturnType<typeof pageSelectionState>> = {};
    for (const p of canvas.pages) {
      out[p.id] = pageSelectionState(canvas, p.id, aiTargetBlockIds);
    }
    return out;
  }, [canvas, aiTargetBlockIds]);

  const structureActionPreview = useMemo(() => {
    if (
      !canvas ||
      !structureSessionState?.proposalText ||
      structureSessionState.status !== 'approved'
    ) {
      return null;
    }
    const apply = previewStructurePatches(
      canvas,
      structureSessionState.proposalText,
      'apply',
    );
    if (!apply.blockIds.length) return null;
    const canMigrate = canvasWarrantsStructureMigration(canvas);
    const migrate = canMigrate
      ? previewStructurePatches(canvas, structureSessionState.proposalText, 'migrate')
      : undefined;
    return { apply, migrate };
  }, [canvas, structureSessionState]);

  const composerStatusHint = useMemo(() => {
    const loc = locale === 'en' || locale === 'es' ? locale : 'pt';
    return copilotStatusHint(copilotMode, structureSessionState, loc);
  }, [copilotMode, structureSessionState, locale]);

  const focusAiEditedBlocks = useCallback(
    (blockIds: string[], canvasOverride?: StudioCanvasState | null) => {
      const unique = [...new Set(blockIds.filter(Boolean))];
      if (!unique.length) return;
      setAiEditedBlockIds(unique);
      if (aiEditHighlightTimerRef.current) {
        window.clearTimeout(aiEditHighlightTimerRef.current);
      }
      const c = canvasOverride ?? canvas;
      const firstId = unique[0]!;
      const pageId = c ? findPageIdForBlock(c, firstId) : null;
      if (pageId) setActivePageId(pageId);
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-studio-block-id="${firstId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      aiEditHighlightTimerRef.current = window.setTimeout(() => {
        setAiEditedBlockIds([]);
        aiEditHighlightTimerRef.current = null;
      }, 6500);
    },
    [canvas],
  );

  useEffect(() => {
    return () => {
      if (aiEditHighlightTimerRef.current) {
        window.clearTimeout(aiEditHighlightTimerRef.current);
      }
    };
  }, []);

  /** Scroll spy — folha activa ao percorrer o documento (estilo Word). */
  useEffect(() => {
    const root = canvasScrollRef.current;
    if (!root || !canvas?.pages.length) return;
    const sections = root.querySelectorAll<HTMLElement>('[data-studio-page-id]');
    if (!sections.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        let best: { id: string; ratio: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const pageId = (e.target as HTMLElement).dataset.studioPageId;
          if (!pageId) continue;
          if (!best || e.intersectionRatio > best.ratio) {
            best = { id: pageId, ratio: e.intersectionRatio };
          }
        }
        if (best) {
          if (activePageSpyTimerRef.current) window.clearTimeout(activePageSpyTimerRef.current);
          activePageSpyTimerRef.current = window.setTimeout(() => {
            activePageSpyTimerRef.current = null;
            setActivePageId(best!.id);
          }, 120);
        }
      },
      { root, threshold: [0.25, 0.5, 0.75] },
    );
    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [canvas?.pages.map((p) => p.id).join('|')]);

  /** Atalhos folha anterior/seguinte — PageUp/PageDown ou Alt+↑/↓ */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el?.closest('input, textarea, [contenteditable="true"], .ProseMirror')) return;
      if (!canvas?.pages.length) return;
      const sorted = canvas.pages.slice().sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((p) => p.id === activePageId);
      const cur = idx >= 0 ? idx : 0;
      const next =
        e.key === 'PageDown' || (e.altKey && e.key === 'ArrowDown')
          ? cur + 1
          : e.key === 'PageUp' || (e.altKey && e.key === 'ArrowUp')
            ? cur - 1
            : -1;
      if (next < 0 || next >= sorted.length) return;
      e.preventDefault();
      const pageId = sorted[next]!.id;
      setActivePageId(pageId);
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-studio-page-id="${pageId}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canvas, activePageId]);

  /** Esc — cancelar plano pendiente ou consentimento IA. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if ((e.target as HTMLElement | null)?.closest('[role="dialog"]')) return;

      if (consent) {
        e.preventDefault();
        setConsent(null);
        setPendingPrompt(null);
        return;
      }

      if (
        pendingStructureActions.includes('cancel_plan') &&
        !chatBusy &&
        canEdit &&
        activeDocIdRef.current === id
      ) {
        e.preventDefault();
        void sendChat({ action: 'cancel_plan', mode: 'discuss' });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [consent, pendingStructureActions, chatBusy, canEdit, id]);

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
      const docId = id;
      const epochAtStart = docEpochRef.current;
      if (!dirtyRef.current || !canEdit || !docId) return;
      const snap = canvasRef.current;
      if (!snap) return;
      if (!shouldPersistStudioDocument(docId, epochAtStart, id, docEpochRef.current)) return;
      try {
        void fetch(`/api/studio/documents/${docId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            companyId: companyId || undefined,
            documentId: docId,
            title: titleRef.current,
            canvasState: snap,
            clientRevision: knownUpdatedAt.current,
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
      const delta = e.clientX - chatDragStart.current.x;
      const next = Math.min(520, Math.max(260, chatDragStart.current.w + delta));
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
      imageUrl?: string | null;
      imagePrompt?: string;
      mediaMeta?: StudioBlock['mediaMeta'];
      imageEdit?: StudioBlock['imageEdit'];
    },
  ) {
    const isTextOnly = Object.keys(patch).length === 1 && patch.text !== undefined;
    applyCanvas((prev) => {
      if (patch.text !== undefined) {
        const page = prev.pages.find((p) => p.id === pageId);
        const block = page?.blocks.find((b) => b.id === blockId);
        if (block) {
          const prevText = String(block.text || '');
          const nextText = String(patch.text);
          const focus = getStudioWriteFocus();
          // Rejeita wipe acidental (editor a serializar vazio com conteúdo visível).
          if (
            focus?.blockId === blockId &&
            prevText.trim().length >= 8 &&
            !nextText.trim() &&
            prevText.length > 32
          ) {
            return prev;
          }
        }
      }
      let next = {
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
                        ...(patch.imageUrl !== undefined ? { imageUrl: patch.imageUrl } : {}),
                        ...(patch.imagePrompt !== undefined ? { imagePrompt: patch.imagePrompt } : {}),
                        ...(patch.mediaMeta !== undefined ? { mediaMeta: patch.mediaMeta } : {}),
                        ...(patch.imageEdit !== undefined ? { imageEdit: patch.imageEdit } : {}),
                      }
                    : b,
                ),
              },
        ),
      };
      return next;
    }, !isTextOnly);
  }

  async function generateBlockImage(pageId: string, blockId: string, prompt?: string) {
    if (!canEdit) return;
    try {
      const r = await fetch(`/api/studio/documents/${id}/generate-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blockId, prompt }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      if (d.canvasState) {
        if (!skipHistory.current && canvas) pushHistory(canvas);
        const normalized = normalizeStudioCanvas(d.canvasState);
        canvasRef.current = normalized;
        dirtyRef.current = true;
        setCanvas(normalized);
        setDirty(true);
        void persistCanvas({ quiet: true, forceSnap: normalized });
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    }
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

  async function saveAsCompanyTemplate() {
    if (!canvasRef.current || !companyId || !canEdit) return;
    const name = window.prompt(
      t(
        'Nome da plantilla da empresa',
        'Nombre de la plantilla de la empresa',
        'Company template name',
      ),
      title || t('Minha plantilla', 'Mi plantilla', 'My template'),
    );
    if (!name?.trim()) return;
    setSavingTemplate(true);
    try {
      if (dirty) await persistCanvas({ quiet: true, forceSnap: canvasRef.current });
      const r = await fetch('/api/studio/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId,
          name: name.trim(),
          canvasState: canvasRef.current,
          description: t(
            'Pré-estrutura reutilizável (layout Design + texto).',
            'Preestructura reutilizable (layout Diseño + texto).',
            'Reusable pre-structure (Design layout + text).',
          ),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error);
      alert(
        t(
          'Plantilla guardada. Aparece em Criar → As nossas.',
          'Plantilla guardada. Aparece en Crear → Las nuestras.',
          'Template saved. It appears under Create → Ours.',
        ),
      );
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setSavingTemplate(false);
    }
  }

  function toggleAiTarget(blockId: string) {
    setAiTargetBlockIds((prev) =>
      prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId],
    );
  }

  function togglePageForAi(pageId: string) {
    if (!canvas) return;
    setAiTargetBlockIds(togglePageBlockSelection(canvas, pageId, aiTargetBlockIds));
  }

  function blockLabel(blockId: string): string {
    if (!canvas) return blockId;
    return blockLabelWithPage(canvas, blockId);
  }

  function addPendingChatFiles(files: Iterable<File>) {
    const accepted = filterStudioChatFiles(files);
    if (!accepted.length) return;
    setPendingFiles((prev) => [...prev, ...accepted].slice(0, STUDIO_CHAT_FILE_MAX));
  }

  function handleChatFileDragEnter(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    chatFileDragDepthRef.current += 1;
    setChatFileDragOver(true);
  }

  function handleChatFileDragLeave(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    chatFileDragDepthRef.current = Math.max(0, chatFileDragDepthRef.current - 1);
    if (chatFileDragDepthRef.current === 0) setChatFileDragOver(false);
  }

  function handleChatFileDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = canEdit && !chatBusy ? 'copy' : 'none';
  }

  function handleChatFileDrop(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    chatFileDragDepthRef.current = 0;
    setChatFileDragOver(false);
    if (!canEdit || chatBusy) return;
    addPendingChatFiles(e.dataTransfer.files);
  }

  function isPersistedChatMessageId(messageId: string): boolean {
    return (
      !messageId.startsWith('local-') &&
      !messageId.startsWith('err-') &&
      !messageId.startsWith('a-') &&
      !messageId.startsWith('stop-')
    );
  }

  function startEditMessage(msg: ChatMsg, index: number) {
    if (chatBusy || !canEdit || msg.role !== 'user') return;
    setInput(msg.content);
    setEditingMessageId(msg.id);
    setMessages((m) => m.slice(0, index));
    if (isPersistedChatMessageId(msg.id)) {
      chatBranchRef.current = { fromId: msg.id };
    } else if (index > 0) {
      const prev = messages[index - 1];
      if (prev && isPersistedChatMessageId(prev.id)) {
        chatBranchRef.current = { afterId: prev.id };
      } else {
        chatBranchRef.current = null;
      }
    } else {
      chatBranchRef.current = null;
    }
  }

  function stopChat() {
    chatAbortRef.current?.abort();
  }

  async function sendChat(opts?: {
    text?: string;
    approvedSources?: string[];
    action?: StudioCopilotAction;
    mode?: StudioCopilotMode;
  }) {
    const filesToSend = [...pendingFiles];
    const text = (opts?.text ?? input).trim();
    const sendMode = opts?.mode ?? copilotMode;
    if (
      (!text && !opts?.action && !filesToSend.length) ||
      !canvas ||
      chatBusy ||
      loading ||
      activeDocIdRef.current !== id
    ) {
      return;
    }
    setChatBusy(true);
    setConsent(null);
    setInput('');
    setPendingFiles([]);
    const branch = chatBranchRef.current;
    chatBranchRef.current = null;
    setEditingMessageId(null);
    const abort = new AbortController();
    chatAbortRef.current = abort;
    const tempId = `local-${Date.now()}`;
    const scopeLabel =
      aiTargetBlockIds.length > 0
        ? aiTargetBlockIds.map(blockLabel).join(' · ')
        : undefined;
    const userLine =
      text ||
      (opts?.action
        ? actionUserMessage(opts.action, locale === 'en' || locale === 'es' ? locale : 'pt')
        : '');
    setMessages((m) => [
      ...m,
      {
        id: tempId,
        role: 'user',
        content: userLine,
        attachmentNames: filesToSend.length ? filesToSend.map((f) => f.name) : undefined,
        scopeLabel,
      },
    ]);

    try {
      const attachmentIds: string[] = [];
      for (const file of filesToSend) {
        const asset = await uploadStudioChatAttachment({
          companyId: companyId || undefined,
          documentId: id,
          file,
          signal: abort.signal,
        });
        attachmentIds.push(asset.id);
      }

      const chatDocId = id;
      const chatEpoch = docEpochRef.current;
      const clientDirty = dirtyRef.current;
      const copilotBody: Record<string, unknown> = {
        companyId: companyId || undefined,
        locale,
        message: text || (opts?.action ? userLine : ''),
        mode: sendMode,
        action: opts?.action,
        documentId: chatDocId,
        clientDirty,
        clientRevision: knownUpdatedAt.current,
        approvedSources: opts?.approvedSources || [],
        attachmentIds,
        targetBlockIds: aiTargetBlockIds,
        branchFromMessageId: branch?.fromId,
        branchAfterMessageId: branch?.afterId,
      };
      // Canvas só quando há alterações locais — evita POST enorme e 502/OOM no proxy
      if (clientDirty) {
        copilotBody.canvasState = canvasRef.current || canvas;
      }
      const r = await fetch(`/api/studio/documents/${chatDocId}/copilot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        signal: abort.signal,
        body: JSON.stringify(copilotBody),
      });
      const d = await parseStudioApiResponse<{
        detail?: string;
        error?: string;
        message?: string;
        canvasState?: StudioCanvasState;
        title?: string;
        copilotSession?: {
          mode?: string;
          pendingActions?: StudioCopilotAction[];
          structureState?: StudioStructureSessionState | null;
        };
        patchedBlockIds?: string[];
        patchCount?: number;
        consentRequest?: StudioConsentRequest;
        userMessageId?: string;
        assistantMessageId?: string;
      }>(r);
      if (!r.ok) {
        const detail =
          typeof d.detail === 'string'
            ? d.detail
            : typeof d.error === 'string'
              ? d.error
              : null;
        throw new Error(
          detail ||
            (r.status === 502
              ? locale === 'es'
                ? 'La IA no respondió (servidor ocupado). Intenta de nuevo sin adjunto o con un archivo más pequeño.'
                : locale === 'en'
                  ? 'AI did not respond (server busy). Try again without attachment or with a smaller file.'
                  : 'A IA não respondeu (servidor ocupado). Tenta de novo sem anexo ou com ficheiro mais pequeno.'
              : `HTTP ${r.status}`),
        );
      }

      const staleResponse = !shouldApplyStudioDocumentFetch(chatDocId, id, chatEpoch, docEpochRef.current);

      if (!staleResponse) {
        if (d.canvasState) {
          applyCanvas(() => layoutWriteDocument(normalizeStudioCanvas(d.canvasState)), true);
        }
        if (typeof d.title === 'string' && d.title) setTitle(d.title);
        if (d.copilotSession) {
          if (typeof d.copilotSession.mode === 'string') {
            setCopilotMode(d.copilotSession.mode as StudioCopilotMode);
          }
          setPendingStructureActions(
            Array.isArray(d.copilotSession.pendingActions) ? d.copilotSession.pendingActions : [],
          );
          setStructureSessionState(
            d.copilotSession.structureState && typeof d.copilotSession.structureState === 'object'
              ? (d.copilotSession.structureState as StudioStructureSessionState)
              : null,
          );
        }
        const patchedIds = Array.isArray(d.patchedBlockIds)
          ? d.patchedBlockIds.filter((x: unknown): x is string => typeof x === 'string')
          : [];
        if (patchedIds.length) {
          const nextForFocus = d.canvasState
            ? normalizeStudioCanvas(d.canvasState)
            : canvasRef.current;
          focusAiEditedBlocks(patchedIds, nextForFocus);
        }
      }

      let assistantContent = d.message || '…';
      if (
        !staleResponse &&
        sendMode === 'apply' &&
        (d.patchCount === 0 || d.patchCount === undefined) &&
        !d.consentRequest
      ) {
        assistantContent +=
          locale === 'es'
            ? '\n\n⚠️ No se aplicaron cambios al documento. Prueba «Aplicar estructura» si hay un plan aprobado, o selecciona una sección con la mira.'
            : locale === 'en'
              ? '\n\n⚠️ No changes were applied to the document. Try «Apply structure» if a plan was approved, or select a section with the crosshair.'
              : '\n\n⚠️ Não foram aplicadas alterações ao documento. Tenta «Aplicar estrutura» se há plano aprovado, ou seleciona uma secção com a mira.';
      }
      if (staleResponse) {
        assistantContent +=
          locale === 'es'
            ? '\n\n_(Respuesta descartada: navegaste a otro documento durante la petición.)_'
            : locale === 'en'
              ? '\n\n_(Response discarded: you navigated away during the request.)_'
              : '\n\n_(Resposta descartada: mudaste de documento durante o pedido.)_';
      }

      setMessages((m) => [
        ...m.map((msg) =>
          msg.id === tempId && d.userMessageId ? { ...msg, id: d.userMessageId } : msg,
        ),
        {
          id: d.assistantMessageId || `a-${Date.now()}`,
          role: 'assistant',
          content: assistantContent,
          createdAt: new Date().toISOString(),
        },
      ]);

      if (d.consentRequest?.question && Array.isArray(d.consentRequest.sources)) {
        setConsent(d.consentRequest as StudioConsentRequest);
        setPendingPrompt(text);
      } else {
        setPendingPrompt(null);
      }
      if (!staleResponse) {
        void loadActivity();
        void loadVersions();
      }
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        setMessages((m) => [
          ...m,
          {
            id: `stop-${Date.now()}`,
            role: 'assistant',
            content:
              locale === 'es'
                ? '_(Generación detenida.)_'
                : locale === 'en'
                  ? '_(Generation stopped.)_'
                  : '_(Geração interrompida.)_',
            createdAt: new Date().toISOString(),
          },
        ]);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Erro no copiloto',
        },
      ]);
    } finally {
      chatAbortRef.current = null;
      setChatBusy(false);
    }
  }

  async function exportFile(format: 'pdf' | 'docx' | 'pptx' | 'xlsx') {
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
    const docId = id;
    const epoch = docEpochRef.current;
    const r = await fetch(`/api/studio/documents/${docId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', versionId }),
    });
    const d = await r.json();
    if (!shouldApplyStudioDocumentFetch(docId, id, epoch, docEpochRef.current)) return;
    if (!r.ok) {
      alert(d.error || 'Erro');
      return;
    }
    if (d.document?.canvasState) {
      const normalized = normalizeStudioCanvas(d.document.canvasState);
      skipHistory.current = true;
      canvasRef.current = normalized;
      setCanvas(normalized);
      skipHistory.current = false;
      dirtyRef.current = false;
      setDirty(false);
      void persistCanvas({ quiet: true, forceSnap: normalized });
      if (typeof d.document.title === 'string') {
        titleRef.current = d.document.title;
        setTitle(d.document.title);
      }
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

  function setHeaderFooter(hf: NonNullable<StudioCanvasState['headerFooter']>) {
    applyCanvas((prev) => ({ ...prev, headerFooter: hf }));
  }

  function setActivePageBackground(color: string | null) {
    const pageId = activePageId || canvas.pages[0]?.id;
    if (!pageId) return;
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              backgroundColor:
                color && /^#[0-9A-Fa-f]{6}$/.test(color) ? color : undefined,
            },
      ),
    }));
  }

  function downloadStoryboardSrt() {
    if (!videoScenes.length) return;
    const blob = new Blob([storyboardToSrt(videoScenes)], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'storyboard'}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function setStudioMode(mode: StudioStudioMode) {
    setToolsPanelOpen(true);
    if (mode === 'write' && (cascadeSection === 'elements' || cascadeSection === 'visual')) {
      setCascadeSection('format');
    }
    if (mode === 'design' && (cascadeSection === 'format' || cascadeSection === 'insert')) {
      setCascadeSection('elements');
    }
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
        const isDesign = prev.studioMode === 'design';
        const baseText =
          kind === 'diagram'
            ? serializeStudioDrawScene(emptyStudioDrawScene())
            : kind === 'bullets'
              ? '- '
              : kind === 'table'
                ? defaultTableMarkdown()
                : kind === 'heading'
                  ? t('Título', 'Título', 'Title')
                  : kind === 'callout'
                    ? `**${t('Destaque', 'Destacado', 'Highlight')}**`
                    : '';
        const layout = isDesign
          ? {
              xPct: 6,
              yPct: Math.min(72, 8 + order * 14),
              wPct: kind === 'image' ? 55 : 88,
              hPct: kind === 'image' ? 38 : undefined,
            }
          : undefined;
        return {
          ...p,
          blocks: [
            ...p.blocks,
            {
              id: `block-${Date.now()}-${order}`,
              kind,
              text: kind === 'image' ? '' : baseText,
              order,
              ...(layout ? { layout } : {}),
              ...(kind === 'diagram' ? { diagramLang: 'draw' as const } : {}),
              ...(kind === 'image' ? { imageUrl: null } : {}),
            },
          ],
        };
      }),
    }));
  }

  function insertBlockAfter(pageId: string, afterBlockId: string) {
    let newId = '';
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const blocks = p.blocks.slice().sort((a, b) => a.order - b.order);
        const idx = blocks.findIndex((b) => b.id === afterBlockId);
        if (idx < 0) return p;
        newId = `block-${Date.now()}-${idx + 1}`;
        const next = [
          ...blocks.slice(0, idx + 1),
          { id: newId, kind: 'paragraph' as const, text: '', order: idx + 1 },
          ...blocks.slice(idx + 1),
        ].map((b, i) => ({ ...b, order: i }));
        return { ...p, blocks: next };
      }),
    }));
    window.setTimeout(() => {
      if (newId) requestStudioWriteBlockFocus(newId);
    }, 40);
  }

  function removeEmptyBlockFocusPrev(pageId: string, blockId: string) {
    let prevId: string | null = null;
    textEditBaselineRef.current = null;
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const blocks = p.blocks.slice().sort((a, b) => a.order - b.order);
        if (blocks.length <= 1) return p;
        const idx = blocks.findIndex((b) => b.id === blockId);
        if (idx < 0) return p;
        const target = blocks[idx]!;
        if (String(target.text || '').trim()) return p;
        prevId = idx > 0 ? blocks[idx - 1]!.id : blocks[1]?.id || null;
        return {
          ...p,
          blocks: blocks.filter((b) => b.id !== blockId).map((b, i) => ({ ...b, order: i })),
        };
      }),
    }));
    if (prevId) {
      window.setTimeout(() => requestStudioWriteBlockFocus(prevId!), 40);
    }
  }

  function mergeBlockWithPrev(pageId: string, blockId: string): boolean {
    const textish = (kind: string) =>
      kind === 'paragraph' || kind === 'bullets' || kind === 'callout' || kind === 'heading';
    let prevId: string | null = null;
    let caretOffset = 0;
    let merged = false;
    applyCanvas((prev) => {
      const sortedPages = prev.pages.slice().sort((a, b) => a.order - b.order);
      const flat: Array<{ pageId: string; block: StudioBlock }> = [];
      for (const p of sortedPages) {
        for (const b of p.blocks.slice().sort((a, b) => a.order - b.order)) {
          flat.push({ pageId: p.id, block: b });
        }
      }
      const globalIdx = flat.findIndex((x) => x.pageId === pageId && x.block.id === blockId);
      if (globalIdx <= 0) return prev;
      const prevEntry = flat[globalIdx - 1]!;
      const curEntry = flat[globalIdx]!;
      const prevB = prevEntry.block;
      const curB = curEntry.block;
      if (!textish(prevB.kind) || !textish(curB.kind)) return prev;
      if (prevB.kind === 'heading' || curB.kind === 'heading') return prev;
      if (prevB.imageUrl || curB.imageUrl) return prev;

      const prevText = String(prevB.text || '');
      const curText = String(curB.text || '');
      caretOffset = prevText.length;
      const joiner =
        prevB.kind === 'bullets'
          ? '\n'
          : prevText.length && !prevText.endsWith('\n')
            ? '\n'
            : '';
      const mergedText = `${prevText}${joiner}${curText}`;
      prevId = prevB.id;
      merged = true;

      return {
        ...prev,
        pages: sortedPages.map((p) => {
          const touchesPrev = p.id === prevEntry.pageId;
          const touchesCur = p.id === curEntry.pageId;
          if (!touchesPrev && !touchesCur) return p;
          let blocks = p.blocks.slice().sort((a, b) => a.order - b.order);
          if (touchesPrev) {
            blocks = blocks.map((b) => (b.id === prevB.id ? { ...b, text: mergedText } : b));
          }
          if (touchesCur) {
            blocks = blocks.filter((b) => b.id !== curB.id);
          }
          return { ...p, blocks: blocks.map((b, i) => ({ ...b, order: i })) };
        }),
      };
    });
    if (merged && prevId) {
      textEditBaselineRef.current = null;
      window.setTimeout(() => requestStudioWriteBlockFocus(prevId!, caretOffset), 40);
    }
    return merged;
  }

  function splitBlockAfter(pageId: string, blockId: string, afterText: string) {
    let newId = '';
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => {
        if (p.id !== pageId) return p;
        const blocks = p.blocks.slice().sort((a, b) => a.order - b.order);
        const idx = blocks.findIndex((b) => b.id === blockId);
        if (idx < 0) return p;
        newId = `block-${Date.now()}-${idx + 1}`;
        const next = [
          ...blocks.slice(0, idx + 1),
          { id: newId, kind: 'paragraph' as const, text: afterText, order: idx + 1 },
          ...blocks.slice(idx + 1),
        ].map((b, i) => ({ ...b, order: i }));
        return { ...p, blocks: next };
      }),
    }));
    if (newId) {
      window.setTimeout(() => requestStudioWriteBlockFocus(newId, 0), 40);
    }
  }

  function mergeBlockWithNext(pageId: string, blockId: string) {
    const textish = (kind: string) =>
      kind === 'paragraph' || kind === 'bullets' || kind === 'callout' || kind === 'heading';
    let focusId: string | null = null;
    let caretOffset = 0;
    applyCanvas((prev) => {
      const sortedPages = prev.pages.slice().sort((a, b) => a.order - b.order);
      const flat: Array<{ pageId: string; block: StudioBlock }> = [];
      for (const p of sortedPages) {
        for (const b of p.blocks.slice().sort((a, b) => a.order - b.order)) {
          flat.push({ pageId: p.id, block: b });
        }
      }
      const globalIdx = flat.findIndex((x) => x.pageId === pageId && x.block.id === blockId);
      if (globalIdx < 0 || globalIdx >= flat.length - 1) return prev;
      const curEntry = flat[globalIdx]!;
      const nextEntry = flat[globalIdx + 1]!;
      const curB = curEntry.block;
      const nextB = nextEntry.block;
      if (!textish(curB.kind) || !textish(nextB.kind)) return prev;
      if (curB.kind === 'heading' || nextB.kind === 'heading') return prev;

      const curText = String(curB.text || '');
      const nextText = String(nextB.text || '');
      const joiner =
        curB.kind === 'bullets'
          ? '\n'
          : curText.length && !curText.endsWith('\n')
            ? '\n'
            : '';
      caretOffset = curText.length + joiner.length;
      const mergedText = `${curText}${joiner}${nextText}`;
      focusId = curB.id;

      return {
        ...prev,
        pages: sortedPages.map((p) => {
          const touchesCur = p.id === curEntry.pageId;
          const touchesNext = p.id === nextEntry.pageId;
          if (!touchesCur && !touchesNext) return p;
          let blocks = p.blocks.slice().sort((a, b) => a.order - b.order);
          if (touchesCur) {
            blocks = blocks.map((b) => (b.id === curB.id ? { ...b, text: mergedText } : b));
          }
          if (touchesNext) {
            blocks = blocks.filter((b) => b.id !== nextB.id);
          }
          return { ...p, blocks: blocks.map((b, i) => ({ ...b, order: i })) };
        }),
      };
    });
    if (focusId) {
      window.setTimeout(() => requestStudioWriteBlockFocus(focusId!, caretOffset), 40);
    }
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

  const videoScenes = useMemo(
    () => (canvas ? collectStudioVideoScenes(canvas) : []),
    [canvas],
  );

  const contentMismatch = useMemo(
    () => (canvas ? detectStudioContentMismatch(title, canvas) : null),
    [canvas, title],
  );

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

  function ribbonCommand(cmd: 'orderedList' | 'link') {
    if (cmd === 'orderedList' && runStudioWriteCommand({ type: 'orderedList' })) return;
    if (cmd === 'link' && runStudioWriteCommand({ type: 'link' })) return;
    if (cmd === 'link') {
      const url = window.prompt('URL', 'https://');
      if (!url) return;
      ribbonWrap('[', `](${url})`);
    }
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

  function bumpBlockLayer(delta: number) {
    if (!canvas || !aiTargetBlockIds.length) return;
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) => ({
        ...p,
        blocks: p.blocks.map((b) => {
          if (!aiTargetBlockIds.includes(b.id)) return b;
          const cur = b.layout?.zIndex ?? b.order;
          const next = Math.max(0, cur + delta);
          return {
            ...b,
            layout: { ...(b.layout || {}), zIndex: next },
          };
        }),
      })),
    }));
  }

  function updateSceneDuration(pageId: string, blockId: string, durationSec: number) {
    applyCanvas((prev) => ({
      ...prev,
      pages: prev.pages.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              blocks: p.blocks.map((b) =>
                b.id !== blockId ? b : patchBlockMediaMeta(b, { durationSec }),
              ),
            },
      ),
    }));
  }

  const isPresentationDeck =
    canvas.format === 'presentation' || pageSize === 'Slide' || canvas.pages.length > 1;
  const pagesToRender =
    slideFocusMode && studioMode === 'design' && isPresentationDeck && activePageId
      ? canvas.pages.filter((p) => p.id === activePageId)
      : canvas.pages;

  const sortedPages = canvas.pages.slice().sort((a, b) => a.order - b.order);
  const activePageIndex = sortedPages.findIndex((p) => p.id === activePageId);
  const headerIconBtn =
    studioMode === 'design'
      ? 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-violet-300 hover:bg-violet-900/50 disabled:opacity-30'
      : 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded text-stone-600 hover:bg-stone-200/60 disabled:opacity-30';
  const saveTitle =
    autoSaveState === 'saving'
      ? t('A guardar…', 'Guardando…', 'Saving…')
      : autoSaveState === 'saved'
        ? t('Guardado', 'Guardado', 'Saved')
        : dirty
          ? t('Guardar alterações', 'Guardar cambios', 'Save changes')
          : t('Guardar', 'Guardar', 'Save');

  const hasChatContent =
    messages.length > 0 || !!consent || pendingStructureActions.length > 0;

  function selectPage(pageId: string) {
    setActivePageId(pageId);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-studio-page-id="${pageId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  async function duplicateDocument() {
    if (!id || duplicating) return;
    setDuplicating(true);
    try {
      const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const r = await fetch(`/api/studio/documents/${id}/duplicate${q}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      if (d.document?.id) router.push(`/hub/studio/${d.document.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setDuplicating(false);
    }
  }

  async function deleteDocument() {
    if (!id || !canDeleteStudioDocument(access as StudioAccessLevel)) return;
    const msg = t(
      'Apagar este documento? Esta ação não pode ser desfeita.',
      '¿Eliminar este documento? Esta acción no se puede deshacer.',
      'Delete this document? This cannot be undone.',
    );
    if (!confirm(msg)) return;
    try {
      const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
      const r = await fetch(`/api/studio/documents/${id}${q}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      router.push(libraryHref);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    }
  }

  const canDeleteDoc = canDeleteStudioDocument(access as StudioAccessLevel);

  return (
    <div
      className={`flex h-screen flex-col ${
        studioMode === 'design'
          ? 'bg-[#1a1225]'
          : 'bg-[#ebe6dc]'
      }`}
    >
      <header
        className={`flex h-9 shrink-0 items-center gap-1 border-b px-1.5 sm:px-2 ${
          studioMode === 'design'
            ? 'border-violet-900/60 bg-[#120c1a] text-violet-50'
            : 'border-stone-300/80 bg-[#f7f4ef] text-stone-900'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
            <Link
              href={libraryHref}
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded ${
                studioMode === 'design'
                  ? 'text-violet-400 hover:bg-violet-900/50'
                  : 'text-stone-500 hover:bg-stone-200/60'
              }`}
              title={t('Voltar à pasta', 'Volver a la carpeta', 'Back to folder')}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
            <StudioDocumentTitle
              value={title}
              onChange={(v) => {
                setTitle(v);
                setDirty(true);
              }}
              onBlur={() => {
                if (dirty && canEdit) void persistCanvas({ quiet: true });
              }}
              canEdit={canEdit}
              variant={studioMode === 'design' ? 'design' : 'write'}
              placeholder={t('Sem título', 'Sin título', 'Untitled')}
              editHint={t('Clique para editar o nome', 'Clic para editar el nombre', 'Click to edit name')}
            />
        </div>

        {presence.filter((p) => !p.isSelf).length > 0 && (
          <div className="hidden items-center -space-x-1 sm:flex" title={t('Online agora', 'En línea ahora', 'Online now')}>
            {presence
              .filter((p) => !p.isSelf)
              .slice(0, 4)
              .map((p) => (
                <span
                  key={p.userId}
                  title={`${p.name || p.email} · ${p.status === 'editing' ? t('a editar', 'editando', 'editing') : t('a ver', 'viendo', 'viewing')}`}
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-full border border-white text-[8px] font-bold ${
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
        <div className="flex shrink-0 flex-nowrap items-center gap-0.5">
          <button
            type="button"
            disabled={!canEdit || !undoStack.length}
            onClick={undo}
            title={t('Desfazer', 'Deshacer', 'Undo')}
            className={headerIconBtn}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={!canEdit || !redoStack.length}
            onClick={redo}
            title={t('Refazer', 'Rehacer', 'Redo')}
            className={headerIconBtn}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openHistory('activity')}
            title={t('Atividade e versões', 'Actividad y versiones', 'Activity & versions')}
            className={`${headerIconBtn} hidden md:inline-flex`}
          >
            <History className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setCommentBlockId(null);
              setShowComments(true);
            }}
            title={t('Comentários', 'Comentarios', 'Comments')}
            className={`relative ${headerIconBtn} hidden md:inline-flex`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {openCommentCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-violet-600 px-0.5 text-[8px] font-bold text-white">
                {openCommentCount}
              </span>
            )}
          </button>
          {studioMode === 'design' && isPresentationDeck && (
            <>
              <button
                type="button"
                onClick={() => setSlideFocusMode((v) => !v)}
                title={t('Foco slide', 'Foco slide', 'Slide focus')}
                className={`${headerIconBtn} ${slideFocusMode ? 'text-fuchsia-300' : ''}`}
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPresenterOpen(true)}
                title={t('Apresentar', 'Presentar', 'Present')}
                className={headerIconBtn}
              >
                <Presentation className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            disabled={saving || !dirty || !canEdit}
            onClick={() => void save()}
            title={saveTitle}
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded disabled:opacity-30 ${
              studioMode === 'design'
                ? 'bg-fuchsia-600 text-white hover:bg-fuchsia-500'
                : 'bg-stone-800 text-white hover:bg-stone-700'
            }`}
          >
            {saving || autoSaveState === 'saving' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
          </button>
          <StudioDocMoreMenu
            locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
            variant={studioMode === 'design' ? 'design' : 'write'}
            disabled={!canEdit}
            canDelete={canDeleteDoc}
            canShare={(access === 'owner' || access === 'admin') && !!companyId}
            canTemplate={canEdit && !!companyId}
            duplicating={duplicating}
            savingTemplate={savingTemplate}
            exporting={!!exporting}
            onDuplicate={() => void duplicateDocument()}
            onDelete={() => void deleteDocument()}
            onShare={() => setShareOpen(true)}
            onLink={() => setShowLinks(true)}
            onMolds={() => {
              setShowMolds(true);
              void loadMolds();
            }}
            onSaveTemplate={() => void saveAsCompanyTemplate()}
            onExport={(fmt) => void exportFile(fmt)}
          />
        </div>
      </header>

      {contentMismatch && (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-950">
          <p>
            {t(
              `O conteúdo principal («${contentMismatch.slice(0, 60)}…») não corresponde ao título «${title}». Pode ter sido misturado com outro documento.`,
              `El contenido principal («${contentMismatch.slice(0, 60)}…») no coincide con el título «${title}». Puede haberse mezclado con otro documento.`,
              `Main content («${contentMismatch.slice(0, 60)}…») does not match title «${title}». It may have been mixed with another document.`,
            )}
          </p>
          <button
            type="button"
            onClick={() => openHistory('versions')}
            className="shrink-0 rounded-lg border border-red-300 bg-white px-3 py-1 text-xs font-semibold text-red-800 hover:bg-red-100"
          >
            {t('Restaurar versão', 'Restaurar versión', 'Restore version')}
          </button>
        </div>
      )}

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
        <StudioCollapsibleRail
          open={chatPanelOpen}
          onToggle={() => setChatPanelOpen((v) => !v)}
          widthPx={chatWidth}
          variant={studioMode === 'design' ? 'design' : 'write'}
          title={t('Chat IA', 'Chat IA', 'AI chat')}
          icon={<MessageSquare className="h-4 w-4" />}
        >
        <aside
          className={`flex min-h-0 flex-1 flex-col overflow-hidden ${
            studioMode === 'design'
              ? 'border-b border-violet-900/50 lg:border-b-0'
              : 'border-b border-stone-200 lg:border-b-0'
          }`}
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
            />
          ) : (
          <>
          <div
            className={`relative flex min-h-0 flex-col overflow-visible ${
              hasChatContent ? 'flex-1' : 'shrink-0 justify-end'
            }`}
            onDragEnter={handleChatFileDragEnter}
            onDragLeave={handleChatFileDragLeave}
            onDragOver={handleChatFileDragOver}
            onDrop={handleChatFileDrop}
          >
          {chatFileDragOver && canEdit && !chatBusy ? (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-lg border-2 border-dashed border-orange-400 bg-orange-50/95">
              <p className="px-4 text-center text-xs font-medium text-orange-900">
                {t(
                  'Largar ficheiros para anexar ao chat',
                  'Soltar archivos para adjuntar al chat',
                  'Drop files to attach to chat',
                )}
              </p>
            </div>
          ) : null}
          <div
            ref={chatScrollRef}
            className={`min-h-0 min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-2 ${
              hasChatContent ? 'flex-1 space-y-2' : 'shrink-0 space-y-2'
            }`}
          >
            {!hasChatContent && (
              <p className="text-xs text-stone-400">
                {t(
                  'Mira num bloco para editar só essa secção.',
                  'Mira en un bloque para editar solo esa sección.',
                  'Crosshair a block to edit that section only.',
                )}
              </p>
            )}
            {pendingStructureActions.length > 0 && (
              <div className="mb-3">
                <StudioStructureActionBar
                  locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
                  actions={pendingStructureActions}
                  disabled={chatBusy || !canEdit}
                  structurePreview={structureActionPreview}
                  onAction={(action) => void sendChat({ action, mode: copilotMode })}
                />
              </div>
            )}
            {messages.map((m, msgIdx) => {
              const loc = locale === 'en' || locale === 'es' ? locale : 'pt';
              return (
              <div
                key={m.id}
                className={`group min-w-0 max-w-full overflow-hidden rounded-xl px-3 py-2 text-sm ${
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
                  {m.role === 'user' && canEdit && !chatBusy ? (
                    <button
                      type="button"
                      onClick={() => startEditMessage(m, msgIdx)}
                      className="ml-auto inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-stone-500 opacity-0 transition hover:bg-orange-100/80 hover:text-orange-800 group-hover:opacity-100"
                      title={t('Editar e reenviar', 'Editar y reenviar', 'Edit and resend')}
                    >
                      <Pencil className="h-3 w-3" />
                      {t('Editar', 'Editar', 'Edit')}
                    </button>
                  ) : null}
                </div>
                {m.role === 'user' || m.role === 'assistant' ? (
                  <StudioCollapsedChatContent content={m.content} locale={loc} />
                ) : (
                  <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{m.content}</div>
                )}
                {m.attachmentNames?.length ? (
                  <StudioChatAttachmentChips locale={loc} names={m.attachmentNames} />
                ) : null}
                {m.scopeLabel ? (
                  <p className="mt-1 text-[10px] font-medium text-orange-800/80">
                    {t('Âmbito', 'Ámbito', 'Scope')}: {m.scopeLabel}
                  </p>
                ) : null}
              </div>
            );
            })}
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
          {canvas && aiTargetBlockIds.length > 0 && (
            <div className="shrink-0 border-t border-stone-100 px-3 py-2">
              <StudioSelectionScopeBar
                locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
                canvas={canvas}
                selectedBlockIds={aiTargetBlockIds}
                activePageId={activePageId}
                disabled={chatBusy || !canEdit}
                onChange={setAiTargetBlockIds}
              />
            </div>
          )}
          <StudioCopilotComposer
            locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
            mode={copilotMode}
            hasSelection={aiTargetBlockIds.length > 0}
            disabled={chatBusy || !canEdit}
            chatBusy={chatBusy}
            loading={loading}
            canEdit={canEdit}
            input={input}
            onInputChange={setInput}
            onSend={() => {
              if (dictating) stopDictation();
              void sendChat();
            }}
            onStop={stopChat}
            editingHint={
              editingMessageId
                ? t(
                    'A editar mensagem — altera o texto abaixo e reenvia.',
                    'Editando mensaje — cambia el texto abajo y reenvía.',
                    'Editing message — change the text below and resend.',
                  )
                : null
            }
            onModeChange={setCopilotMode}
            onQuickPrompt={(prompt) => {
              setInput(prompt);
              void sendChat({ text: prompt, mode: copilotMode });
            }}
            onAttachClick={() => fileInputRef.current?.click()}
            onFolderContextClick={() => setShowFolderContext(true)}
            showFolderContext={!!docFolderId}
            dictationSupported={dictationSupported}
            dictating={dictating}
            dictationInterim={dictationInterim}
            onToggleDictation={() => toggleDictation()}
            pendingFileNames={pendingFiles.map((f) => f.name)}
            onRemovePendingFile={(i) => setPendingFiles((p) => p.filter((_, j) => j !== i))}
            statusHint={composerStatusHint}
            onEscapeCancel={
              editingMessageId
                ? () => {
                    setEditingMessageId(null);
                    chatBranchRef.current = null;
                    setInput('');
                  }
                : pendingStructureActions.includes('cancel_plan')
                ? () => void sendChat({ action: 'cancel_plan', mode: 'discuss' })
                : consent
                  ? () => {
                      setConsent(null);
                      setPendingPrompt(null);
                    }
                  : undefined
            }
          />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.txt,.md,.csv,.json,.docx,image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const list = e.target.files ? Array.from(e.target.files) : [];
              e.target.value = '';
              if (list.length) addPendingChatFiles(list);
            }}
          />
          </>
          )}
        </aside>
        </StudioCollapsibleRail>

        {chatPanelOpen && (
        <div
          role="separator"
          aria-orientation="vertical"
          onMouseDown={(e) => {
            dragging.current = true;
            chatDragStart.current = { x: e.clientX, w: chatWidth };
          }}
          className={`hidden w-1 shrink-0 cursor-col-resize lg:block ${
            studioMode === 'design' ? 'bg-violet-900 hover:bg-violet-500' : 'bg-stone-300 hover:bg-orange-400'
          }`}
          title={t('Arrastar para redimensionar', 'Arrastrar para redimensionar', 'Drag to resize')}
        />
        )}

        {/* Documento + ferramentas laterais */}
        <div className="flex min-h-0 min-w-0 flex-1">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          ref={canvasScrollRef}
          className={`min-h-0 flex-1 overflow-y-auto p-3 sm:p-4 ${studioMode === 'write' ? 'studio-write-flow' : ''}`}
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
          <div className="mx-auto flex max-w-[720px] flex-wrap items-center gap-2 px-1 pb-2 sm:hidden">
            <button
              type="button"
              disabled={!canEdit}
              onClick={addPage}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1 text-[11px] font-semibold text-stone-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('Nova folha', 'Nueva hoja', 'New page')}
            </button>
            <span className="text-[11px] text-stone-500">
              {canvas.pages.length} {t('folha(s)', 'hoja(s)', 'page(s)')} · {pageSize}
            </span>
          </div>

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
            {pagesToRender
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((page, idx) => {
                const pageIndex = canvas.pages.findIndex((p) => p.id === page.id);
                const idxDisplay = pageIndex >= 0 ? pageIndex : idx;
                const size = (page.pageSize || pageSize) as StudioPageSize;
                const { width, height, wMm, hMm } = studioPageCssSize(size, 680, orientation);
                const marginPx = studioMarginsToCssPx(marginsMm, { w: wMm, h: hMm }, { width, height });
                const mold = page.moldId ? molds.find((m) => m.id === page.moldId) : null;
                const bg =
                  page.layoutMode === 'mold' && mold?.imageUrl
                    ? mold.imageUrl
                    : null;
                const pageSel = pageSelectionState(canvas, page.id, aiTargetBlockIds);
                return (
                  <section
                    key={page.id}
                    data-studio-page-id={page.id}
                    className={`relative rounded-lg transition ${
                      pageSel === 'full'
                        ? 'bg-orange-50/30 ring-2 ring-orange-400 ring-offset-2 ring-offset-[#faf8f5]'
                        : pageSel === 'partial'
                          ? 'ring-2 ring-dashed ring-orange-300 ring-offset-2 ring-offset-[#faf8f5]'
                          : ''
                    }`}
                    onFocusCapture={() => setActivePageId(page.id)}
                    onMouseDown={() => setActivePageId(page.id)}
                  >
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5" style={{ width }}>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                        {page.title || `${t('Folha', 'Hoja', 'Sheet')} ${idxDisplay + 1}`} · {size}
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                      {studioMode === 'write' && canEdit && (
                        <button
                          type="button"
                          onClick={() => togglePageForAi(page.id)}
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${
                            pageSel === 'full'
                              ? 'bg-orange-600 text-white'
                              : pageSel === 'partial'
                                ? 'border border-orange-300 bg-orange-50 text-orange-900'
                                : 'border border-slate-200 bg-white text-slate-600 hover:border-orange-300'
                          }`}
                        >
                          <Crosshair className="h-3 w-3" />
                          {pageSel === 'full'
                            ? t('Folha na IA', 'Hoja en IA', 'Page in AI')
                            : t('IA: folha', 'IA: hoja', 'AI: page')}
                        </button>
                      )}
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
                      pageLabel={`${idxDisplay + 1} / ${canvas.pages.length}`}
                      backgroundImage={bg}
                      backgroundColor={page.backgroundColor || null}
                      canEdit={canEdit}
                      brandAccent={studioMode === 'design' ? brandPrimary : null}
                      compact={studioMode === 'write'}
                      headerText={studioMode === 'write' ? canvas.headerFooter?.header : null}
                      footerText={studioMode === 'write' ? canvas.headerFooter?.footer : null}
                      showPageNumbers={
                        studioMode === 'write' && !!canvas.headerFooter?.showPageNumbers
                      }
                      pageNumber={idxDisplay + 1}
                      pageTotal={canvas.pages.length}
                      freeform={
                        studioMode === 'design' &&
                        page.blocks.some((b) => b.layout && (b.layout.xPct != null || b.layout.yPct != null))
                      }
                      layout={studioMode === 'write' ? 'flow' : 'fixed'}
                      marginPx={marginPx}
                      onOverflow={
                        studioMode === 'design' && canEdit
                          ? (info) => handleSheetOverflow(page.id, info)
                          : undefined
                      }
                    >
                      {page.blocks
                        .slice()
                        .sort((a, b) => {
                          const za = a.layout?.zIndex ?? a.order;
                          const zb = b.layout?.zIndex ?? b.order;
                          return za - zb;
                        })
                        .map((block, blockIdx, arr) => (
                          <div
                            key={block.id}
                            data-studio-block-id={block.id}
                            className={`shrink-0 ${aiEditedBlockIds.includes(block.id) ? 'rounded-lg ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#ebe6dc] shadow-[0_0_0_4px_rgba(16,185,129,0.15)] transition-shadow duration-500' : ''}`}
                          >
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
                              onImagePromptChange={(imagePrompt) =>
                                updateBlock(page.id, block.id, { imagePrompt })
                              }
                              onImageEditChange={(imageEdit) =>
                                updateBlock(page.id, block.id, { imageEdit })
                              }
                              onGenerateImage={
                                studioMode === 'design' && block.kind === 'image' && canEdit
                                  ? (prompt) => generateBlockImage(page.id, block.id, prompt)
                                  : undefined
                              }
                              onMoveUp={() => moveBlock(page.id, block.id, -1)}
                              onMoveDown={() => moveBlock(page.id, block.id, 1)}
                              onDelete={() => removeBlock(page.id, block.id)}
                              onInsertAfter={
                                studioMode === 'write' && canEdit
                                  ? () => insertBlockAfter(page.id, block.id)
                                  : undefined
                              }
                              onBackspaceEmpty={
                                studioMode === 'write' && canEdit && arr.length > 1
                                  ? () => removeEmptyBlockFocusPrev(page.id, block.id)
                                  : undefined
                              }
                              onMergeWithPrev={
                                studioMode === 'write' &&
                                canEdit &&
                                (blockIdx > 0 || idxDisplay > 0)
                                  ? () => mergeBlockWithPrev(page.id, block.id)
                                  : undefined
                              }
                              onSplitAfter={
                                studioMode === 'write' && canEdit
                                  ? (afterText) => splitBlockAfter(page.id, block.id, afterText)
                                  : undefined
                              }
                              onMergeWithNext={
                                studioMode === 'write' && canEdit
                                  ? () => mergeBlockWithNext(page.id, block.id)
                                  : undefined
                              }
                              onFocusNext={
                                studioMode === 'write' && blockIdx < arr.length - 1
                                  ? () => requestStudioWriteBlockFocus(arr[blockIdx + 1]!.id)
                                  : undefined
                              }
                              onFocusPrev={
                                studioMode === 'write' && blockIdx > 0
                                  ? () => requestStudioWriteBlockFocus(arr[blockIdx - 1]!.id)
                                  : undefined
                              }
                              onComment={() => {
                                setCommentBlockId(block.id);
                                setShowComments(true);
                              }}
                              expandHeight={
                                studioMode === 'write' &&
                                page.blocks.length === 1 &&
                                blockIdx === 0 &&
                                !(block.text || '').trim()
                              }
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
                                generateImage: t('Gerar imagem IA', 'Generar imagen IA', 'Generate AI image'),
                                imagePrompt: t('Prompt visual', 'Prompt visual', 'Visual prompt'),
                                videoScene: t('Plano vídeo', 'Plano vídeo', 'Video scene'),
                                adjustImage: t('Ajustar imagem', 'Ajustar imagen', 'Adjust image'),
                                brightness: t('Brilho', 'Brillo', 'Brightness'),
                                contrast: t('Contraste', 'Contraste', 'Contrast'),
                                crop: t('Recorte', 'Recorte', 'Crop'),
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
        {studioMode === 'design' && videoScenes.length > 0 && (
          <>
            <div className="flex items-center justify-end gap-2 border-t border-violet-900/30 bg-[#0c0814] px-3 py-1">
              <button
                type="button"
                onClick={downloadStoryboardSrt}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-700 bg-violet-950 px-3 py-1.5 text-[11px] font-semibold text-violet-200 hover:bg-violet-900"
              >
                <Download className="h-3.5 w-3.5" />
                SRT
              </button>
              <button
                type="button"
                onClick={() => setStoryboardOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-fuchsia-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-fuchsia-500"
              >
                <Play className="h-3.5 w-3.5" />
                {t('Preview vídeo', 'Preview vídeo', 'Video preview')}
              </button>
            </div>
            <StudioVideoTimeline
              scenes={videoScenes}
              activePageId={activePageId}
              locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
              canEdit={canEdit}
              onSelectPage={selectPage}
              onDurationChange={canEdit ? updateSceneDuration : undefined}
            />
          </>
        )}
        </div>

        <StudioCascadeToolsRail
          mode={studioMode}
          onModeChange={setStudioMode}
          panelOpen={toolsPanelOpen}
          onPanelOpenChange={setToolsPanelOpen}
          section={cascadeSection}
          onSectionChange={setCascadeSection}
          pageSize={pageSize}
          orientation={orientation}
          margins={marginsMm}
          disabled={!canEdit}
          pageCount={canvas.pages.length}
          onPageSize={setDocPageSize}
          onOrientation={setDocOrientation}
          onMargins={setDocMargins}
          headerFooter={canvas.headerFooter}
          onHeaderFooter={setHeaderFooter}
          pageBackgroundColor={
            studioMode === 'design'
              ? canvas.pages.find((p) => p.id === (activePageId || canvas.pages[0]?.id))
                  ?.backgroundColor || null
              : null
          }
          onPageBackgroundColor={studioMode === 'design' ? setActivePageBackground : undefined}
          onOpenMolds={() => {
            setShowMolds(true);
            void loadMolds();
          }}
          onAddPage={addPage}
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
          onWrap={ribbonWrap}
          onCommand={ribbonCommand}
          onKind={ribbonKind}
          onStyle={ribbonStyle}
          pages={canvas.pages}
          activePageId={activePageId}
          locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
          onSelectPage={selectPage}
          pageAiSelection={pageAiSelectionMap}
          onToggleAiPage={canEdit ? togglePageForAi : undefined}
          branchLabels={{
            write: t('Redação', 'Redacción', 'Write'),
            design: t('Desenho', 'Diseño', 'Design'),
          }}
          sectionTitles={{
            format: t('Formato', 'Formato', 'Format'),
            insert: t('Inserir', 'Insertar', 'Insert'),
            page:
              studioMode === 'design'
                ? t('Slides', 'Slides', 'Slides')
                : t('Folhas', 'Hojas', 'Pages'),
            elements: t('Elementos', 'Elementos', 'Elements'),
            visual: t('Visuais', 'Visuales', 'Visual'),
          }}
          ribbonLabels={{
            format: t('Formato', 'Formato', 'Format'),
            bold: t('Negrito', 'Negrita', 'Bold'),
            italic: t('Itálico', 'Cursiva', 'Italic'),
            underline: t('Sublinhado', 'Subrayado', 'Underline'),
            heading: t('Título', 'Título', 'Heading'),
            body: t('Corpo', 'Cuerpo', 'Body'),
            list: t('Lista', 'Lista', 'List'),
            orderedList: t('Lista num.', 'Lista num.', 'Numbered list'),
            link: t('Hiperligação', 'Enlace', 'Link'),
            hint: t(
              'Ctrl+Enter nova secção · setas entre secções · Excel/tabelas na barra lateral',
              'Ctrl+Enter nueva sección · flechas entre secciones · Excel/tablas en barra lateral',
              'Ctrl+Enter new section · arrows between sections · Excel/tables in sidebar',
            ),
            more: t('Mais', 'Más', 'More'),
          }}
          panelLabels={{
            page: t('Página', 'Página', 'Page'),
            pageSetup: t('Configuração', 'Configuración', 'Setup'),
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
            table: t('Tabela / Excel', 'Tabla / Excel', 'Table / Excel'),
            newSlide: t('Novo slide / folha', 'Nuevo slide / hoja', 'New slide / page'),
            diagram: t('Diagrama', 'Diagrama', 'Diagram'),
            image: t('Imagem', 'Imagen', 'Image'),
            designTools: t('Elementos visuais', 'Elementos visuales', 'Visual elements'),
            drawBoard: t('Quadro de desenho', 'Lienzo de dibujo', 'Drawing board'),
            molds: t('Moldes de página', 'Moldes de página', 'Page molds'),
            textBox: t('Caixa texto', 'Caja texto', 'Text box'),
            titleBox: t('Título', 'Título', 'Title'),
            contentLayer: t('Camada Conteúdo', 'Capa Contenido', 'Content layer'),
            designLayer: t('Camada Desenho', 'Capa Diseño', 'Design layer'),
            aiScope: t(
              'Mira / Shift+clique = âmbito IA',
              'Mira / Shift+clic = ámbito IA',
              'Crosshair / Shift+click = AI scope',
            ),
            header: t('Cabeçalho', 'Encabezado', 'Header'),
            footer: t('Rodapé', 'Pie de página', 'Footer'),
            pageNumbers: t('Numerar páginas', 'Numerar páginas', 'Page numbers'),
            pageBackground: t('Fundo da folha', 'Fondo de hoja', 'Page background'),
          }}
        />
        </div>
      </div>

      {presenterOpen && (
        <StudioPresenterMode
          pages={canvas.pages}
          locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
          initialPageId={activePageId}
          onClose={() => setPresenterOpen(false)}
        />
      )}

      {storyboardOpen && videoScenes.length > 0 && (
        <StudioStoryboardPlayer
          scenes={videoScenes}
          locale={locale === 'en' || locale === 'es' ? locale : 'pt'}
          documentTitle={title}
          onSelectPage={selectPage}
          onClose={() => setStoryboardOpen(false)}
        />
      )}

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
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900">
                  {t('Rastreabilidade', 'Trazabilidad', 'Traceability')}
                </h3>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {title || t('Sem título', 'Sin título', 'Untitled')}
                  <span className="ml-1.5 font-mono text-[10px] text-slate-400">#{id.slice(0, 8)}</span>
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {t(
                    'Histórico deste documento apenas',
                    'Historial solo de este documento',
                    'This document only',
                  )}
                </p>
              </div>
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

            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('A carregar histórico…', 'Cargando historial…', 'Loading history…')}
              </div>
            ) : historyTab === 'activity' ? (
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

