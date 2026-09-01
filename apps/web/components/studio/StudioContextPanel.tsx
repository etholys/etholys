'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { FileUp, Loader2, Paperclip, Trash2, X } from 'lucide-react';
import { useApp } from '@/app/providers';

export type StudioContextAssetRow = {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  label?: string | null;
  createdAt?: string;
};

type Props = {
  companyId?: string | null;
  folderId?: string | null;
  documentId?: string | null;
  canEdit: boolean;
  /** compact = barra do chat; panel = gestão na pasta */
  variant?: 'panel' | 'compact';
  open?: boolean;
  onClose?: () => void;
  onAssetsChange?: (assets: StudioContextAssetRow[]) => void;
};

export function StudioContextPanel({
  companyId,
  folderId,
  documentId,
  canEdit,
  variant = 'panel',
  open = true,
  onClose,
  onAssetsChange,
}: Props) {
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [assets, setAssets] = useState<StudioContextAssetRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    if (!folderId && !documentId) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (companyId) q.set('companyId', companyId);
      if (folderId) q.set('folderId', folderId);
      if (documentId) q.set('documentId', documentId);
      const r = await fetch(`/api/studio/context?${q}`, { cache: 'no-store' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const list = (d.assets || []) as StudioContextAssetRow[];
      setAssets(list);
      onAssetsChange?.(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, folderId, documentId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function uploadFile(file: File) {
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (companyId) fd.append('companyId', companyId);
      if (folderId) fd.append('folderId', folderId);
      if (documentId) fd.append('documentId', documentId);
      if (label.trim()) fd.append('label', label.trim());
      const r = await fetch('/api/studio/context', { method: 'POST', body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setLabel('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!canEdit) return;
    if (!confirm(t('Remover este contexto?', '¿Eliminar este contexto?', 'Remove this context?'))) return;
    setBusy(true);
    try {
      const q = new URLSearchParams({ id });
      if (companyId) q.set('companyId', companyId);
      const r = await fetch(`/api/studio/context?${q}`, { method: 'DELETE' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const body = (
    <div className={variant === 'panel' ? 'space-y-3' : 'space-y-2'}>
      {variant === 'panel' && (
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">
              {t('Contexto para a IA', 'Contexto para la IA', 'Context for AI')}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              {folderId
                ? t(
                    'Documentos e imagens gerais desta pasta (empresa, projeto…). Aplicam-se aos documentos dentro dela.',
                    'Documentos e imágenes generales de esta carpeta (empresa, proyecto…). Se aplican a los documentos dentro.',
                    'General docs and images for this folder (company, project…). Applied to documents inside it.',
                  )
                : t(
                    'Anexos deste documento / chat.',
                    'Adjuntos de este documento / chat.',
                    'Attachments for this document / chat.',
                  )}
            </p>
          </div>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          {variant === 'panel' && (
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('Etiqueta (opcional)', 'Etiqueta (opcional)', 'Label (optional)')}
              className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
            />
          )}
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.txt,.md,.csv,.json,.docx,image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void uploadFile(f);
            }}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            {t('Adicionar', 'Añadir', 'Add')}
          </button>
        </div>
      )}

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
      ) : assets.length === 0 ? (
        <p className="text-xs text-slate-500">
          {t('Ainda sem ficheiros de contexto.', 'Aún sin archivos de contexto.', 'No context files yet.')}
        </p>
      ) : (
        <ul className="max-h-48 space-y-1 overflow-y-auto">
          {assets.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-1.5 text-xs"
            >
              <span className="min-w-0 truncate">
                <Paperclip className="mr-1 inline h-3 w-3 text-slate-400" />
                <span className="font-medium text-slate-800">{a.label || a.name}</span>
                <span className="ml-1 text-slate-400">
                  · {a.mimeType.split('/').pop()} · {Math.max(1, Math.round(a.sizeBytes / 1024))} KB
                </span>
              </span>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(a.id)}
                  className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );

  if (variant === 'compact') return body;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">{body}</div>
    </div>
  );
}

/** Upload directo (ex. anexos do chat antes de enviar). */
export async function uploadStudioChatAttachment(opts: {
  companyId?: string | null;
  documentId: string;
  file: File;
}): Promise<StudioContextAssetRow> {
  const { parseStudioApiResponse } = await import('@/lib/studio/api-response');
  const fd = new FormData();
  fd.append('file', opts.file);
  fd.append('documentId', opts.documentId);
  if (opts.companyId) fd.append('companyId', opts.companyId);
  const r = await fetch('/api/studio/context', { method: 'POST', body: fd });
  const d = await parseStudioApiResponse<{ error?: string; asset?: StudioContextAssetRow }>(r);
  if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
  if (!d.asset) throw new Error('Resposta de upload inválida.');
  return d.asset;
}
