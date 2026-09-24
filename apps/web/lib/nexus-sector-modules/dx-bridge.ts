/**
 * Ponte diagnóstico → módulo: cada lacuna vira ação no caderno / monitor, não «intervenção AT».
 */

import type { DiagnosticAreaRow, DxLocale } from '../nexus-sector-diagnostic';
import type { ModuleHref, ModulePlanSeed, SectorModule } from './types';
import { L } from './types';

export type LinkedModuleAction = {
  seedId: string;
  title: string;
  description: string;
  pillar: string;
  priority: ModulePlanSeed['priority'];
  kind: ModulePlanSeed['kind'];
  estimatedHours: number;
  href: ModuleHref;
  protocolId?: string;
  questionId?: string;
};

const DEFAULT_HREF: Record<ModulePlanSeed['kind'], ModuleHref> = {
  ops_unit: 'campo',
  field_book: 'campo',
  protocol: 'campo',
  sensor: 'monitor',
};

function seedHref(seed: ModulePlanSeed): ModuleHref {
  return seed.href || DEFAULT_HREF[seed.kind];
}

export function moduleActionHref(
  href: ModuleHref,
  opts?: { companyId?: string | null; engagementId?: string | null }
): string {
  const p = new URLSearchParams();
  if (opts?.companyId) p.set('company', opts.companyId);
  if (opts?.engagementId) p.set('engagement', opts.engagementId);
  const q = p.toString();
  return q ? `/hub/nexus/${href}?${q}` : `/hub/nexus/${href}`;
}

export function findSeedForQuestion(mod: SectorModule, questionId: string): ModulePlanSeed | null {
  const fromSeed = mod.planSeeds.find((s) => s.dxQuestionIds?.includes(questionId));
  if (fromSeed) return fromSeed;
  const proto = mod.protocols.find((p) => p.dxQuestionIds?.includes(questionId));
  if (!proto) return null;
  return (
    mod.planSeeds.find((s) => s.protocolId === proto.id) ||
    mod.planSeeds.find((s) => s.kind === 'protocol' || s.kind === 'field_book') ||
    null
  );
}

export function actionFromSeed(
  seed: ModulePlanSeed,
  locale: DxLocale,
  extras?: { questionId?: string; weaknessLabel?: string; score?: number }
): LinkedModuleAction {
  const scoreNote =
    extras?.score != null
      ? locale === 'es'
        ? ` Diagnóstico: ${extras.weaknessLabel || ''} (score ${extras.score}).`
        : locale === 'pt'
          ? ` Diagnóstico: ${extras.weaknessLabel || ''} (score ${extras.score}).`
          : ` Diagnosis: ${extras.weaknessLabel || ''} (score ${extras.score}).`
      : '';
  return {
    seedId: extras?.questionId ? `${seed.id}__${extras.questionId}` : seed.id,
    title: L(seed.title, locale),
    description: `${L(seed.description, locale)}${scoreNote}`.trim(),
    pillar: seed.pillar,
    priority: extras?.score != null && extras.score < 40 ? 'critical' : seed.priority,
    kind: seed.kind,
    estimatedHours: seed.estimatedHours,
    href: seedHref(seed),
    protocolId: seed.protocolId,
    questionId: extras?.questionId,
  };
}

/** Unidade + caderno primeiro; depois uma ação por lacuna ligada; depois seeds que faltam. */
export function linkDiagnosticToModule(
  mod: SectorModule,
  weaknesses: DiagnosticAreaRow[],
  locale: DxLocale,
  budget: number
): LinkedModuleAction[] {
  const out: LinkedModuleAction[] = [];
  const usedSeed = new Set<string>();

  const unitSeed = mod.planSeeds.find((s) => s.kind === 'ops_unit');
  const bookSeed = mod.planSeeds.find((s) => s.kind === 'field_book');
  if (unitSeed) {
    out.push(actionFromSeed(unitSeed, locale));
    usedSeed.add(unitSeed.id);
  }
  if (bookSeed && out.length < budget) {
    out.push(actionFromSeed(bookSeed, locale));
    usedSeed.add(bookSeed.id);
  }

  for (const w of weaknesses) {
    if (out.length >= budget) break;
    const seed = findSeedForQuestion(mod, w.questionId);
    if (!seed) continue;
    if (usedSeed.has(seed.id)) {
      const existing = out.find((a) => a.seedId === seed.id);
      if (existing && !existing.questionId) {
        const annotated = actionFromSeed(seed, locale, {
          questionId: w.questionId,
          weaknessLabel: w.label,
          score: w.score,
        });
        existing.questionId = w.questionId;
        existing.description = annotated.description;
        if (w.score < 40) existing.priority = 'critical';
      }
      continue;
    }
    out.push(
      actionFromSeed(seed, locale, {
        questionId: w.questionId,
        weaknessLabel: w.label,
        score: w.score,
      })
    );
    usedSeed.add(seed.id);
  }

  for (const seed of mod.planSeeds) {
    if (out.length >= budget) break;
    if (usedSeed.has(seed.id)) continue;
    out.push(actionFromSeed(seed, locale));
    usedSeed.add(seed.id);
  }

  return out.slice(0, budget);
}
