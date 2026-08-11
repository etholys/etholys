'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Minimize2, Pencil, Eye, PenLine } from 'lucide-react';
import {
  emptyStudioDrawScene,
  parseStudioDrawScene,
  serializeStudioDrawScene,
  type StudioDrawScene,
} from '@/lib/studio/draw-scene';

import '@excalidraw/excalidraw/index.css';

const Excalidraw = dynamic(
  async () => (await import('@excalidraw/excalidraw')).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-slate-50 text-sm text-slate-500">
        A carregar quadro de desenho…
      </div>
    ),
  },
);

type Props = {
  value: string;
  onChange: (serialized: string) => void;
  disabled?: boolean;
  /** Altura máx. do preview na folha */
  previewMaxHeight?: number;
  labels: {
    expand: string;
    collapse: string;
    hint: string;
    edit?: string;
    preview?: string;
  };
};

export function StudioDrawingEditor({
  value,
  onChange,
  disabled,
  previewMaxHeight = 200,
  labels,
}: Props) {
  const [editing, setEditing] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef(value);
  const sceneVersion = useRef(0);

  const initial = useMemo(() => {
    return parseStudioDrawScene(value) || emptyStudioDrawScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setEditing(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  const persist = useCallback(
    async (
      elements: readonly unknown[],
      appState: Record<string, unknown>,
      files: Record<string, unknown>,
    ) => {
      const scene: StudioDrawScene = {
        v: 1,
        app: 'excalidraw',
        elements: elements as unknown[],
        appState: {
          viewBackgroundColor: (appState.viewBackgroundColor as string) || '#ffffff',
        },
        files,
        svgPreview: null,
      };

      try {
        const mod = await import('@excalidraw/excalidraw');
        const svg = await mod.exportToSvg({
          elements: elements as never,
          appState: {
            exportBackground: true,
            viewBackgroundColor: scene.appState?.viewBackgroundColor || '#ffffff',
          } as never,
          files: files as never,
        });
        scene.svgPreview = svg.outerHTML;
      } catch {
        /* preview SVG best-effort */
      }

      const next = serializeStudioDrawScene(scene);
      if (next === lastSerialized.current) return;
      lastSerialized.current = next;
      onChange(next);
    },
    [onChange],
  );

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      if (disabled) return;
      sceneVersion.current += 1;
      const ver = sceneVersion.current;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (ver !== sceneVersion.current) return;
        void persist(
          elements,
          (appState || {}) as Record<string, unknown>,
          (files || {}) as Record<string, unknown>,
        );
      }, 450);
    },
    [disabled, persist],
  );

  if (!editing) {
    const scene = parseStudioDrawScene(value);
    const empty = !scene || scene.elements.length === 0;

    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) setEditing(true);
        }}
        className={`group/draw w-full overflow-hidden rounded-xl border text-left transition ${
          empty
            ? 'border-dashed border-slate-300 bg-slate-50/80 hover:border-orange-300 hover:bg-orange-50/40'
            : 'border-slate-200 bg-white hover:border-orange-300 hover:shadow-sm'
        } ${disabled ? 'cursor-default' : 'cursor-pointer'}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100/80 px-3 py-1.5">
          <p className="text-[11px] text-slate-500">{labels.hint}</p>
          {!disabled && (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 opacity-80 group-hover/draw:opacity-100">
              <Pencil className="h-3 w-3" />
              {labels.edit || 'Editar'}
            </span>
          )}
        </div>
        <div style={{ maxHeight: previewMaxHeight }} className="overflow-hidden">
          {empty ? (
            <div
              className="flex flex-col items-center justify-center gap-2 px-4 text-center"
              style={{ minHeight: Math.min(previewMaxHeight, 140) }}
            >
              <PenLine className="h-6 w-6 text-slate-300" />
              <p className="text-xs text-slate-400">
                {disabled
                  ? 'Quadro vazio'
                  : 'Clique para desenhar — formas, setas, texto e lápis'}
              </p>
            </div>
          ) : (
            <StudioDrawingPreview value={value} emptyHint={labels.hint} maxHeight={previewMaxHeight} />
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-slate-900/55 p-2 sm:p-5">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div>
            <p className="text-sm font-semibold text-slate-900">{labels.hint}</p>
            <p className="text-[11px] text-slate-500">Esc para fechar · grelha ativa</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Eye className="h-3.5 w-3.5" />
              {labels.preview || labels.collapse}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-700"
            >
              <Minimize2 className="h-3.5 w-3.5" />
              {labels.collapse}
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1">
          <Excalidraw
            key={`excal-${editing ? 'on' : 'off'}-${initial.elements.length}`}
            langCode="pt-BR"
            viewModeEnabled={!!disabled}
            zenModeEnabled={false}
            gridModeEnabled
            UIOptions={{
              canvasActions: {
                loadScene: false,
                export: false,
                saveAsImage: true,
                toggleTheme: false,
                changeViewBackgroundColor: true,
              },
            }}
            initialData={{
              elements: initial.elements as never,
              appState: {
                viewBackgroundColor: '#ffffff',
                ...(initial.appState || {}),
                collaborators: new Map(),
              } as never,
              files: (initial.files || {}) as never,
              scrollToContent: true,
            }}
            onChange={handleChange as never}
          />
        </div>
      </div>
    </div>
  );
}

/** Preview estático a partir do svgPreview guardado. */
export function StudioDrawingPreview({
  value,
  emptyHint,
  maxHeight = 200,
}: {
  value: string;
  emptyHint?: string;
  maxHeight?: number;
}) {
  const scene = parseStudioDrawScene(value);
  if (!scene?.svgPreview) {
    const hasElements = (scene?.elements?.length || 0) > 0;
    return (
      <div className="bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {hasElements
          ? 'Diagrama visual (abra o editor para ver)'
          : emptyHint || 'Quadro vazio — clique para desenhar'}
      </div>
    );
  }
  return (
    <div
      className="overflow-hidden bg-white p-2 [&_svg]:mx-auto [&_svg]:max-h-full [&_svg]:w-auto"
      style={{ maxHeight }}
      dangerouslySetInnerHTML={{ __html: scene.svgPreview }}
    />
  );
}
