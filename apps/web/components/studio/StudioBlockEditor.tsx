'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Underline,
  List,
  Heading2,
  Code2,
  Pencil,
  Eye,
  GitBranch,
  MessageSquare,
  ChevronUp,
  ChevronDown,
  Trash2,
  Crosshair,
  Sparkles,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Clapperboard,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import type { StudioBlock, StudioBlockKind, StudioBlockStyle, StudioImageEdit } from '@/lib/studio/types';
import { DEFAULT_IMAGE_EDIT, imageEditClipStyle, imageEditToCssFilter, imageEditZoomStyle } from '@/lib/studio/image-edit';
import { StudioMarkdown } from '@/lib/studio/markdown-lite';
import { StudioMermaidPreview } from '@/components/studio/StudioMermaidPreview';
import { StudioDrawingEditor } from '@/components/studio/StudioDrawingEditor';
import {
  emptyStudioDrawScene,
  isStudioDrawBlock,
  serializeStudioDrawScene,
} from '@/lib/studio/draw-scene';
import {
  studioBlockAlignClass,
  studioBlockFrameClass,
  studioBlockScaleClass,
} from '@/lib/studio/block-style';
import { StudioRichTextEditor } from '@/components/studio/StudioRichTextEditor';
import { StudioTableEditor } from '@/components/studio/StudioTableEditor';

const DIAGRAM_TEMPLATES: Array<{ id: string; label: string; source: string }> = [
  {
    id: 'flow',
    label: 'Fluxo',
    source: `flowchart TD
  A[Início] --> B{Decisão}
  B -->|Sim| C[Ação]
  B -->|Não| D[Fim]
  C --> D`,
  },
  {
    id: 'seq',
    label: 'Sequência',
    source: `sequenceDiagram
  participant U as Utilizador
  participant S as Sistema
  U->>S: Pedido
  S-->>U: Resposta`,
  },
  {
    id: 'mind',
    label: 'Mapa',
    source: `mindmap
  root((Tema))
    Ramo A
      Ideia 1
      Ideia 2
    Ramo B
      Ideia 3`,
  },
  {
    id: 'pie',
    label: 'Pizza',
    source: `pie title Distribuição
  "A" : 40
  "B" : 30
  "C" : 30`,
  },
];

function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
): { next: string; selStart: number; selEnd: number } {
  const selected = value.slice(start, end);
  if (selected) {
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    return {
      next,
      selStart: start + before.length,
      selEnd: start + before.length + selected.length,
    };
  }
  const placeholder = 'texto';
  const next = value.slice(0, start) + before + placeholder + after + value.slice(end);
  return {
    next,
    selStart: start + before.length,
    selEnd: start + before.length + placeholder.length,
  };
}

function prefixLines(value: string, start: number, end: number, prefix: string): string {
  const before = value.slice(0, start);
  const mid = value.slice(start, end) || value;
  const after = value.slice(end);
  const rangeStart = before.lastIndexOf('\n') + 1;
  const rangeEnd = end + (after.indexOf('\n') === -1 ? after.length : after.indexOf('\n'));
  const block = value.slice(rangeStart, rangeEnd || value.length);
  const lines = block.split('\n').map((l) => {
    const t = l.trim();
    if (!t) return l;
    if (t.startsWith(prefix.trim())) return l;
    return `${prefix}${t}`;
  });
  return value.slice(0, rangeStart) + lines.join('\n') + value.slice(rangeEnd || value.length);
}

type Props = {
  block: StudioBlock;
  /** Necessário para TipTap + ribbon (modo redação) */
  pageId?: string;
  onChange: (text: string) => void;
  onKindChange?: (kind: StudioBlockKind) => void;
  onDiagramLangChange?: (lang: 'draw' | 'mermaid') => void;
  onStyleChange?: (style: StudioBlockStyle) => void;
  /** Selecionado como alvo da IA */
  aiSelected?: boolean;
  onToggleAiSelect?: () => void;
  onComment?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canDelete?: boolean;
  disabled?: boolean;
  /** Redação: editar texto directamente (sem clique para «modo preview») */
  writeMode?: boolean;
  onInsertAfter?: () => void;
  onBackspaceEmpty?: () => void;
  onMergeWithPrev?: () => void;
  onFocusNext?: () => void;
  onFocusPrev?: () => void;
  /** Gera ilustração IA para bloco image (modo Desenho) */
  onGenerateImage?: (prompt?: string) => Promise<void>;
  onImagePromptChange?: (prompt: string) => void;
  onImageEditChange?: (edit: import('@/lib/studio/types').StudioImageEdit) => void;
  expandHeight?: boolean;
  labels: {
    edit: string;
    preview: string;
    bold: string;
    italic: string;
    list: string;
    heading: string;
    code: string;
    empty: string;
    editSource: string;
    templates: string;
    asHeading: string;
    asText: string;
    asList: string;
    visual: string;
    mermaid: string;
    drawHint: string;
    expandDraw: string;
    collapseDraw: string;
    selectForAi: string;
    selectedForAi: string;
    generateImage: string;
    imagePrompt: string;
    videoScene: string;
    adjustImage: string;
    brightness: string;
    contrast: string;
    crop: string;
  };
};

