'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Expand, Minimize2 } from 'lucide-react';
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
  labels: {
    expand: string;
    collapse: string;
    hint: string;
  };
};

export function StudioDrawingEditor({ value, onChange, disabled, labels }: Props) {
  const [expanded, setExpanded] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSerialized = useRef(value);
  const sceneVersion = useRef(0);

  const initial = useMemo(() => {
    const parsed = parseStudioDrawScene(value) || emptyStudioDrawScene();
    return parsed;
    // Só na montagem — Excalidraw controla o estado depois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);

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

  const board = (
    <div className={`relative w-full ${expanded ? 'h-[min(80vh,720px)]' : 'h-[380px]'}`}>
      <Excalidraw
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
  );

  const chrome = (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] text-slate-500">{labels.hint}</p>
      {!disabled && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-orange-300 hover:bg-orange-50"
        >
          {expanded ? (
            <>
              <Minimize2 className="h-3.5 w-3.5" /> {labels.collapse}
            </>
          ) : (
            <>
              <Expand className="h-3.5 w-3.5" /> {labels.expand}
            </>
          )}
        </button>
      )}
    </div>
  );

  if (expanded) {
    return (
      <div className="fixed inset-0 z-[80] flex flex-col bg-black/50 p-3 sm:p-6">
        <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
            <p className="text-sm font-semibold text-slate-900">{labels.hint}</p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Minimize2 className="h-3.5 w-3.5" /> {labels.collapse}
            </button>
          </div>
          <div className="min-h-0 flex-1">{board}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-2">{chrome}</div>
      {board}
    </div>
  );
}

/** Preview estático a partir do svgPreview guardado. */
export function StudioDrawingPreview({ value, emptyHint }: { value: string; emptyHint?: string }) {
  const scene = parseStudioDrawScene(value);
  if (!scene?.svgPreview) {
    const hasElements = (scene?.elements?.length || 0) > 0;
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {hasElements
          ? 'Diagrama visual (abra o editor para ver)'
          : emptyHint || 'Quadro vazio — clique para desenhar'}
      </div>
    );
  }
  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 [&_svg]:mx-auto [&_svg]:max-h-[420px] [&_svg]:w-auto"
      dangerouslySetInnerHTML={{ __html: scene.svgPreview }}
    />
  );
}
