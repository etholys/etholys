'use client';

import type { StudioCopilotAction } from '@/lib/studio/copilot-modes';
import { actionLabel } from '@/lib/studio/copilot-modes';
import type { CanvasPatchSummary } from '@/lib/studio/canvas-patch-preview';
import { formatPageRange } from '@/lib/studio/canvas-patch-preview';
import { Check, Layers, Pencil, Play, X } from 'lucide-react';

type Props = {
  locale: string;
  actions: StudioCopilotAction[];
  disabled?: boolean;
  onAction: (action: StudioCopilotAction) => void;
  structurePreview?: {
    apply: CanvasPatchSummary;
    migrate?: CanvasPatchSummary;
  } | null;
};

const ICONS: Record<StudioCopilotAction, typeof Check> = {
  approve_structure: Check,
  apply_structure: Play,
  migrate_structure: Layers,
  adjust_plan: Pencil,
  cancel_plan: X,
};

const STYLES: Record<StudioCopilotAction, string> = {
  approve_structure: 'bg-emerald-700 hover:bg-emerald-600 text-white',
  apply_structure: 'bg-orange-600 hover:bg-orange-500 text-white',
  migrate_structure: 'bg-amber-700 hover:bg-amber-600 text-white',
  adjust_plan: 'border border-stone-300 bg-white text-stone-800 hover:bg-stone-50',
  cancel_plan: 'border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100',
};

function previewLine(
  summary: CanvasPatchSummary,
  locale: string,
  kind: 'apply' | 'migrate',
): string {
  const loc = locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt';
  const pages = formatPageRange(summary.pageNumbers, loc);
  const blocks = summary.blockIds.length;
  const sections = summary.sectionCount;
  if (loc === 'es') {
    const base = `${sections} sección${sections === 1 ? '' : 'es'} · ${blocks} bloque${blocks === 1 ? '' : 's'}`;
    const pg = pages ? ` · pág. ${pages}` : '';
    return kind === 'migrate' ? `${base}${pg} · migra contenido existente` : `${base}${pg}`;
  }
  if (loc === 'en') {
    const base = `${sections} section${sections === 1 ? '' : 's'} · ${blocks} block${blocks === 1 ? '' : 's'}`;
    const pg = pages ? ` · p. ${pages}` : '';
    return kind === 'migrate' ? `${base}${pg} · migrates existing content` : `${base}${pg}`;
  }
  const base = `${sections} secção${sections === 1 ? '' : 'ões'} · ${blocks} bloco${blocks === 1 ? '' : 's'}`;
  const pg = pages ? ` · pág. ${pages}` : '';
  return kind === 'migrate' ? `${base}${pg} · migra conteúdo existente` : `${base}${pg}`;
}

export function StudioStructureActionBar({
  locale,
  actions,
  disabled,
  onAction,
  structurePreview,
}: Props) {
  if (!actions.length) return null;
  const loc = locale === 'en' || locale === 'es' ? locale : 'pt';

  const showApplyPreview =
    structurePreview?.apply &&
    actions.includes('apply_structure') &&
    structurePreview.apply.blockIds.length > 0;
  const showMigratePreview =
    structurePreview?.migrate &&
    actions.includes('migrate_structure') &&
    structurePreview.migrate.blockIds.length > 0;

  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-b from-orange-50 to-amber-50 px-3 py-3 text-sm text-stone-900 shadow-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-orange-900">
        {loc === 'es'
          ? 'Plan de estructura pendiente'
          : loc === 'en'
            ? 'Pending structure plan'
            : 'Plano de estrutura pendente'}
      </p>
      {(showApplyPreview || showMigratePreview) && (
        <div className="mb-2 space-y-1 rounded-lg border border-orange-100 bg-white/80 px-2.5 py-2 text-xs text-stone-700">
          <p className="font-semibold text-orange-900">
            {loc === 'es'
              ? 'Vista previa antes de aplicar'
              : loc === 'en'
                ? 'Preview before apply'
                : 'Pré-visualização antes de aplicar'}
          </p>
          {showApplyPreview && (
            <p>
              <span className="font-medium text-orange-800">
                {loc === 'es' ? 'Aplicar:' : loc === 'en' ? 'Apply:' : 'Aplicar:'}
              </span>{' '}
              {previewLine(structurePreview!.apply, loc, 'apply')}
            </p>
          )}
          {showMigratePreview && structurePreview?.migrate && (
            <p>
              <span className="font-medium text-amber-900">
                {loc === 'es' ? 'Migrar:' : loc === 'en' ? 'Migrate:' : 'Migrar:'}
              </span>{' '}
              {previewLine(structurePreview.migrate, loc, 'migrate')}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = ICONS[action];
          return (
            <button
              key={action}
              type="button"
              disabled={disabled}
              onClick={() => onAction(action)}
              className={`inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold disabled:opacity-40 ${STYLES[action]}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {actionLabel(action, loc)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
