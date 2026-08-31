'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BookMarked,
  Copy,
  FileDown,
  LayoutTemplate,
  Link2,
  MoreHorizontal,
  Share2,
  Trash2,
} from 'lucide-react';

type ExportFmt = 'docx' | 'xlsx' | 'pptx' | 'pdf';

type Props = {
  locale: string;
  variant?: 'write' | 'design';
  disabled?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
  canTemplate?: boolean;
  duplicating?: boolean;
  savingTemplate?: boolean;
  exporting?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  onShare?: () => void;
  onLink?: () => void;
  onMolds?: () => void;
  onSaveTemplate?: () => void;
  onExport?: (fmt: ExportFmt) => void;
};

function locLabel(locale: string, pt: string, es: string, en: string) {
  return locale === 'es' ? es : locale === 'en' ? en : pt;
}

export function StudioDocMoreMenu({
  locale,
  variant = 'write',
  disabled,
  canDelete,
  canShare,
  canTemplate,
  onDuplicate,
  onDelete,
  onShare,
  onLink,
  onMolds,
  onSaveTemplate,
  onExport,
  duplicating,
  savingTemplate,
  exporting,
}: Props) {
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isDesign = variant === 'design';

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const itemCls =
    'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] font-medium disabled:opacity-40';
  const itemWrite = `${itemCls} text-stone-700 hover:bg-stone-50`;
  const itemDesign = `${itemCls} text-violet-100 hover:bg-violet-900/50`;
  const item = isDesign ? itemDesign : itemWrite;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          isDesign
            ? 'inline-flex h-7 w-7 items-center justify-center rounded text-violet-300 hover:bg-violet-900/50'
            : 'inline-flex h-7 w-7 items-center justify-center rounded text-stone-600 hover:bg-stone-200/60'
        }
        title={locLabel(loc, 'Mais acções', 'Más acciones', 'More actions')}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className={`absolute right-0 top-full z-50 mt-1 min-w-[11rem] rounded-lg border py-1 shadow-lg ${
            isDesign ? 'border-violet-800 bg-[#1a1225]' : 'border-stone-200 bg-white'
          }`}
        >
          {canShare && onShare && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onShare();
              }}
              className={item}
            >
              <Share2 className="h-3.5 w-3.5 shrink-0" />
              {locLabel(loc, 'Partilhar', 'Compartir', 'Share')}
            </button>
          )}
          {onExport && (
            <>
              {(['docx', 'xlsx', 'pptx', 'pdf'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  disabled={!!exporting}
                  onClick={() => {
                    setOpen(false);
                    onExport(fmt);
                  }}
                  className={item}
                >
                  <FileDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  {locLabel(loc, `Exportar ${fmt.toUpperCase()}`, `Exportar ${fmt.toUpperCase()}`, `Export ${fmt.toUpperCase()}`)}
                </button>
              ))}
            </>
          )}
          {onLink && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onLink();
              }}
              className={item}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              {locLabel(loc, 'Vincular sistemas', 'Vincular sistemas', 'Link systems')}
            </button>
          )}
          {onMolds && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onMolds();
              }}
              className={item}
            >
              <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
              {locLabel(loc, 'Moldes', 'Moldes', 'Molds')}
            </button>
          )}
          {canTemplate && onSaveTemplate && (
            <button
              type="button"
              disabled={disabled || savingTemplate}
              onClick={() => {
                setOpen(false);
                onSaveTemplate();
              }}
              className={item}
            >
              <BookMarked className="h-3.5 w-3.5 shrink-0" />
              {locLabel(loc, 'Guardar plantilla', 'Guardar plantilla', 'Save template')}
            </button>
          )}
          <div className={`my-1 h-px ${isDesign ? 'bg-violet-800/60' : 'bg-stone-100'}`} />
          <button
            type="button"
            disabled={disabled || duplicating}
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
            className={item}
          >
            <Copy className="h-3.5 w-3.5 shrink-0" />
            {locLabel(loc, 'Duplicar', 'Duplicar', 'Duplicate')}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className={`${item} text-red-600 hover:bg-red-50 ${isDesign ? 'text-red-400 hover:bg-red-950/40' : ''}`}
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              {locLabel(loc, 'Apagar documento', 'Eliminar documento', 'Delete document')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
