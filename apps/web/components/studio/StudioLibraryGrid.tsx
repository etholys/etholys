'use client';

import Link from 'next/link';
import {
  FileText,
  Folder,
  GripVertical,
  Pencil,
  Share2,
  Trash2,
} from 'lucide-react';

export type StudioLibraryFolder = {
  id: string;
  name: string;
  parentId: string | null;
  visibility?: string;
  access?: string;
};

export type StudioLibraryDocument = {
  id: string;
  title: string;
  format: string;
  updatedAt: string;
  visibility?: string;
  access?: string;
  updatedBy?: { id: string; name: string | null; email: string } | null;
};

export const STUDIO_MOVE_MIME = 'application/x-etholys-studio-move';

export type StudioMovePayload = {
  folderIds: string[];
  documentIds: string[];
};

type Props = {
  locale: string;
  folders: StudioLibraryFolder[];
  documents: StudioLibraryDocument[];
  busy: boolean;
  selectedFolderIds: string[];
  selectedDocIds: string[];
  dropHighlightId: string | null | 'root';
  onToggleFolder: (id: string, extend: boolean) => void;
  onToggleDoc: (id: string, extend: boolean) => void;
  onEnterFolder: (f: StudioLibraryFolder) => void;
  onRenameFolder: (f: StudioLibraryFolder) => void;
  onDeleteFolder: (f: StudioLibraryFolder) => void;
  onShareFolder: (f: StudioLibraryFolder) => void;
  onRenameDoc: (d: StudioLibraryDocument) => void;
  onDeleteDoc: (d: StudioLibraryDocument) => void;
  onShareDoc: (d: StudioLibraryDocument) => void;
  onDragStart: (payload: StudioMovePayload) => void;
  onDragEnd: () => void;
  onDragOverFolder: (targetFolderId: string) => void;
  onDropOnFolder: (targetFolderId: string, payload: StudioMovePayload) => void;
  canManage: (access?: string) => boolean;
  t: (pt: string, es: string, en: string) => string;
};

function parseMovePayload(raw: string): StudioMovePayload | null {
  try {
    const o = JSON.parse(raw) as StudioMovePayload;
    if (!o || typeof o !== 'object') return null;
    return {
      folderIds: Array.isArray(o.folderIds) ? o.folderIds.filter(Boolean) : [],
      documentIds: Array.isArray(o.documentIds) ? o.documentIds.filter(Boolean) : [],
    };
  } catch {
    return null;
  }
}

export function readStudioMovePayload(dt: DataTransfer): StudioMovePayload | null {
  const raw = dt.getData(STUDIO_MOVE_MIME);
  if (raw) return parseMovePayload(raw);
  return null;
}

