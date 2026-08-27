'use client';

import type { AtCaseKind } from '@/lib/nexus-at-shared';
import { AT_CASE_KIND_LABELS } from '@/lib/nexus-at-shared';
import {
  getEconomicSector,
  sectorLabel,
  type EconomicSectorGroupId,
} from '@/lib/nexus-economic-sectors';

type Locale = 'es' | 'pt' | 'en';

type Props = {
  sectorId: string | null | undefined;
  locale: Locale;
  /** Pré-selecionar tipo de caso sugerido */
  onSuggestCaseKind?: (kind: AtCaseKind) => void;
  /** Prefill brief a partir de área de foco */
  onSuggestFocusArea?: (focusIndex: number, kind: AtCaseKind) => void;
  compact?: boolean;
};

export function NexusAtSectorPlaybook({
  sectorId,
  locale,
  onSuggestCaseKind,
  onSuggestFocusArea,
  compact,
}: Props) {
  const sector = getEconomicSector(sectorId);
  if (!sector) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-500">
        {locale === 'es'
          ? 'Define el sector económico para ver el marco de consultoría AT.'
          : locale === 'pt'
            ? 'Define o setor económico para ver o quadro de consultoria AT.'
            : 'Set the economic sector to see the AT consulting framework.'}
      </div>
    );
  }

  const L = (row: { es: string; pt: string; en: string }) => row[locale] || row.es;

  return (
    <div className={`rounded-xl border border-slate-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {locale === 'es' ? 'Marco AT por sector' : locale === 'pt' ? 'Quadro AT por setor' : 'Sector AT framework'}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{L(sector.label)}</p>
      <ul className="mt-3 space-y-2">
        {sector.focusAreas.map((area, i) => (
          <li key={i}>
            {onSuggestFocusArea ? (
              <button
                type="button"
                onClick={() =>
                  onSuggestFocusArea(
                    i,
                    sector.suggestedCaseKinds[0] || 'visit'
                  )
                }
                className="flex w-full gap-2 rounded-md px-1 py-0.5 text-left text-xs leading-relaxed text-slate-600 hover:bg-teal-50 hover:text-teal-900"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                {L(area)}
              </button>
            ) : (
              <span className="flex gap-2 text-xs leading-relaxed text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                {L(area)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {onSuggestCaseKind && sector.suggestedCaseKinds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-slate-100 pt-3">
          <span className="w-full text-[10px] font-medium uppercase text-slate-400">
            {locale === 'es' ? 'Intervenciones típicas' : locale === 'pt' ? 'Intervenções típicas' : 'Typical interventions'}
          </span>
          {sector.suggestedCaseKinds.map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() => onSuggestCaseKind(kind)}
              className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-teal-50 hover:text-teal-900"
            >
              {AT_CASE_KIND_LABELS[kind][locale === 'es' ? 'es' : locale === 'pt' ? 'pt' : 'es']}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function sectorBadgeLabel(sectorId: string | null | undefined, locale: Locale): string | null {
  return sectorLabel(sectorId, locale);
}

export function groupSectorsForSelect(
  sectors: Array<{ id: string; groupId: EconomicSectorGroupId; label: { es: string; pt: string; en: string } }>,
  groups: Array<{ id: EconomicSectorGroupId; label: { es: string; pt: string; en: string } }>,
  locale: Locale
) {
  const L = (row: { es: string; pt: string; en: string }) => row[locale] || row.es;
  return groups.map((g) => ({
    groupId: g.id,
    groupLabel: L(g.label),
    sectors: sectors.filter((s) => s.groupId === g.id).map((s) => ({ id: s.id, label: L(s.label) })),
  }));
}
