'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Presentation,
  Handshake,
  Mail,
  Sparkles,
  Ruler,
  Upload,
  BookMarked,
  X,
  Loader2,
  Heart,
  Printer,
  PenLine,
  Table2,
  Globe,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Film,
  FileType2,
} from 'lucide-react';
import {
  galleryKindLabel,
  galleryKindLayer,
  studioLayerLabel,
  type StudioGalleryKind,
  type StudioStudioLayer,
} from '@/lib/studio/templates';
import { resolveTemplatePreviewCanvas } from '@/lib/studio/template-library/resolve-preview';
import { StudioTemplatePreview } from '@/components/studio/StudioTemplatePreview';
import type { StudioPageSize } from '@/lib/studio/types';

export type GalleryTemplate = {
  key: string;
  format: string;
  domain?: string;
  studioLayer?: StudioStudioLayer;
  galleryKind?: string;
  nameEs: string;
  namePt: string;
  nameEn: string;
  descriptionEs: string;
  descriptionPt: string;
  descriptionEn: string;
  isSystem?: boolean;
  isCompany?: boolean;
};

type Props = {
  open: boolean;
  locale: string;
  busy?: boolean;
  companyId?: string;
  templates: GalleryTemplate[];
  onClose: () => void;
  onPickSystem: (templateKey: string) => void;
  onPickCompany: (templateKey: string) => void;
  onBlank: (opts?: { pageSize?: StudioPageSize; format?: string; studioMode?: 'write' | 'design' }) => void;
  onUploadFile: (file: File) => void;
};

const CONTENT_SIDEBAR: Array<{ kind: StudioGalleryKind; icon: typeof FileText; color: string }> = [
  { kind: 'for_you', icon: Sparkles, color: 'bg-violet-100 text-violet-700' },
  { kind: 'docs', icon: FileText, color: 'bg-teal-100 text-teal-800' },
  { kind: 'data', icon: Table2, color: 'bg-blue-100 text-blue-800' },
  { kind: 'slides', icon: Presentation, color: 'bg-amber-100 text-amber-900' },
  { kind: 'pdf', icon: FileType2, color: 'bg-slate-100 text-slate-800' },
  { kind: 'upload', icon: Upload, color: 'bg-slate-100 text-slate-700' },
  { kind: 'company', icon: BookMarked, color: 'bg-amber-100 text-amber-900' },
];

const DESIGN_SIDEBAR: Array<{ kind: StudioGalleryKind; icon: typeof FileText; color: string }> = [
  { kind: 'for_you', icon: Sparkles, color: 'bg-violet-100 text-violet-700' },
  { kind: 'presentations', icon: Presentation, color: 'bg-rose-100 text-rose-800' },
  { kind: 'social', icon: Heart, color: 'bg-red-100 text-red-700' },
  { kind: 'photos', icon: ImageIcon, color: 'bg-pink-100 text-pink-800' },
  { kind: 'videos', icon: Film, color: 'bg-fuchsia-100 text-fuchsia-800' },
  { kind: 'print', icon: Printer, color: 'bg-indigo-100 text-indigo-800' },
  { kind: 'whiteboards', icon: PenLine, color: 'bg-emerald-100 text-emerald-800' },
  { kind: 'web', icon: Globe, color: 'bg-sky-100 text-sky-800' },
  { kind: 'emails', icon: Mail, color: 'bg-purple-100 text-purple-800' },
  { kind: 'proposals', icon: Handshake, color: 'bg-orange-100 text-orange-800' },
  { kind: 'letters', icon: Mail, color: 'bg-sky-100 text-sky-700' },
  { kind: 'company', icon: BookMarked, color: 'bg-amber-100 text-amber-900' },
  { kind: 'custom_size', icon: Ruler, color: 'bg-slate-100 text-slate-700' },
];

const SIZES: StudioPageSize[] = ['A4', 'A3', 'Letter', 'Slide'];

