'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FilePlus2, FileText, Folder, Loader2 } from 'lucide-react';
import { useApp } from '@/app/providers';

type FolderRow = { id: string; name: string };
type DocRow = { id: string; title: string; format: string };
type TemplateRow = {
  key: string;
  nameEs: string;
  namePt: string;
  nameEn: string;
  descriptionEs?: string;
  descriptionPt?: string;
  descriptionEn?: string;
};

/** Vista de pasta para convidado (ou atalho interno). */
export default function StudioSharedFolderPage() {
  const params = useParams();
  const router = useRouter();
  const { locale } = useApp();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const folderId = String(params?.folderId || '');
  const [name, setName] = useState('Pasta');
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!folderId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/studio/documents?folderId=${encodeURIComponent(folderId)}`, {
        cache: 'no-store',
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      const folder =
        (d.folders || []).find((f: { id: string }) => f.id === folderId) ||
        (d.allFolders || []).find((f: { id: string }) => f.id === folderId);
      if (folder?.name) setName(folder.name);
      else if (typeof d.folderName === 'string') setName(d.folderName);
      setFolders((d.folders || []).filter((f: { id: string }) => f.id !== folderId));
      setDocuments(d.documents || []);
      setTemplates(d.templates || []);
      setCompanyId(d.companyId || null);
      setCanEdit(d.canEdit === true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDoc(templateKey?: string) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/studio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: companyId || undefined,
          folderId,
          templateKey,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || d.error || `HTTP ${r.status}`);
      router.push(`/hub/studio/${d.document.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white">
      <header className="border-b border-amber-200/60 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/studio/shared" className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Folder className="h-5 w-5 shrink-0 text-amber-600" />
            <span className="truncate font-bold text-slate-900">{name}</span>
          </div>
          {canEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowTemplates(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <FilePlus2 className="h-4 w-4" />
              {t('Novo documento', 'Nuevo documento', 'New document')}
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          <div className="grid gap-3">
            {folders.map((f) => (
              <Link
                key={f.id}
                href={`/studio/f/${f.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-300"
              >
                <Folder className="h-5 w-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-slate-900">{f.name}</p>
                  <p className="text-xs text-slate-500">{t('Pasta', 'Carpeta', 'Folder')}</p>
                </div>
              </Link>
            ))}
            {documents.map((d) => (
              <Link
                key={d.id}
                href={`/hub/studio/${d.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-orange-300"
              >
                <FileText className="h-5 w-5 text-orange-600" />
                <div>
                  <p className="font-semibold text-slate-900">{d.title}</p>
                  <p className="text-xs text-slate-500">{d.format}</p>
                </div>
              </Link>
            ))}
            {folders.length === 0 && documents.length === 0 && (
              <p className="text-sm text-slate-500">
                {t(
                  'Pasta vazia. Crie um documento para começar.',
                  'Carpeta vacía. Cree un documento para empezar.',
                  'Empty folder. Create a document to get started.',
                )}
              </p>
            )}
          </div>
        )}
      </main>

      {showTemplates && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {t('Novo documento', 'Nuevo documento', 'New document')}
              </h2>
              <button type="button" onClick={() => setShowTemplates(false)} className="text-sm text-slate-500">
                {t('Fechar', 'Cerrar', 'Close')}
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void createDoc()}
              className="mb-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
            >
              {t('Documento em branco', 'Documento en blanco', 'Blank document')}
            </button>
            <ul className="space-y-2">
              {templates.map((tpl) => (
                <li key={tpl.key}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void createDoc(tpl.key)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
                  >
                    <p className="font-semibold text-slate-900">
                      {locale === 'pt' ? tpl.namePt : locale === 'en' ? tpl.nameEn : tpl.nameEs}
                    </p>
                    <p className="text-xs text-slate-500">
                      {locale === 'pt'
                        ? tpl.descriptionPt
                        : locale === 'en'
                          ? tpl.descriptionEn
                          : tpl.descriptionEs}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
