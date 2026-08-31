'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';

type Props = {
  locale: string;
  disabled?: boolean;
  canDelete?: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  duplicating?: boolean;
};

export function StudioDocMoreMenu({
  locale,
  disabled,
  canDelete,
  onDuplicate,
  onDelete,
  duplicating,
}: Props) {
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-stone-200 bg-white p-1.5 text-stone-600 hover:bg-stone-50 disabled:opacity-40"
        title={loc === 'es' ? 'Más acciones' : loc === 'en' ? 'More actions' : 'Mais acções'}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            disabled={duplicating}
            onClick={() => {
              setOpen(false);
              onDuplicate();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            {loc === 'es' ? 'Duplicar' : loc === 'en' ? 'Duplicate' : 'Duplicar'}
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {loc === 'es' ? 'Eliminar documento' : loc === 'en' ? 'Delete document' : 'Apagar documento'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
