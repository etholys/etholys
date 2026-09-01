'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  FilePlus2,
  FolderPlus,
  Folder,
  FileText,
  Loader2,
  PenLine,
  ChevronRight,
  Palette,
  Share2,
  BookMarked,
  X,
  Pencil,
  Trash2,
  FolderInput,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StudioShareDialog } from '@/components/studio/StudioShareDialog';
import { StudioContextPanel } from '@/components/studio/StudioContextPanel';
import { StudioCreateGallery, type GalleryTemplate } from '@/components/studio/StudioCreateGallery';
import {
  StudioLibraryGrid,
  type StudioMovePayload,
  readStudioMovePayload,
} from '@/components/studio/StudioLibraryGrid';
import type { StudioPageSize } from '@/lib/studio/types';

type FolderRow = { id: string; name: string; parentId: string | null; visibility?: string; access?: string };
type DocRow = {
  id: string;
  title: string;
  format: string;
  status: string;
  folderId: string | null;
  updatedAt: string;
  visibility?: string;
  access?: string;
  updatedBy?: { id: string; name: string | null; email: string } | null;
};
type TemplateRow = GalleryTemplate;

function buildFolderPath(
  folderId: string | null,
  allFolders: FolderRow[],
  folderName?: string | null,
  folderParentId?: string | null,
): FolderRow[] {
  if (!folderId) return [];
  const byId = new Map(allFolders.map((f) => [f.id, f]));
  const chain: FolderRow[] = [];
  const seen = new Set<string>();
  let cur: string | null = folderId;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    const f = byId.get(cur);
    if (!f) break;
    chain.unshift({ id: f.id, name: f.name, parentId: f.parentId ?? null, access: f.access });
    cur = f.parentId ?? null;
  }
  if (!chain.length) {
    return [
      {
        id: folderId,
        name: folderName || '…',
        parentId: folderParentId ?? null,
      },
    ];
  }
  if (folderName && chain[chain.length - 1]) {
    chain[chain.length - 1] = { ...chain[chain.length - 1]!, name: folderName };
  }
  return chain;
}

function canManageItem(access?: string) {
  return access === 'owner' || access === 'admin' || !access;
}

export default function StudioHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <StudioHubInner />
    </Suspense>
  );
}