export function StudioLibraryGrid({
  locale,
  folders,
  documents,
  busy,
  selectedFolderIds,
  selectedDocIds,
  dropHighlightId,
  onToggleFolder,
  onToggleDoc,
  onEnterFolder,
  onRenameFolder,
  onDeleteFolder,
  onShareFolder,
  onRenameDoc,
  onDeleteDoc,
  onShareDoc,
  onDragStart,
  onDragEnd,
  onDragOverFolder,
  onDropOnFolder,
  canManage,
  t,
}: Props) {
  const selectedFolders = new Set(selectedFolderIds);
  const selectedDocs = new Set(selectedDocIds);

  function buildPayload(folderId?: string, docId?: string): StudioMovePayload {
    if (folderId && selectedFolders.has(folderId)) {
      return { folderIds: [...selectedFolderIds], documentIds: [...selectedDocIds] };
    }
    if (docId && selectedDocs.has(docId)) {
      return { folderIds: [...selectedFolderIds], documentIds: [...selectedDocIds] };
    }
    return {
      folderIds: folderId ? [folderId] : [],
      documentIds: docId ? [docId] : [],
    };
  }

  function handleDragStart(e: React.DragEvent, payload: StudioMovePayload) {
    if (!payload.folderIds.length && !payload.documentIds.length) return;
    e.dataTransfer.setData(STUDIO_MOVE_MIME, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
    onDragStart(payload);
  }

  function folderDropHandlers(targetId: string) {
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverFolder(targetId);
      },
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const payload = readStudioMovePayload(e.dataTransfer);
        if (!payload) return;
        if (payload.folderIds.includes(targetId)) return;
        onDropOnFolder(targetId, payload);
      },
    };
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {folders.map((f) => {
        const selected = selectedFolders.has(f.id);
        const isDropTarget = dropHighlightId === f.id;
        return (
          <div
            key={f.id}
            {...folderDropHandlers(f.id)}
            className={`flex items-start gap-2 rounded-xl border bg-white p-3 shadow-sm transition ${
              isDropTarget
                ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-300'
                : selected
                  ? 'border-orange-400 bg-orange-50/40 ring-1 ring-orange-200'
                  : 'border-slate-200 hover:border-amber-300 hover:shadow-md'
            }`}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleFolder(f.id, e.nativeEvent.shiftKey)}
              className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600"
              aria-label={t('Selecionar pasta', 'Seleccionar carpeta', 'Select folder')}
            />
            <button
              type="button"
              draggable={canManage(f.access)}
              disabled={!canManage(f.access) || busy}
              onDragStart={(e) => handleDragStart(e, buildPayload(f.id))}
              onDragEnd={onDragEnd}
              className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
              title={t('Arrastar', 'Arrastrar', 'Drag')}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onEnterFolder(f)}
              className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
            >
              <Folder className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{f.name}</p>
                <p className="text-xs text-slate-500">
                  {t('Pasta', 'Carpeta', 'Folder')}
                  {f.visibility === 'company'
                    ? ` · ${t('toda a empresa', 'toda la empresa', 'whole company')}`
                    : ` · ${t('privada', 'privada', 'private')}`}
                </p>
              </div>
            </button>
            <div className="flex shrink-0 flex-col gap-1">
              {canManage(f.access) && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    title={t('Renomear', 'Renombrar', 'Rename')}
                    onClick={() => onRenameFolder(f)}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    title={t('Apagar', 'Borrar', 'Delete')}
                    onClick={() => onDeleteFolder(f)}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {(f.access === 'owner' || f.access === 'admin' || !f.access) && (
                <button
                  type="button"
                  title={t('Partilhar pasta', 'Compartir carpeta', 'Share folder')}
                  onClick={() => onShareFolder(f)}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-800 hover:bg-amber-100"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
      {documents.map((doc) => {
        const selected = selectedDocs.has(doc.id);
        return (
          <div
            key={doc.id}
            className={`flex items-start gap-2 rounded-xl border bg-white p-3 shadow-sm transition ${
              selected
                ? 'border-orange-400 bg-orange-50/40 ring-1 ring-orange-200'
                : 'border-slate-200 hover:border-orange-300 hover:shadow-md'
            }`}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onToggleDoc(doc.id, e.nativeEvent.shiftKey)}
              className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600"
              aria-label={t('Selecionar documento', 'Seleccionar documento', 'Select document')}
            />
            <button
              type="button"
              draggable={canManage(doc.access)}
              disabled={!canManage(doc.access) || busy}
              onDragStart={(e) => handleDragStart(e, buildPayload(undefined, doc.id))}
              onDragEnd={onDragEnd}
              className="mt-0.5 shrink-0 cursor-grab touch-none rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
              title={t('Arrastar', 'Arrastrar', 'Drag')}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <Link href={`/hub/studio/${doc.id}`} className="flex min-w-0 flex-1 items-start gap-2.5">
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{doc.title}</p>
                <p className="text-xs text-slate-500">
                  {doc.format} · {new Date(doc.updatedAt).toLocaleString(locale === 'en' ? 'en' : locale)}
                  {doc.updatedBy ? ` · ${doc.updatedBy.name?.trim() || doc.updatedBy.email}` : ''}
                  {doc.visibility === 'company'
                    ? ` · ${t('toda a empresa', 'toda la empresa', 'whole company')}`
                    : ` · ${t('privado', 'privado', 'private')}`}
                </p>
              </div>
            </Link>
            <div className="flex shrink-0 flex-col gap-1">
              {canManage(doc.access) && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    title={t('Renomear', 'Renombrar', 'Rename')}
                    onClick={() => onRenameDoc(doc)}
                    className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    title={t('Apagar', 'Borrar', 'Delete')}
                    onClick={() => onDeleteDoc(doc)}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              {(doc.access === 'owner' || doc.access === 'admin' || !doc.access) && (
                <button
                  type="button"
                  title={t('Partilhar documento', 'Compartir documento', 'Share document')}
                  onClick={() => onShareDoc(doc)}
                  className="rounded-lg border border-amber-200 bg-amber-50 p-1.5 text-amber-800 hover:bg-amber-100"
                >
                  <Share2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
      {folders.length === 0 && documents.length === 0 && (
        <p className="col-span-full text-sm text-slate-500">
          {t(
            'Pasta vazia. Crie um documento a partir de um template.',
            'Carpeta vacía. Cree un documento desde una plantilla.',
            'Empty folder. Create a document from a template.',
          )}
        </p>
      )}
    </div>
  );
}