export function StudioBlockEditor({
  block,
  pageId,
  onChange,
  onKindChange,
  onDiagramLangChange,
  onStyleChange,
  aiSelected,
  onToggleAiSelect,
  onComment,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp,
  canMoveDown,
  canDelete,
  disabled,
  writeMode = false,
  onInsertAfter,
  onBackspaceEmpty,
  onMergeWithPrev,
  onFocusNext,
  onFocusPrev,
  onGenerateImage,
  onImagePromptChange,
  onImageEditChange,
  expandHeight,
  labels,
}: Props) {
  const styleWrap = writeMode
    ? studioBlockAlignClass(block.style)
    : `${studioBlockAlignClass(block.style)} ${studioBlockFrameClass(block.style)}`.trim();
  const scaleCls = studioBlockScaleClass(block.style, block.kind);

  const isDiagram = block.kind === 'diagram';
  const isDraw = isDiagram && isStudioDrawBlock(block);
  const isImage = block.kind === 'image';
  const isTable = block.kind === 'table';
  const [editing, setEditing] = useState(!!writeMode);
  const [imageBusy, setImageBusy] = useState(false);
  const [diagramSourceOpen, setDiagramSourceOpen] = useState(
    () => isDiagram && !isDraw && !block.text.trim(),
  );
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (writeMode && !isDiagram && !isImage && !isTable) setEditing(true);
  }, [writeMode, isDiagram, isImage, isTable]);

  useEffect(() => {
    if (!editing) return;
    const el = taRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.max(el.scrollHeight, writeMode ? 48 : 72)}px`;
  }, [editing, block.text, writeMode]);

  useEffect(() => {
    if (!editing || writeMode) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setEditing(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [editing, writeMode]);

  const applyWrap = useCallback(
    (before: string, after: string) => {
      const el = taRef.current;
      if (!el) return;
      const { next, selStart, selEnd } = wrapSelection(
        el.value,
        el.selectionStart,
        el.selectionEnd,
        before,
        after,
      );
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(selStart, selEnd);
        el.style.height = '0px';
        el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
      });
    },
    [onChange],
  );

  const applyList = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const next = prefixLines(el.value, el.selectionStart, el.selectionEnd, '- ');
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.style.height = '0px';
      el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
    });
  }, [onChange]);

  const applyHeadingLine = useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    const next = prefixLines(el.value, el.selectionStart, el.selectionEnd, '## ');
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.style.height = '0px';
      el.style.height = `${Math.max(el.scrollHeight, 72)}px`;
    });
  }, [onChange]);

  const toolBtn =
    'rounded p-1.5 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40';

  const toolbar = !disabled && editing && !isDiagram && !writeMode && (
    <div className="mb-2 flex flex-wrap items-center gap-0.5 rounded-xl border border-slate-200/90 bg-white px-1.5 py-1 shadow-sm">
      <button
        type="button"
        title={labels.bold}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyWrap('**', '**')}
        className={toolBtn}
      >
        <Bold className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={labels.italic}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyWrap('*', '*')}
        className={toolBtn}
      >
        <Italic className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title="Underline"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyWrap('<u>', '</u>')}
        className={toolBtn}
      >
        <Underline className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={labels.heading}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyHeadingLine()}
        className={toolBtn}
      >
        <Heading2 className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={labels.list}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyList()}
        className={toolBtn}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        title={labels.code}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => applyWrap('`', '`')}
        className={toolBtn}
      >
        <Code2 className="h-3.5 w-3.5" />
      </button>
      <span className="mx-1 h-4 w-px bg-slate-200" />
      {onKindChange && (
        <>
          <button
            type="button"
            title={labels.asHeading}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKindChange('heading')}
            className={`rounded px-1.5 py-1 text-[10px] font-semibold ${
              block.kind === 'heading' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            H
          </button>
          <button
            type="button"
            title={labels.asText}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKindChange('paragraph')}
            className={`rounded p-1.5 ${
              block.kind === 'paragraph' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Type className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title={labels.asList}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKindChange('bullets')}
            className={`rounded p-1.5 ${
              block.kind === 'bullets' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      {onStyleChange && (
        <>
          <span className="mx-1 h-4 w-px bg-slate-200" />
          {(
            [
              ['left', AlignLeft],
              ['center', AlignCenter],
              ['right', AlignRight],
            ] as const
          ).map(([align, Icon]) => (
            <button
              key={align}
              type="button"
              title={align}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                onStyleChange({
                  ...(block.style || {}),
                  align,
                })
              }
              className={`rounded p-1.5 ${
                (block.style?.align || 'left') === align
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </>
      )}
    </div>
  );

  const chrome = !disabled && !writeMode && (
    <div className="absolute -right-1 -top-1 z-10 flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/95 p-0.5 opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-within:opacity-100">
      {onToggleAiSelect && (
        <button
          type="button"
          onClick={onToggleAiSelect}
          title={aiSelected ? labels.selectedForAi : labels.selectForAi}
          className={`rounded p-1 ${
            aiSelected
              ? 'bg-orange-100 text-orange-700'
              : 'text-slate-400 hover:bg-orange-50 hover:text-orange-700'
          }`}
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
      )}
      {onMoveUp && (
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={onMoveUp}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
      )}
      {onMoveDown && (
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={onMoveDown}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      )}
      {onComment && (
        <button
          type="button"
          onClick={onComment}
          className="rounded p-1 text-slate-300 hover:bg-violet-50 hover:text-violet-700"
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
      )}
      {onDelete && canDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  if (isTable) {
    return (
      <div
        ref={rootRef}
        className={`group relative w-full rounded-lg transition ${
          aiSelected ? 'ring-2 ring-orange-400 ring-offset-2 bg-orange-50/40' : ''
        }`}
      >
        {aiSelected && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <Sparkles className="h-3 w-3" /> {labels.selectedForAi}
          </div>
        )}
        {chrome}
        <StudioTableEditor text={block.text} disabled={disabled} onChange={onChange} />
      </div>
    );
  }

  if (isImage) {
    const scene = block.mediaMeta?.type === 'video-scene' ? block.mediaMeta : null;
    return (
      <div
        ref={rootRef}
        className={`group relative w-full rounded-lg transition ${
          aiSelected ? 'ring-2 ring-orange-400 ring-offset-2 bg-orange-50/40' : ''
        }`}
      >
        {aiSelected && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <Sparkles className="h-3 w-3" /> {labels.selectedForAi}
          </div>
        )}
        {scene && (
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-semibold text-violet-800">
            <Clapperboard className="h-3 w-3" />
            {labels.videoScene}
            {scene.durationSec ? ` · ${scene.durationSec}s` : ''}
            {scene.narration ? (
              <span className="font-normal text-violet-600"> — {scene.narration.slice(0, 80)}</span>
            ) : null}
          </div>
        )}
        {chrome}
        {block.imageUrl ? (
          <div
            className="overflow-hidden rounded-lg"
            style={imageEditClipStyle(block.imageEdit)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.imageUrl}
              alt={block.text || 'image'}
              style={{
                filter: imageEditToCssFilter(block.imageEdit),
                ...imageEditZoomStyle(block.imageEdit),
              }}
              className={`mx-auto max-h-[240px] w-auto max-w-full rounded-lg object-contain shadow-sm ${styleWrap}`}
            />
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
            {labels.empty}
          </p>
        )}
        {!disabled && onGenerateImage && !writeMode && (
          <div className="mt-2 space-y-2">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {labels.imagePrompt}
            </label>
            <textarea
              value={block.imagePrompt || ''}
              onChange={(e) =>
                onImagePromptChange ? onImagePromptChange(e.target.value) : onChange(e.target.value)
              }
              rows={2}
              disabled={imageBusy}
              className="w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-violet-400"
              placeholder={labels.imagePrompt}
            />
            <button
              type="button"
              disabled={imageBusy}
              onClick={() => {
                setImageBusy(true);
                void onGenerateImage(block.imagePrompt || block.text || undefined).finally(() =>
                  setImageBusy(false),
                );
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {imageBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {labels.generateImage}
            </button>
          </div>
        )}
        {!disabled && onImageEditChange && block.imageUrl && !writeMode && (
          <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {labels.adjustImage}
            </p>
            {(
              [
                ['brightness', labels.brightness, block.imageEdit?.brightness ?? 100],
                ['contrast', labels.contrast, block.imageEdit?.contrast ?? 100],
                ['saturate', 'Sat', block.imageEdit?.saturate ?? 100],
                ['zoom', 'Zoom', block.imageEdit?.zoom ?? 100],
              ] as const
            ).map(([key, label, val]) => (
              <label key={key} className="flex items-center gap-2 text-[10px] text-slate-600">
                <span className="w-14 shrink-0 font-semibold">{label}</span>
                <input
                  type="range"
                  min={key === 'zoom' ? 100 : 0}
                  max={200}
                  value={val}
                  disabled={disabled}
                  onChange={(e) => {
                    const next: StudioImageEdit = {
                      ...DEFAULT_IMAGE_EDIT,
                      ...block.imageEdit,
                      [key]: Number(e.target.value),
                    };
                    onImageEditChange(next);
                  }}
                  className="min-w-0 flex-1"
                />
                <span className="w-8 tabular-nums">{val}</span>
              </label>
            ))}
            <label className="flex items-center gap-2 text-[10px] font-semibold text-slate-600">
              <input
                type="checkbox"
                checked={block.imageEdit?.grayscale ?? false}
                disabled={disabled}
                onChange={(e) =>
                  onImageEditChange({
                    ...DEFAULT_IMAGE_EDIT,
                    ...block.imageEdit,
                    grayscale: e.target.checked,
                  })
                }
              />
              B/W
            </label>
            <p className="pt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {labels.crop}
            </p>
            {(
              [
                ['cropTop', '↑', block.imageEdit?.cropTop ?? 0],
                ['cropRight', '→', block.imageEdit?.cropRight ?? 0],
                ['cropBottom', '↓', block.imageEdit?.cropBottom ?? 0],
                ['cropLeft', '←', block.imageEdit?.cropLeft ?? 0],
              ] as const
            ).map(([key, label, val]) => (
              <label key={key} className="flex items-center gap-2 text-[10px] text-slate-600">
                <span className="w-14 shrink-0 font-semibold">{label}</span>
                <input
                  type="range"
                  min={0}
                  max={45}
                  value={val}
                  disabled={disabled}
                  onChange={(e) => {
                    onImageEditChange({
                      ...DEFAULT_IMAGE_EDIT,
                      ...block.imageEdit,
                      [key]: Number(e.target.value),
                    });
                  }}
                  className="min-w-0 flex-1"
                />
                <span className="w-8 tabular-nums">{val}%</span>
              </label>
            ))}
          </div>
        )}
        {block.text && writeMode ? (
          <p className="mt-2 text-center text-xs text-slate-500">{block.text}</p>
        ) : null}
      </div>
    );
  }

  if (isDiagram) {
    return (
      <div
        ref={rootRef}
        className={`group relative w-full rounded-lg transition ${
          aiSelected ? 'ring-2 ring-orange-400 ring-offset-2 bg-orange-50/40' : ''
        }`}
      >
        {aiSelected && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            <Sparkles className="h-3 w-3" /> {labels.selectedForAi}
          </div>
        )}
        {chrome}
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            <GitBranch className="h-3 w-3" />
            {isDraw ? labels.visual : labels.mermaid}
          </span>
          {onDiagramLangChange && !disabled && (
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                type="button"
                onClick={() => {
                  if (isDraw) return;
                  onDiagramLangChange('draw');
                  onChange(serializeStudioDrawScene(emptyStudioDrawScene()));
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  isDraw ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {labels.visual}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!isDraw) return;
                  onDiagramLangChange('mermaid');
                  onChange('flowchart TD\n  A[Início] --> B[Fim]');
                  setDiagramSourceOpen(true);
                }}
                className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                  !isDraw ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                {labels.mermaid}
              </button>
            </div>
          )}
          {!isDraw && !disabled && (
            <>
              <button
                type="button"
                onClick={() => setDiagramSourceOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 hover:border-orange-300"
              >
                {diagramSourceOpen ? (
                  <>
                    <Eye className="h-3 w-3" /> {labels.preview}
                  </>
                ) : (
                  <>
                    <Pencil className="h-3 w-3" /> {labels.editSource}
                  </>
                )}
              </button>
              <span className="text-[10px] text-slate-400">{labels.templates}:</span>
              {DIAGRAM_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    onChange(tpl.source);
                    setDiagramSourceOpen(false);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:border-orange-300 hover:bg-orange-50"
                >
                  {tpl.label}
                </button>
              ))}
            </>
          )}
        </div>
        {isDraw ? (
          <div className={styleWrap || undefined}>
            <StudioDrawingEditor
              value={block.text}
              onChange={onChange}
              disabled={disabled}
              previewMaxHeight={200}
              labels={{
                expand: labels.expandDraw,
                collapse: labels.collapseDraw,
                hint: labels.drawHint,
                edit: labels.edit,
                preview: labels.preview,
              }}
            />
          </div>
        ) : (
          <div className={styleWrap || undefined}>
            {diagramSourceOpen && !disabled && (
              <textarea
                value={block.text}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                rows={8}
                className="mb-3 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 outline-none focus:border-orange-400"
              />
            )}
            <StudioMermaidPreview source={block.text} />
          </div>
        )}
      </div>
    );
  }

  const mdVariant =
    block.kind === 'heading'
      ? 'heading'
      : block.kind === 'bullets'
        ? 'bullets'
        : block.kind === 'callout'
          ? 'callout'
          : 'body';

  return (
    <div
      ref={rootRef}
      className={`group relative w-full ${
        writeMode ? '' : 'rounded-lg transition'
      } ${aiSelected && !writeMode ? 'ring-2 ring-orange-400 ring-offset-2 bg-orange-50/40' : ''}`}
    >
      {aiSelected && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-orange-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          <Sparkles className="h-3 w-3" /> {labels.selectedForAi}
        </div>
      )}
      {chrome}
      {writeMode && pageId && !isDiagram && !isImage && !isTable ? (
        <div className={`${styleWrap || ''} ${scaleCls}`}>
          <StudioRichTextEditor
            blockId={block.id}
            pageId={pageId}
            text={block.text}
            kind={block.kind}
            disabled={disabled}
            placeholder={labels.empty}
            onChange={onChange}
            onInsertAfter={onInsertAfter}
            onBackspaceEmpty={onBackspaceEmpty}
            onMergeWithPrev={onMergeWithPrev}
            onFocusNext={onFocusNext}
            onFocusPrev={onFocusPrev}
            className={`studio-rich-editor min-h-[1.5em] w-full outline-none ${
              expandHeight ? 'studio-rich-editor-expand' : ''
            } ${
              block.kind === 'heading'
                ? 'font-bold leading-snug tracking-tight text-slate-900 [font-family:var(--font-etholys-display),ui-sans-serif,system-ui,sans-serif] [&_h1]:text-inherit [&_h2]:text-inherit [&_h3]:text-inherit'
                : 'leading-[1.75] text-slate-800'
            }`}
          />
        </div>
      ) : editing && !disabled ? (
        <div
          className={
            writeMode
              ? `${styleWrap || ''}`
              : `rounded-lg ring-2 ring-orange-200/80 ring-offset-2 ${styleWrap || ''}`
          }
        >
          {toolbar}
          <textarea
            ref={taRef}
            value={block.text}
            onChange={(e) => {
              onChange(e.target.value);
              const el = e.target;
              el.style.height = '0px';
              el.style.height = `${Math.max(el.scrollHeight, writeMode ? 48 : 72)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && !writeMode) {
                e.preventDefault();
                setEditing(false);
              }
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
                e.preventDefault();
                applyWrap('**', '**');
              }
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
                e.preventDefault();
                applyWrap('*', '*');
              }
              if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'u') {
                e.preventDefault();
                applyWrap('<u>', '</u>');
              }
            }}
            disabled={disabled}
            placeholder={labels.empty}
            className={`w-full resize-none overflow-hidden border-0 bg-transparent p-0.5 outline-none focus:ring-0 ${
              block.kind === 'heading'
                ? `${scaleCls} font-bold leading-snug tracking-tight text-slate-900 [font-family:var(--font-etholys-display),ui-sans-serif,system-ui,sans-serif]`
                : `${scaleCls} leading-[1.75] text-slate-800`
            }`}
          />
          {!writeMode ? (
            <p className="mt-1.5 text-[10px] text-slate-400">
              Esc · {labels.preview} · Ctrl+B / I / U
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            if (onToggleAiSelect && (e.shiftKey || e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onToggleAiSelect();
              return;
            }
            if (!disabled) setEditing(true);
          }}
          className={`w-full rounded-md text-left outline-none transition hover:bg-orange-50/40 focus-visible:ring-2 focus-visible:ring-orange-300 ${
            disabled ? 'cursor-default' : 'cursor-text'
          } ${styleWrap}`}
        >
          <div className={scaleCls}>
            <StudioMarkdown text={block.text} variant={mdVariant} emptyHint={labels.empty} />
          </div>
        </button>
      )}
    </div>
  );
}