function StudioHubInner() {
  const { locale, activeCompanyId, setActiveCompanyId } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  /** Pasta activa = query ?folder= (fonte de verdade ao voltar do documento). */
  const folderParam = searchParams.get('folder');
  const folderId = folderParam && isLikelyDbId(folderParam) ? folderParam : null;

  const [pathStack, setPathStack] = useState<FolderRow[]>([]);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [resolvedCompanyId, setResolvedCompanyId] = useState<string>(companyId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderError, setNewFolderError] = useState<string | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBrand, setShowBrand] = useState(false);
  const [brandColor, setBrandColor] = useState('#ea580c');
  const [brandOrg, setBrandOrg] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [brandFooter, setBrandFooter] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);
  const [shareTarget, setShareTarget] = useState<null | {
    folderId?: string;
    documentId?: string;
    title: string;
  }>(null);
  const [showFolderContext, setShowFolderContext] = useState(false);
  const [allFolders, setAllFolders] = useState<FolderRow[]>([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [dropHighlightId, setDropHighlightId] = useState<string | null | 'root'>(null);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const dragPayloadRef = useRef<StudioMovePayload | null>(null);
  const lastSelectedRef = useRef<{ kind: 'folder' | 'doc'; id: string } | null>(null);

  const effectiveCompanyId = companyId || resolvedCompanyId;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (companyId) q.set('companyId', companyId);
      if (folderId) q.set('folderId', folderId);
      const r = await fetch(`/api/studio/documents?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);
      const fromApi = typeof d.companyId === 'string' ? d.companyId : '';
      if (fromApi) {
        setResolvedCompanyId(fromApi);
        if (!companyId && isLikelyDbId(fromApi)) {
          setActiveCompanyId(fromApi);
        }
      }
      if (d.accessMode === 'share_only' && !folderId) {
        const sharedFolders = d.folders || [];
        if (sharedFolders.length === 1) {
          router.replace(`/studio/f/${sharedFolders[0].id}`);
          return;
        }
        if (sharedFolders.length === 0 && (d.documents || []).length === 0) {
          router.replace('/studio/shared');
          return;
        }
      }
      setFolders(d.folders || []);
      setDocuments(d.documents || []);
      setTemplates(d.templates || []);
      const all = (d.allFolders || []) as FolderRow[];
      setAllFolders(all);
      setSelectedFolderIds([]);
      setSelectedDocIds([]);
      setPathStack(
        buildFolderPath(
          folderId,
          all,
          typeof d.folderName === 'string' ? d.folderName : null,
          typeof d.folderParentId === 'string' ? d.folderParentId : null,
        ),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, folderId, locale, router, setActiveCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  function enterFolder(f: FolderRow) {
    router.push(`/hub/studio?folder=${encodeURIComponent(f.id)}`);
  }

  function goToPathIndex(index: number) {
    if (index < 0) {
      router.push('/hub/studio');
      return;
    }
    const target = pathStack[index];
    if (!target) return;
    router.push(`/hub/studio?folder=${encodeURIComponent(target.id)}`);
  }

  function openNewFolder() {
    setNewFolderName('');
    setNewFolderError(null);
    setShowNewFolder(true);
  }

  async function renameDocument(doc: DocRow) {
    const next = window.prompt(
      t('Novo nome do documento', 'Nuevo nombre del documento', 'New document name'),
      doc.title,
    );
    if (next == null) return;
    const title = next.trim();
    if (!title || title === doc.title) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/studio/documents/${doc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: effectiveCompanyId || undefined, title }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || d.detail || 'Erro');
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function deleteDocument(doc: DocRow) {
    if (
      !window.confirm(
        t(
          `Apagar «${doc.title}»? Esta ação não se pode anular.`,
          `¿Borrar «${doc.title}»? Esta acción no se puede deshacer.`,
          `Delete “${doc.title}”? This cannot be undone.`,
        ),
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const q = effectiveCompanyId ? `?companyId=${encodeURIComponent(effectiveCompanyId)}` : '';
      const r = await fetch(`/api/studio/documents/${doc.id}${q}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || d.detail || 'Erro');
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function moveItems(payload: StudioMovePayload, targetFolderId: string | null) {
    if (!payload.folderIds.length && !payload.documentIds.length) return;
    if (targetFolderId && payload.folderIds.includes(targetFolderId)) return;
    setBusy(true);
    try {
      const r = await fetch('/api/studio/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: effectiveCompanyId || undefined,
          targetFolderId,
          folderIds: payload.folderIds,
          documentIds: payload.documentIds,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || d.detail || 'Erro');
      setSelectedFolderIds([]);
      setSelectedDocIds([]);
      setShowMovePicker(false);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
      dragPayloadRef.current = null;
      setDropHighlightId(null);
    }
  }

  function handleDropTarget(targetFolderId: string | null) {
    const payload = dragPayloadRef.current;
    if (!payload) return;
    void moveItems(payload, targetFolderId);
  }

  function toggleFolderSelect(id: string, extend: boolean) {
    setSelectedDocIds([]);
    setSelectedFolderIds((prev) => {
      if (extend && lastSelectedRef.current?.kind === 'folder') {
        const ids = folders.map((f) => f.id);
        const a = ids.indexOf(lastSelectedRef.current!.id);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          return ids.slice(lo, hi + 1);
        }
      }
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
    lastSelectedRef.current = { kind: 'folder', id };
  }

  function toggleDocSelect(id: string, extend: boolean) {
    setSelectedFolderIds([]);
    setSelectedDocIds((prev) => {
      if (extend && lastSelectedRef.current?.kind === 'doc') {
        const ids = documents.map((d) => d.id);
        const a = ids.indexOf(lastSelectedRef.current!.id);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          return ids.slice(lo, hi + 1);
        }
      }
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
    lastSelectedRef.current = { kind: 'doc', id };
  }

  function selectAllVisible() {
    setSelectedFolderIds(folders.filter((f) => canManageItem(f.access)).map((f) => f.id));
    setSelectedDocIds(documents.filter((d) => canManageItem(d.access)).map((d) => d.id));
  }

  const selectionCount = selectedFolderIds.length + selectedDocIds.length;

  async function renameFolder(f: FolderRow) {
    const next = window.prompt(t('Novo nome da pasta', 'Nuevo nombre de la carpeta', 'New folder name'), f.name);
    if (next == null) return;
    const name = next.trim();
    if (!name || name === f.name) return;
    setBusy(true);
    try {
      const r = await fetch('/api/studio/folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: effectiveCompanyId || undefined, id: f.id, name }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || d.detail || 'Erro');
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder(f: FolderRow) {
    if (
      !window.confirm(
        t(
          `Apagar a pasta «${f.name}» e o seu conteúdo?`,
          `¿Borrar la carpeta «${f.name}» y su contenido?`,
          `Delete folder “${f.name}” and its contents?`,
        ),
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const q = new URLSearchParams({ id: f.id });
      if (effectiveCompanyId) q.set('companyId', effectiveCompanyId);
      const r = await fetch(`/api/studio/folders?${q}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || d.detail || 'Erro');
      if (folderId === f.id) router.push('/hub/studio');
      else await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function createFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name || !effectiveCompanyId) return;
    setBusy(true);
    setNewFolderError(null);
    try {
      const r = await fetch('/api/studio/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: effectiveCompanyId, name, parentId: folderId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error);
      setShowNewFolder(false);
      setNewFolderName('');
      await load();
    } catch (e: unknown) {
      setNewFolderError(e instanceof Error ? e.message : t('Não foi possível criar a pasta.', 'No se pudo crear la carpeta.', 'Could not create the folder.'));
    } finally {
      setBusy(false);
    }
  }

  async function createDoc(
    templateKey?: string,
    opts?: { pageSize?: StudioPageSize; format?: string; studioMode?: 'write' | 'design' },
  ) {
    if (!effectiveCompanyId) return;
    setBusy(true);
    try {
      const r = await fetch('/api/studio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: effectiveCompanyId,
          folderId,
          templateKey,
          pageSize: opts?.pageSize,
          format: opts?.format,
          studioMode: opts?.studioMode ?? (opts?.pageSize ? 'design' : undefined),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error);
      router.push(`/hub/studio/${d.document.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
      setBusy(false);
    }
  }

  async function uploadDoc(file: File) {
    if (!effectiveCompanyId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('companyId', effectiveCompanyId);
      if (folderId) fd.set('folderId', folderId);
      const r = await fetch('/api/studio/documents/from-file', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error);
      router.push(`/hub/studio/${d.document.id}`);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
      setBusy(false);
    }
  }

  async function openBrand() {
    if (!effectiveCompanyId) return;
    setShowBrand(true);
    try {
      const r = await fetch(`/api/studio/brand?companyId=${encodeURIComponent(effectiveCompanyId)}`);
      const d = await r.json();
      if (r.ok && d.brand) {
        setBrandColor(d.brand.primaryColor || '#ea580c');
        setBrandOrg(d.brand.orgName || '');
        setBrandLogo(d.brand.logoUrl || '');
        setBrandFooter(d.brand.footerText || '');
      }
    } catch {
      // ignore
    }
  }

  async function saveBrand() {
    if (!effectiveCompanyId) return;
    setBrandSaving(true);
    try {
      const r = await fetch('/api/studio/brand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: effectiveCompanyId,
          primaryColor: brandColor,
          orgName: brandOrg,
          logoUrl: brandLogo || null,
          footerText: brandFooter,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Erro');
      setShowBrand(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBrandSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f0ea]">
      <header className="border-b border-stone-200/80 bg-[#faf7f2]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-2">
            <Link
              href="/hub"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-orange-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Hub
            </Link>
            <span className="text-stone-300">/</span>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-stone-900">
              <PenLine className="h-4 w-4 text-orange-600" />
              Studio
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={!effectiveCompanyId || !folderId}
              onClick={() => setShowFolderContext(true)}
              title={t('Contexto IA desta pasta', 'Contexto IA de esta carpeta', 'AI context for this folder')}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              <BookMarked className="h-3.5 w-3.5" />
              {t('Contexto IA', 'Contexto IA', 'AI context')}
            </button>
            <button
              type="button"
              disabled={!effectiveCompanyId}
              onClick={() => void openBrand()}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              <Palette className="h-3.5 w-3.5" />
              {t('Marca', 'Marca', 'Brand')}
            </button>
            <button
              type="button"
              disabled={busy || !effectiveCompanyId}
              onClick={openNewFolder}
              className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
            >
              <FolderPlus className="h-3.5 w-3.5" />
              {t('Pasta', 'Carpeta', 'Folder')}
            </button>
            <button
              type="button"
              disabled={busy || !effectiveCompanyId}
              onClick={() => setShowTemplates(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              {t('Novo', 'Nuevo', 'New')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <nav
          className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-600"
          onDragLeave={() => setDropHighlightId(null)}
        >
          <button
            type="button"
            onClick={() => goToPathIndex(-1)}
            onDragOver={(e) => {
              e.preventDefault();
              setDropHighlightId('root');
            }}
            onDrop={(e) => {
              e.preventDefault();
              const payload = readStudioMovePayload(e.dataTransfer) || dragPayloadRef.current;
              if (payload) dragPayloadRef.current = payload;
              handleDropTarget(null);
            }}
            className={`rounded px-1.5 py-0.5 font-medium hover:bg-amber-50 hover:text-amber-900 ${
              dropHighlightId === 'root' ? 'bg-amber-100 font-semibold text-amber-900 ring-1 ring-amber-300' : ''
            }`}
          >
            {t('Raiz', 'Raíz', 'Root')}
          </button>
          {pathStack.map((f, index) => (
            <span key={`${f.id}-${index}`} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => goToPathIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropHighlightId(f.id);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const payload = readStudioMovePayload(e.dataTransfer) || dragPayloadRef.current;
                  if (payload) dragPayloadRef.current = payload;
                  handleDropTarget(f.id);
                }}
                className={`rounded px-1.5 py-0.5 font-medium hover:bg-amber-50 hover:text-amber-900 ${
                  dropHighlightId === f.id ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300' : ''
                }`}
              >
                {f.name}
              </button>
            </span>
          ))}
        </nav>

        {selectionCount > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/80 px-3 py-2">
            <span className="text-sm font-semibold text-orange-950">
              {selectionCount}{' '}
              {t('selecionado(s)', 'seleccionado(s)', 'selected')}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowMovePicker((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-2.5 py-1 text-xs font-semibold text-orange-900 hover:bg-orange-100 disabled:opacity-40"
            >
              <FolderInput className="h-3.5 w-3.5" />
              {t('Mover para…', 'Mover a…', 'Move to…')}
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedFolderIds([]);
                setSelectedDocIds([]);
              }}
              className="text-xs font-medium text-orange-800 underline"
            >
              {t('Limpar', 'Limpiar', 'Clear')}
            </button>
            {(folders.length > 0 || documents.length > 0) &&
              selectionCount < folders.length + documents.length && (
                <button
                  type="button"
                  onClick={selectAllVisible}
                  className="text-xs font-medium text-orange-800 underline"
                >
                  {t('Selecionar tudo', 'Seleccionar todo', 'Select all')}
                </button>
              )}
          </div>
        )}

        {showMovePicker && selectionCount > 0 && (
          <div className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('Destino', 'Destino', 'Destination')}
            </p>
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void moveItems(
                    { folderIds: selectedFolderIds, documentIds: selectedDocIds },
                    null,
                  )
                }
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:border-amber-300 hover:bg-amber-50"
              >
                {t('Raiz', 'Raíz', 'Root')}
              </button>
              {allFolders
                .filter((f) => !selectedFolderIds.includes(f.id))
                .map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void moveItems(
                        { folderIds: selectedFolderIds, documentIds: selectedDocIds },
                        f.id,
                      )
                    }
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:border-amber-300 hover:bg-amber-50"
                  >
                    {f.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('A carregar…', 'Cargando…', 'Loading…')}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">{t('Studio indisponível', 'Studio no disponible', 'Studio unavailable')}</p>
            <p className="mt-1">{error}</p>
            <p className="mt-3">
              <Link href="/studio/shared" className="font-semibold text-orange-700 underline">
                {t('Ver conteúdos partilhados comigo', 'Ver contenidos compartidos conmigo', 'View content shared with me')}
              </Link>
            </p>
          </div>
        ) : (
          <StudioLibraryGrid
            locale={locale}
            folders={folders}
            documents={documents}
            busy={busy}
            selectedFolderIds={selectedFolderIds}
            selectedDocIds={selectedDocIds}
            dropHighlightId={dropHighlightId}
            onToggleFolder={toggleFolderSelect}
            onToggleDoc={toggleDocSelect}
            onEnterFolder={enterFolder}
            onRenameFolder={(f) => void renameFolder(f)}
            onDeleteFolder={(f) => void deleteFolder(f)}
            onShareFolder={(f) => setShareTarget({ folderId: f.id, title: f.name })}
            onRenameDoc={(d) => void renameDocument(d)}
            onDeleteDoc={(d) => void deleteDocument(d)}
            onShareDoc={(d) => setShareTarget({ documentId: d.id, title: d.title })}
            onDragStart={(payload) => {
              dragPayloadRef.current = payload;
            }}
            onDragEnd={() => {
              dragPayloadRef.current = null;
              setDropHighlightId(null);
            }}
            onDragOverFolder={(targetId) => setDropHighlightId(targetId)}
            onDropOnFolder={(targetId, payload) => {
              dragPayloadRef.current = payload;
              setDropHighlightId(targetId);
              handleDropTarget(targetId);
            }}
            canManage={canManageItem}
            t={t}
          />
        )}
      </main>

      {showNewFolder && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/45 p-4 backdrop-blur-[2px] sm:items-center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy) setShowNewFolder(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-folder-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <FolderPlus className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="new-folder-title" className="font-bold text-slate-900">
                    {t('Criar nova pasta', 'Crear nueva carpeta', 'Create new folder')}
                  </h2>
                  <p className="truncate text-xs text-slate-500">
                    {folderId
                      ? `${t('Dentro de', 'Dentro de', 'Inside')} / ${pathStack.map((item) => item.name).join(' / ')}`
                      : t('Na raiz da biblioteca', 'En la raíz de la biblioteca', 'At the library root')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={t('Fechar', 'Cerrar', 'Close')}
                disabled={busy}
                onClick={() => setShowNewFolder(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={createFolder} className="p-5">
              <label htmlFor="new-folder-name" className="text-sm font-semibold text-slate-800">
                {t('Nome da pasta', 'Nombre de la carpeta', 'Folder name')}
              </label>
              <input
                id="new-folder-name"
                autoFocus
                maxLength={120}
                value={newFolderName}
                onChange={(event) => {
                  setNewFolderName(event.target.value);
                  if (newFolderError) setNewFolderError(null);
                }}
                placeholder={t('Ex.: Relatórios 2026', 'Ej.: Informes 2026', 'E.g. Reports 2026')}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
              />
              <div className="mt-1.5 flex min-h-5 items-start justify-between gap-3 text-xs">
                <p className={newFolderError ? 'text-red-600' : 'text-slate-500'}>
                  {newFolderError ||
                    t(
                      'A pasta será privada por padrão.',
                      'La carpeta será privada por defecto.',
                      'The folder will be private by default.',
                    )}
                </p>
                <span className="shrink-0 text-slate-400">{newFolderName.trim().length}/120</span>
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setShowNewFolder(false)}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                >
                  {t('Cancelar', 'Cancelar', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={busy || !newFolderName.trim()}
                  className="inline-flex min-w-28 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
                  {t('Criar pasta', 'Crear carpeta', 'Create folder')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {shareTarget && effectiveCompanyId && (
        <StudioShareDialog
          companyId={effectiveCompanyId}
          folderId={shareTarget.folderId}
          documentId={shareTarget.documentId}
          title={shareTarget.title}
          open
          onClose={() => setShareTarget(null)}
          onVisibilityChange={() => void load()}
        />
      )}

      {showFolderContext && folderId && (
        <StudioContextPanel
          companyId={effectiveCompanyId}
          folderId={folderId}
          canEdit
          open
          onClose={() => setShowFolderContext(false)}
        />
      )}

      {showBrand && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold text-slate-900">
              {t('Kit de marca', 'Kit de marca', 'Brand kit')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {t(
                'Aplicado aos exports PDF/DOCX e à identidade visual do Studio.',
                'Aplicado a exports PDF/DOCX y a la identidad visual del Studio.',
                'Applied to PDF/DOCX exports and Studio visual identity.',
              )}
            </p>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-slate-600">{t('Cor principal', 'Color principal', 'Primary color')}</span>
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="mt-1 h-10 w-full cursor-pointer rounded border border-slate-200"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">{t('Nome da org', 'Nombre org', 'Org name')}</span>
                <input
                  value={brandOrg}
                  onChange={(e) => setBrandOrg(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Logo URL</span>
                <input
                  value={brandLogo}
                  onChange={(e) => setBrandLogo(e.target.value)}
                  placeholder="https://…"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600">Footer</span>
                <input
                  value={brandFooter}
                  onChange={(e) => setBrandFooter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBrand(false)}
                className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                {t('Cancelar', 'Cancelar', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={brandSaving}
                onClick={() => void saveBrand()}
                className="rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {brandSaving ? '…' : t('Guardar', 'Guardar', 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <StudioCreateGallery
        open={showTemplates}
        locale={locale}
        busy={busy}
        companyId={effectiveCompanyId}
        templates={templates}
        onClose={() => setShowTemplates(false)}
        onPickSystem={(key) => void createDoc(key)}
        onPickCompany={(key) => void createDoc(key)}
        onBlank={(opts) =>
          void createDoc(undefined, {
            pageSize: opts?.pageSize,
            format: opts?.format,
            studioMode: opts?.studioMode ?? 'design',
          })
        }
        onUploadFile={(file) => void uploadDoc(file)}
      />
    </div>
  );
}