function matchesKind(tpl: GalleryTemplate, kind: StudioGalleryKind, layer: StudioStudioLayer): boolean {
  const g = tpl.galleryKind || 'docs';
  const tplLayer = tpl.studioLayer || (galleryKindLayer(g as StudioGalleryKind) === 'content' ? 'content' : 'design');
  if (kind === 'proposals') return g === 'proposals' || tpl.domain === 'fundhub';
  if (kind === 'presentations') return g === 'presentations' || (tpl.format === 'presentation' && tplLayer === 'design');
  if (kind === 'slides') return g === 'slides' || (tpl.format === 'presentation' && tplLayer === 'content');
  if (kind === 'letters') return g === 'letters' || tpl.format === 'letter';
  if (kind === 'social') return g === 'social';
  if (kind === 'photos') return g === 'photos';
  if (kind === 'videos') return g === 'videos';
  if (kind === 'print') return g === 'print';
  if (kind === 'whiteboards') return g === 'whiteboards' || tpl.format === 'diagram';
  if (kind === 'data') return g === 'data';
  if (kind === 'pdf') return g === 'pdf';
  if (kind === 'web') return g === 'web';
  if (kind === 'emails') return g === 'emails';
  if (kind === 'docs') {
    return (
      g === 'docs' ||
      (!['proposals', 'presentations', 'slides', 'letters', 'social', 'photos', 'videos', 'print', 'whiteboards', 'data', 'pdf', 'web', 'emails'].includes(
        String(g),
      ) &&
        tpl.format !== 'presentation')
    );
  }
  return false;
}

function templateMatchesLayer(tpl: GalleryTemplate, layer: StudioStudioLayer): boolean {
  if (tpl.isCompany) {
    if (tpl.studioLayer) return tpl.studioLayer === layer;
    return true;
  }
  if (tpl.studioLayer) return tpl.studioLayer === layer;
  const g = (tpl.galleryKind || 'docs') as StudioGalleryKind;
  const kLayer = galleryKindLayer(g);
  if (kLayer === 'both') return true;
  return kLayer === layer;
}

