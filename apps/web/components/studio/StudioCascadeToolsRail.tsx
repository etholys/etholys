'use client';

import { useEffect, useMemo } from 'react';
import {
  Bold,
  FileText,
  Layers,
  LayoutGrid,
  PenLine,
  PlusSquare,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import type {
  StudioBlockKind,
  StudioBlockStyle,
  StudioPage,
  StudioPageMarginsMm,
  StudioPageOrientation,
  StudioPageSize,
  StudioHeaderFooter,
  StudioStudioMode,
} from '@/lib/studio/types';
import { StudioToolsPanelBody, type StudioToolsPanelLabels } from '@/components/studio/StudioToolsPanelBody';
import { StudioWriteRibbon } from '@/components/studio/StudioWriteRibbon';
import type { PageSelectionState } from '@/lib/studio/selection-scope';

export type CascadeSection = 'format' | 'insert' | 'page' | 'elements' | 'visual';

type WriteRibbonLabels = {
  format: string;
  bold: string;
  italic: string;
  underline: string;
  heading: string;
  body: string;
  list: string;
  orderedList: string;
  link: string;
  hint: string;
  more: string;
};

type Props = {
  mode: StudioStudioMode;
  onModeChange: (mode: StudioStudioMode) => void;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  section: CascadeSection;
  onSectionChange: (section: CascadeSection) => void;
  pageSize: StudioPageSize;
  orientation: StudioPageOrientation;
  margins: StudioPageMarginsMm;
  disabled?: boolean;
  pageCount: number;
  panelLabels: StudioToolsPanelLabels;
  ribbonLabels: WriteRibbonLabels;
  onPageSize: (size: StudioPageSize) => void;
  onOrientation: (o: StudioPageOrientation) => void;
  onMargins: (m: StudioPageMarginsMm) => void;
  onInsert: (kind: StudioBlockKind | 'image') => void;
  onOpenMolds?: () => void;
  onAddPage?: () => void;
  headerFooter?: StudioHeaderFooter;
  onHeaderFooter?: (hf: StudioHeaderFooter) => void;
  pageBackgroundColor?: string | null;
  onPageBackgroundColor?: (color: string | null) => void;
  onWrap: (before: string, after: string) => void;
  onCommand?: (cmd: 'orderedList' | 'link') => void;
  onKind: (kind: StudioBlockKind) => void;
  onStyle: (partial: StudioBlockStyle) => void;
  sectionTitles: Record<CascadeSection, string>;
  branchLabels: { write: string; design: string };
  pages: StudioPage[];
  activePageId: string | null;
  locale: string;
  onSelectPage: (pageId: string) => void;
  pageAiSelection?: Record<string, PageSelectionState>;
  onToggleAiPage?: (pageId: string) => void;
};

const WRITE_SECTIONS: CascadeSection[] = ['format', 'insert', 'page'];
const DESIGN_SECTIONS: CascadeSection[] = ['elements', 'page', 'visual'];

function sectionIcon(section: CascadeSection) {
  if (section === 'format') return Bold;
  if (section === 'insert') return PlusSquare;
  if (section === 'elements') return Layers;
  if (section === 'visual') return Wand2;
  if (section === 'page') return LayoutGrid;
  return FileText;
}

export function StudioCascadeToolsRail({
  mode,
  onModeChange,
  panelOpen,
  onPanelOpenChange,
  section,
  onSectionChange,
  pageSize,
  orientation,
  margins,
  disabled,
  pageCount,
  panelLabels,
  ribbonLabels,
  onPageSize,
  onOrientation,
  onMargins,
  onInsert,
  onOpenMolds,
  onAddPage,
  headerFooter,
  onHeaderFooter,
  pageBackgroundColor,
  onPageBackgroundColor,
  onWrap,
  onCommand,
  onKind,
  onStyle,
  sectionTitles,
  branchLabels,
  pages,
  activePageId,
  locale,
  onSelectPage,
  pageAiSelection,
  onToggleAiPage,
}: Props) {
  const isDesign = mode === 'design';
  const subSections = isDesign ? DESIGN_SECTIONS : WRITE_SECTIONS;

  useEffect(() => {
    if (isDesign && (section === 'format' || section === 'insert')) {
      onSectionChange('elements');
    }
    if (!isDesign && (section === 'elements' || section === 'visual')) {
      onSectionChange('format');
    }
  }, [isDesign, onSectionChange, section]);

  const railBtn = useMemo(
    () =>
      'flex h-8 w-8 items-center justify-center rounded-lg transition disabled:opacity-40',
    [],
  );

  function pickSection(next: CascadeSection) {
    if (section === next && panelOpen) {
      onPanelOpenChange(false);
      return;
    }
    onSectionChange(next);
    onPanelOpenChange(true);
  }

  function pickBranch(next: StudioStudioMode) {
    onModeChange(next);
    if (next === 'write') {
      if (!WRITE_SECTIONS.includes(section)) onSectionChange('format');
    } else if (!DESIGN_SECTIONS.includes(section)) {
      onSectionChange('elements');
    }
    onPanelOpenChange(true);
  }

  const panelBodySection =
    section === 'format' ? null : (section as 'insert' | 'page' | 'elements' | 'visual');

  return (
    <div className="flex h-full shrink-0">
      {panelOpen && (
        <aside
          className={`flex w-[252px] shrink-0 flex-col border-l ${
            isDesign ? 'border-violet-800/60 bg-[#1a1225] text-violet-50' : 'border-stone-200 bg-white'
          }`}
        >
          <div
            className={`flex items-center justify-between border-b px-3 py-2 ${
              isDesign ? 'border-violet-800/50' : 'border-stone-100'
            }`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {sectionTitles[section]}
            </p>
            <button
              type="button"
              onClick={() => onPanelOpenChange(false)}
              className={`rounded-md p-1 ${
                isDesign ? 'text-violet-300 hover:bg-violet-900/50' : 'text-slate-500 hover:bg-slate-100'
              }`}
              title="Close"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {section === 'format' ? (
              <StudioWriteRibbon
                layout="panel"
                disabled={disabled}
                onWrap={onWrap}
                onCommand={onCommand}
                onKind={onKind}
                onStyle={onStyle}
                labels={ribbonLabels}
                trailing={
                  onAddPage ? (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={onAddPage}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-1 text-[10px] font-semibold text-stone-700"
                    >
                      + {panelLabels.newSlide}
                    </button>
                  ) : null
                }
              />
            ) : (
              panelBodySection && (
                <StudioToolsPanelBody
                  mode={mode}
                  section={panelBodySection}
                  pageSize={pageSize}
                  orientation={orientation}
                  margins={margins}
                  disabled={disabled}
                  pageCount={pageCount}
                  labels={panelLabels}
                  onPageSize={onPageSize}
                  onOrientation={onOrientation}
                  onMargins={onMargins}
                  onInsert={onInsert}
                  onOpenMolds={onOpenMolds}
                  onAddPage={onAddPage}
                  headerFooter={headerFooter}
                  onHeaderFooter={onHeaderFooter}
                  pageBackgroundColor={pageBackgroundColor}
                  onPageBackgroundColor={onPageBackgroundColor}
                  pages={pages}
                  activePageId={activePageId}
                  locale={locale}
                  onSelectPage={onSelectPage}
                  pageAiSelection={pageAiSelection}
                  onToggleAiPage={onToggleAiPage}
                />
              )
            )}
          </div>
        </aside>
      )}

      <div
        className={`flex w-10 shrink-0 flex-col items-center gap-1 border-l py-2 ${
          isDesign ? 'border-violet-900/50 bg-[#120c1a]' : 'border-stone-200 bg-[#f7f4ef]'
        }`}
      >
        <button
          type="button"
          title={branchLabels.write}
          onClick={() => pickBranch('write')}
          className={`${railBtn} ${
            !isDesign
              ? 'bg-orange-100 text-orange-800 ring-1 ring-orange-300'
              : 'text-stone-500 hover:bg-stone-200/80'
          }`}
        >
          <PenLine className="h-4 w-4" />
        </button>
        <button
          type="button"
          title={branchLabels.design}
          onClick={() => pickBranch('design')}
          className={`${railBtn} ${
            isDesign
              ? 'bg-violet-700 text-white ring-1 ring-violet-500'
              : 'text-stone-500 hover:bg-stone-200/80'
          }`}
        >
          <Sparkles className="h-4 w-4" />
        </button>

        <div className={`my-0.5 h-px w-6 ${isDesign ? 'bg-violet-800/60' : 'bg-stone-300'}`} />

        {subSections.map((id) => {
          const Icon = sectionIcon(id);
          const active = panelOpen && section === id;
          return (
            <button
              key={id}
              type="button"
              title={sectionTitles[id]}
              onClick={() => pickSection(id)}
              className={`${railBtn} ${
                active
                  ? isDesign
                    ? 'bg-violet-800 text-violet-100 ring-1 ring-violet-600'
                    : 'bg-orange-50 text-orange-900 ring-1 ring-orange-300'
                  : isDesign
                    ? 'text-violet-400 hover:bg-violet-900/40'
                    : 'text-stone-500 hover:bg-stone-200/80'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
