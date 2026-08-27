'use client';

import { useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import {
  galleryKindLabel,
  type StudioGalleryKind,
} from '@/lib/studio/templates';
import type { StudioPageSize } from '@/lib/studio/types';

export type GalleryTemplate = {
  key: string;
  format: string;
  domain?: string;
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
  templates: GalleryTemplate[];
  onClose: () => void;
  onPickSystem: (templateKey: string) => void;
  onPickCompany: (templateKey: string) => void;
  onBlank: (opts?: { pageSize?: StudioPageSize; format?: string }) => void;
  onUploadFile: (file: File) => void;
};

const SIDEBAR: Array<{
  kind: StudioGalleryKind;
  icon: typeof FileText;
  color: string;
}> = [
  { kind: 'for_you', icon: Sparkles, color: 'bg-violet-100 text-violet-700' },
  { kind: 'docs', icon: FileText, color: 'bg-teal-100 text-teal-800' },
  { kind: 'proposals', icon: Handshake, color: 'bg-orange-100 text-orange-800' },
  { kind: 'presentations', icon: Presentation, color: 'bg-rose-100 text-rose-800' },
  { kind: 'letters', icon: Mail, color: 'bg-sky-100 text-sky-800' },
  { kind: 'company', icon: BookMarked, color: 'bg-amber-100 text-amber-900' },
  { kind: 'custom_size', icon: Ruler, color: 'bg-slate-100 text-slate-700' },
  { kind: 'upload', icon: Upload, color: 'bg-slate-100 text-slate-700' },
];

const SIZES: StudioPageSize[] = ['A4', 'A3', 'Letter', 'Slide'];

export function StudioCreateGallery({
  open,
  locale,
  busy,
  templates,
  onClose,
  onPickSystem,
  onPickCompany,
  onBlank,
  onUploadFile,
}: Props) {
  const t = (pt: string, es: string, en: string) => (locale === 'pt' ? pt : locale === 'es' ? es : en);
  const [kind, setKind] = useState<StudioGalleryKind>('for_you');
  const fileRef = useRef<HTMLInputElement | null>(null);

  const nameOf = (tpl: GalleryTemplate) =>
    locale === 'pt' ? tpl.namePt : locale === 'es' ? tpl.nameEs : tpl.nameEn;
  const descOf = (tpl: GalleryTemplate) =>
    locale === 'pt' ? tpl.descriptionPt : locale === 'es' ? tpl.descriptionEs : tpl.descriptionEn;

  const filtered = useMemo(() => {
    if (kind === 'for_you') {
      return templates.filter((x) => x.isSystem !== false && !x.isCompany).slice(0, 8);
    }
    if (kind === 'company') return templates.filter((x) => x.isCompany);
    if (kind === 'custom_size' || kind === 'upload') return [];
    return templates.filter((x) => {
      const g = x.galleryKind || 'docs';
      if (kind === 'proposals') return g === 'proposals' || x.domain === 'fundhub';
      if (kind === 'presentations') return g === 'presentations' || x.format === 'presentation';
      if (kind === 'letters') return g === 'letters' || x.format === 'letter';
      return g === 'docs' || (!['proposals', 'presentations', 'letters'].includes(String(g)) && x.format !== 'presentation');
    });
  }, [kind, templates]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4">
      <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-none bg-white shadow-2xl sm:h-[85vh] sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 sm:px-5">
          <h2 className="text-lg font-bold text-slate-900">
            {t('Criar documento', 'Crear un diseño', 'Create a design')}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="w-[11.5rem] shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50/80 p-2 sm:w-52">
            {SIDEBAR.map((item) => {
              const Icon = item.icon;
              const active = kind === item.kind;
              return (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => setKind(item.kind)}
                  className={`mb-0.5 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium transition ${
                    active ? 'bg-violet-100 text-violet-900' : 'text-slate-700 hover:bg-white'
                  }`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.color}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="truncate">{galleryKindLabel(item.kind, locale)}</span>
                </button>
              );
            })}
          </aside>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {kind === 'custom_size' ? (
              <div>
                <p className="mb-3 text-sm text-slate-600">
                  {t(
                    'Escolhe o tamanho da folha e começa em branco (modo Design).',
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
                  {t(
                    'PDF, DOCX ou TXT — o Studio cria um documento editável na pasta atual.',
                    'PDF, DOCX o TXT — Studio crea un documento editable en la carpeta actual.',
                    'PDF, DOCX or TXT — Studio creates an editable document in the current folder.',
                  )}
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
                    '1) Abre ou cria um documento com a estrutura desejada (Write + Design). 2) No editor, usa «Guardar como plantilla». 3) Volta aqui em «As nossas» para reutilizar. A IA de diagramação respeita o padrão das páginas do template.',
                    '1) Abre o crea un documento con la estructura deseada (Redacción + Diseño). 2) En el editor, usa «Guardar como plantilla». 3) Vuelve aquí en «Las nuestras» para reutilizar. La IA de diagramación respeta el patrón de páginas del template.',
                    '1) Open or create a document with the structure you want (Write + Design). 2) In the editor, use “Save as template”. 3) Come back here under “Ours” to reuse it. Layout AI follows the template page pattern.',
                  )}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onBlank({ pageSize: 'A4' })}
                  className="mt-5 rounded-xl border border-amber-400 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50"
                >
                  {t('Começar em branco', 'Empezar en blanco', 'Start blank')}
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onBlank({ pageSize: kind === 'presentations' ? 'Slide' : 'A4', format: kind === 'presentations' ? 'presentation' : 'report' })}
                    className="flex min-h-[140px] w-[140px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-700 shadow-sm hover:border-violet-400 hover:bg-violet-50/40 disabled:opacity-50"
                  >
                    <span className="text-3xl font-light text-violet-500">+</span>
                    <span className="mt-2 px-2 text-center text-xs font-bold">
                      {t('Documento em branco', 'Documento en blanco', 'Blank document')}
                    </span>
                  </button>
                </div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                  {kind === 'for_you'
                    ? t('Sugestões', 'Sugerencias', 'Suggestions')
                    : galleryKindLabel(kind, locale)}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      disabled={busy}
                      onClick={() => (tpl.isCompany ? onPickCompany(tpl.key) : onPickSystem(tpl.key))}
                      className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md disabled:opacity-50"
                    >
                      <div className="mb-3 flex h-24 items-end rounded-xl bg-gradient-to-br from-stone-100 via-orange-50 to-violet-100 p-3">
                        <div className="w-full space-y-1">
                          <div className="h-2 w-3/4 rounded bg-slate-800/20" />
                          <div className="h-1.5 w-full rounded bg-slate-800/10" />
                          <div className="h-1.5 w-4/5 rounded bg-slate-800/10" />
                        </div>
                      </div>
                      <p className="font-semibold text-slate-900">{nameOf(tpl)}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{descOf(tpl)}</p>
                      <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {tpl.isCompany ? t('Empresa', 'Empresa', 'Company') : (tpl.domain || tpl.format)}
                      </p>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}