export function StudioCreateGallery({
  open,
  locale,
  busy,
  companyId,
  templates,
  onClose,
  onPickSystem,
  onPickCompany,
  onBlank,
  onUploadFile,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const [layer, setLayer] = useState<StudioStudioLayer>('design');
  const [kind, setKind] = useState<StudioGalleryKind>('for_you');
  const sidebar = layer === 'content' ? CONTENT_SIDEBAR : DESIGN_SIDEBAR;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(0);
  const [companyPreview, setCompanyPreview] = useState<ReturnType<typeof resolveTemplatePreviewCanvas>>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const nameOf = (tpl: GalleryTemplate) =>
    locale === 'pt' ? tpl.namePt : locale === 'es' ? tpl.nameEs : tpl.nameEn;
  const descOf = (tpl: GalleryTemplate) =>
    locale === 'pt' ? tpl.descriptionPt : locale === 'es' ? tpl.descriptionEs : tpl.descriptionEn;

  const filtered = useMemo(() => {
    const inLayer = templates.filter((x) => templateMatchesLayer(x, layer));
    if (kind === 'for_you') {
      return inLayer.filter((x) => x.isSystem !== false && !x.isCompany).slice(0, 12);
    }
    if (kind === 'company') return inLayer.filter((x) => x.isCompany);
    if (kind === 'custom_size' || kind === 'upload') return [];
    return inLayer.filter((x) => matchesKind(x, kind, layer));
  }, [kind, layer, templates]);

  const selected = selectedKey ? templates.find((x) => x.key === selectedKey) : null;

  const systemPreview = useMemo(() => {
    if (!selectedKey || selected?.isCompany) return null;
    return resolveTemplatePreviewCanvas(selectedKey);
  }, [selectedKey, selected?.isCompany]);

  useEffect(() => {
    if (!selectedKey || !selected?.isCompany) {
      setCompanyPreview(null);
      return;
    }
    setPreviewLoading(true);
    const q = companyId ? `?companyId=${encodeURIComponent(companyId)}` : '';
    fetch(`/api/studio/templates/${encodeURIComponent(selectedKey)}/preview${q}`)
      .then((r) => r.json())
      .then((d) => setCompanyPreview(d.canvas || null))
      .catch(() => setCompanyPreview(null))
      .finally(() => setPreviewLoading(false));
  }, [selectedKey, selected?.isCompany, companyId]);

  const previewCanvas = selected?.isCompany ? companyPreview : systemPreview;

  useEffect(() => {
    setPreviewPage(0);
  }, [selectedKey]);

  useEffect(() => {
    if (!open) {
      setSelectedKey(null);
      setKind('for_you');
      setLayer('design');
    }
  }, [open]);

  useEffect(() => {
    setSelectedKey(null);
    setKind('for_you');
  }, [layer]);

  function confirmSelected() {
    if (!selectedKey || !selected) return;
    if (selected.isCompany) onPickCompany(selectedKey);
    else onPickSystem(selectedKey);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[88vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-lg font-bold text-slate-900">
            {layer === 'content'
              ? t('Criar documento', 'Crear documento', 'Create document')
              : t('Criar um design', 'Crear un diseño', 'Create a design')}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-[11.5rem] shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/80 p-2 sm:block sm:w-52">
            <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-200/60 p-1">
              {(['content', 'design'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLayer(l)}
                  className={`rounded-lg px-2 py-1.5 text-xs font-bold transition ${
                    layer === l ? 'bg-white text-violet-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {studioLayerLabel(l, locale)}
                </button>
              ))}
            </div>
            <p className="mb-2 px-1 text-[10px] leading-snug text-slate-500">
              {layer === 'content'
                ? t('Word · Excel · PPT · PDF', 'Word · Excel · PPT · PDF', 'Word · Excel · PPT · PDF')
                : t('Canva · Gamma · InDesign', 'Canva · Gamma · InDesign', 'Canva · Gamma · InDesign')}
            </p>
            {sidebar.map((item) => {
              const Icon = item.icon;
              const active = kind === item.kind;
              return (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => {
                    setKind(item.kind);
                    setSelectedKey(null);
                  }}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition ${
                    active ? 'bg-violet-100 text-violet-900' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{galleryKindLabel(item.kind, locale)}</span>
                </button>
              );
            })}
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row">
            <div className="min-h-0 flex-1 overflow-y-auto border-b border-slate-100 p-4 sm:p-5 lg:border-b-0 lg:border-r">
              {/* Mobile kind chips */}
              <div className="mb-3 flex gap-1 overflow-x-auto pb-1 sm:hidden">
                {(['content', 'design'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLayer(l)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      layer === l ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {studioLayerLabel(l, locale)}
                  </button>
                ))}
              </div>
              <div className="mb-3 flex gap-1 overflow-x-auto pb-1 sm:hidden">
                {sidebar.filter((s) => !['custom_size', 'upload'].includes(s.kind)).map((item) => (
                  <button
                    key={item.kind}
                    type="button"
                    onClick={() => {
                      setKind(item.kind);
                      setSelectedKey(null);
                    }}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      kind === item.kind ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {galleryKindLabel(item.kind, locale)}
                  </button>
                ))}
              </div>

              {kind === 'custom_size' ? (
                <div>
                  <p className="mb-3 text-sm text-slate-600">
                    {t(
                      'Escolhe o tamanho da folha e começa em branco (modo Desenho).',
                      'Elige el tamaño de la hoja y empieza en blanco (modo Diseño).',
                      'Pick a page size and start blank (Design mode).',
                    )}
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {SIZES.map((size) => (
                      <button
                        key={size}
                        type="button"
                        disabled={busy}
                        onClick={() => onBlank({ pageSize: size, format: size === 'Slide' ? 'presentation' : 'report' })}
                        className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-4 py-8 text-center font-bold text-slate-800 shadow-sm hover:border-violet-300 hover:shadow-md disabled:opacity-50"
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              ) : kind === 'upload' ? (
                <div className="mx-auto max-w-lg py-8 text-center">
                  <Upload className="mx-auto h-10 w-10 text-slate-400" />
                  <h3 className="mt-3 font-bold text-slate-900">
                    {t('Carregar um documento', 'Subir un documento', 'Upload a document')}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {t('PDF, DOCX ou TXT', 'PDF, DOCX o TXT', 'PDF, DOCX or TXT')}
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) onUploadFile(f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {t('Escolher ficheiro', 'Elegir archivo', 'Choose file')}
                  </button>
                </div>
              ) : kind === 'company' && filtered.length === 0 ? (
                <div className="mx-auto max-w-lg rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 px-5 py-8 text-center">
                  <BookMarked className="mx-auto h-8 w-8 text-amber-700" />
                  <h3 className="mt-3 font-bold text-slate-900">
                    {t('As vossas pré-estruturas', 'Vuestras preestructuras', 'Your pre-structures')}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {t(
                      'Cria um documento, define o layout em Design e usa «Plantilla» no editor.',
                      'Crea un documento, define el layout en Diseño y usa «Plantilla» en el editor.',
                      'Create a document, set layout in Design, then use “Template” in the editor.',
                    )}
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setSelectedKey(null);
                        const isSlides = kind === 'slides' || kind === 'presentations';
                        onBlank({
                          pageSize: isSlides ? 'Slide' : 'A4',
                          format: isSlides ? 'presentation' : 'report',
                          studioMode: layer === 'content' ? 'write' : 'design',
                        });
                      }}
                      className="flex min-h-[120px] w-[120px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-700 shadow-sm hover:border-violet-400 hover:bg-violet-50/40 disabled:opacity-50"
                    >
                      <span className="text-3xl font-light text-violet-500">+</span>
                      <span className="mt-2 px-2 text-center text-xs font-bold">
                        {t('Em branco', 'En blanco', 'Blank')}
                      </span>
                    </button>
                  </div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    {kind === 'for_you'
                      ? t('Sugestões', 'Sugerencias', 'Suggestions')
                      : galleryKindLabel(kind, locale)}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((tpl) => {
                      const thumb = !tpl.isCompany ? resolveTemplatePreviewCanvas(tpl.key) : null;
                      const active = selectedKey === tpl.key;
                      return (
                        <button
                          key={tpl.key}
                          type="button"
                          disabled={busy}
                          onClick={() => setSelectedKey(tpl.key)}
                          className={`rounded-2xl border p-3 text-left shadow-sm transition disabled:opacity-50 ${
                            active
                              ? 'border-violet-500 bg-violet-50/50 ring-2 ring-violet-300'
                              : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-md'
                          }`}
                        >
                          <div className="mb-2 overflow-hidden rounded-lg bg-slate-100">
                            {thumb ? (
                              <div className="pointer-events-none origin-top-left scale-[0.38]">
                                <StudioTemplatePreview canvas={thumb} brandColor="#7c3aed" />
                              </div>
                            ) : (
                              <div className="flex h-20 items-end p-2">
                                <div className="w-full space-y-1">
                                  <div className="h-2 w-3/4 rounded bg-slate-800/20" />
                                  <div className="h-1.5 w-full rounded bg-slate-800/10" />
                                </div>
                              </div>
                            )}
                          </div>
                          <p className="font-semibold text-slate-900">{nameOf(tpl)}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{descOf(tpl)}</p>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Preview pane */}
            <aside className="flex w-full shrink-0 flex-col border-t border-slate-100 bg-slate-50/60 lg:w-[22rem] lg:border-t-0 lg:border-l">
              {selected && previewCanvas ? (
                <>
                  <div className="border-b border-slate-200 px-4 py-3">
                    <p className="font-bold text-slate-900">{nameOf(selected)}</p>
                    <p className="mt-1 text-xs text-slate-600">{descOf(selected)}</p>
                  </div>
                  <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto p-4">
                    {previewLoading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
                    ) : (
                      <>
                        <StudioTemplatePreview canvas={previewCanvas} pageIndex={previewPage} />
                        {(previewCanvas.pages.length || 1) > 1 && (
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={previewPage <= 0}
                              onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"
                            >
                              <ChevronLeft className="h-4 w-4" />
                            </button>
                            <span className="text-xs font-medium text-slate-600">
                              {previewPage + 1} / {previewCanvas.pages.length}
                            </span>
                            <button
                              type="button"
                              disabled={previewPage >= previewCanvas.pages.length - 1}
                              onClick={() => setPreviewPage((p) => p + 1)}
                              className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="border-t border-slate-200 p-4">
                    <p className="mb-3 text-xs text-slate-500">
                    {t(
                      layer === 'content'
                        ? 'Pré-visualiza o conteúdo antes de criar.'
                        : 'Pré-visualiza o layout antes de criar o documento.',
                      layer === 'content'
                        ? 'Previsualiza el contenido antes de crear.'
                        : 'Previsualiza el layout antes de crear el documento.',
                      layer === 'content'
                        ? 'Preview content before creating.'
                        : 'Preview the layout before creating the document.',
                    )}
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={confirmSelected}
                      className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                      ) : (
                        t('Usar este modelo', 'Usar este modelo', 'Use this template')
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {t(
                      'Selecciona un modelo para previsualizar',
                      'Selecciona un modelo para previsualizar',
                      'Select a template to preview',
                    )}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {t(
                      layer === 'content'
                        ? 'Verás a estrutura de redação antes de abrir o editor.'
                        : 'Verás o layout de Desenho antes de abrir o editor.',
                      layer === 'content'
                        ? 'Verás la estructura de redacción antes de abrir el editor.'
                        : 'Verás el layout de Diseño antes de abrir el editor.',
                      layer === 'content'
                        ? 'You will see the writing structure before opening the editor.'
                        : 'You will see the Design layout before opening the editor.',
                    )}
                  </p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
