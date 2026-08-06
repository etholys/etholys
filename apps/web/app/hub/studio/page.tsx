'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
  X,
} from 'lucide-react';
import { useApp } from '@/app/providers';
import { isLikelyDbId } from '@/lib/utils';
import { StudioShareDialog } from '@/components/studio/StudioShareDialog';

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
};
type TemplateRow = {
  key: string;
  format: string;
  nameEs: string;
  namePt: string;
  nameEn: string;
  descriptionEs: string;
  descriptionPt: string;
  descriptionEn: string;
};

export default function StudioHubPage() {
  const { locale, activeCompanyId, setActiveCompanyId } = useApp();
  const router = useRouter();
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const companyId = activeCompanyId && isLikelyDbId(activeCompanyId) ? activeCompanyId : '';

  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [allFolders, setAllFolders] = useState<FolderRow[]>([]);
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
      // Convidado só com partilhas: ir à vista de partilhados se a raiz estiver vazia
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
      setAllFolders(d.allFolders || []);
      setDocuments(d.documents || []);
      setTemplates(d.templates || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro');
    } finally {
      setLoading(false);
    }
  }, [companyId, folderId, locale, router, setActiveCompanyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const breadcrumb = useMemo(() => {
    const trail: FolderRow[] = [];
    let cur = folderId;
    while (cur) {
      const f = allFolders.find((x) => x.id === cur);
      if (!f) break;
      trail.unshift(f);
      cur = f.parentId;
    }
    return trail;
  }, [allFolders, folderId]);

  function openNewFolder() {
    setNewFolderName('');
    setNewFolderError(null);
    setShowNewFolder(true);
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

  async function createDoc(templateKey?: string) {
    if (!effectiveCompanyId) return;
    setBusy(true);
    try {
      const r = await fetch('/api/studio/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: effectiveCompanyId, folderId, templateKey }),
      });
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

  function templateName(tpl: TemplateRow) {
    return locale === 'pt' ? tpl.namePt : locale === 'es' ? tpl.nameEs : tpl.nameEn;
  }
  function templateDesc(tpl: TemplateRow) {
    return locale === 'pt' ? tpl.descriptionPt : locale === 'es' ? tpl.descriptionEs : tpl.descriptionEn;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/80 via-white to-slate-50">
      <header className="border-b border-amber-200/60 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/hub"
              className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-amber-800"
            >
              <ArrowLeft className="h-4 w-4" />
              Hub
            </Link>
            <div className="flex items-center gap-2 text-slate-900">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 text-white">
                <PenLine className="h-4 w-4" />
              </span>
              <div>
                <span className="font-bold tracking-tight">Studio</span>
                <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                  {t('ferramenta', 'herramienta', 'tool')}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!effectiveCompanyId}
              onClick={() => void openBrand()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Palette className="h-4 w-4" />
              {t('Marca', 'Marca', 'Brand')}
            </button>
            <button
              type="button"
              disabled={busy || !effectiveCompanyId}
              onClick={openNewFolder}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FolderPlus className="h-4 w-4" />
              {t('Pasta', 'Carpeta', 'Folder')}
            </button>
            <button
              type="button"
              disabled={busy || !effectiveCompanyId}
              onClick={() => setShowTemplates(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            >
              <FilePlus2 className="h-4 w-4" />
              {t('Novo documento', 'Nuevo documento', 'New document')}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">
            {t('Biblioteca de documentos', 'Biblioteca de documentos', 'Document library')}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {t(
              'Crie e organize documentos com IA. Atalho laranja em qualquer sistema.',
              'Cree y organice documentos con IA. Atajo naranja en cualquier sistema.',
              'Create and organize documents with AI. Orange shortcut on every system.',
            )}
          </p>
        </div>

        <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-slate-600">
          <button
            type="button"
            onClick={() => setFolderId(null)}
            className="rounded px-1.5 py-0.5 font-medium hover:bg-amber-50 hover:text-amber-900"
          >
            {t('Raiz', 'Raíz', 'Root')}
          </button>
          {breadcrumb.map((f) => (
            <span key={f.id} className="inline-flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => setFolderId(f.id)}
                className="rounded px-1.5 py-0.5 font-medium hover:bg-amber-50 hover:text-amber-900"
              >
                {f.name}
              </button>
            </span>
          ))}
        </nav>

        {loading ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            {t('A carregar…', 'Cargando…', 'Loading…')}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">{t('Studio indisponível', 'Studio no disponible', 'Studio unavailable')}</p>
            <p className="mt-1">{error}</p>
            {(error.includes('schema') || error.includes('prisma') || error.includes('Studio schema')) && (
              <p className="mt-2 text-xs text-amber-800">
                {t(
                  'Aplique manual_etholys_studio.sql e execute prisma generate.',
                  'Aplique manual_etholys_studio.sql y ejecute prisma generate.',
                  'Apply manual_etholys_studio.sql and run prisma generate.',
                )}
              </p>
            )}
            <p className="mt-3">
              <Link href="/studio/shared" className="font-semibold text-orange-700 underline">
                {t('Ver conteúdos partilhados comigo', 'Ver contenidos compartidos conmigo', 'View content shared with me')}
              </Link>
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:shadow-md"
              >
                <button type="button" onClick={() => setFolderId(f.id)} className="flex min-w-0 flex-1 items-start gap-3 text-left">
                  <Folder className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold text-slate-900">{f.name}</p>
                    <p className="text-xs text-slate-500">
                      {t('Pasta', 'Carpeta', 'Folder')}
                      {f.visibility === 'company'
                        ? ` · ${t('toda a empresa', 'toda la empresa', 'whole company')}`
                        : ` · ${t('privada', 'privada', 'private')}`}
                    </p>
                  </div>
                </button>
                {(f.access === 'owner' || f.access === 'admin' || !f.access) && (
                  <button
                    type="button"
                    title={t('Compartilhar pasta', 'Compartir carpeta', 'Share folder')}
                    onClick={() => setShareTarget({ folderId: f.id, title: f.name })}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800 hover:border-amber-300 hover:bg-amber-100"
                  >
                    <Share2 className="h-4 w-4" />
                    {t('Compartilhar', 'Compartir', 'Share')}
                  </button>
                )}
              </div>
            ))}
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-300 hover:shadow-md"
              >
                <Link href={`/hub/studio/${doc.id}`} className="flex min-w-0 flex-1 items-start gap-3">
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{doc.title}</p>
                    <p className="text-xs text-slate-500">
                      {doc.format} · {new Date(doc.updatedAt).toLocaleString(locale === 'en' ? 'en' : locale)}
                      {doc.visibility === 'company'
                        ? ` · ${t('toda a empresa', 'toda la empresa', 'whole company')}`
                        : ` · ${t('privado', 'privado', 'private')}`}
                    </p>
                  </div>
                </Link>
                {(doc.access === 'owner' || doc.access === 'admin' || !doc.access) && (
                  <button
                    type="button"
                    title={t('Compartilhar documento', 'Compartir documento', 'Share document')}
                    onClick={() => setShareTarget({ documentId: doc.id, title: doc.title })}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-xs font-semibold text-orange-800 hover:border-orange-300 hover:bg-orange-100"
                  >
                    <Share2 className="h-4 w-4" />
                    {t('Compartilhar', 'Compartir', 'Share')}
                  </button>
                )}
              </div>
            ))}
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
                      ? `${t('Dentro de', 'Dentro de', 'Inside')} / ${breadcrumb.map((item) => item.name).join(' / ')}`
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

      {showTemplates && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                {t('Escolher template', 'Elegir plantilla', 'Choose template')}
              </h2>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                {t('Fechar', 'Cerrar', 'Close')}
              </button>
            </div>
            <ul className="space-y-2 p-4">
              {templates.map((tpl) => (
                <li key={tpl.key}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void createDoc(tpl.key)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-left transition hover:border-orange-300 hover:bg-orange-50/50 disabled:opacity-50"
                  >
                    <p className="font-semibold text-slate-900">{templateName(tpl)}</p>
                    <p className="mt-0.5 text-sm text-slate-600">{templateDesc(tpl)}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">{tpl.format}</p>
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
