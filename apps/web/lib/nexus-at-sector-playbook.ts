/**
 * Playbook AT por setor — templates de brief, checklists e ligação ao diagnóstico NEXUS.
 * Funções puras (client-safe).
 */

import type { AtCaseKind } from './nexus-at-shared';
import { AT_CASE_KIND_LABELS } from './nexus-at-shared';
import type { DiagnosticResult } from './nexus-diagnostic-quiz';
import { getEconomicSector, sectorLabel, type EconomicSector } from './nexus-economic-sectors';

export type AtPlaybookLocale = 'es' | 'pt' | 'en';

const L = (row: { es: string; pt: string; en: string }, locale: AtPlaybookLocale) =>
  row[locale] || row.es;

const CASE_INTRO: Record<AtCaseKind, { es: string; pt: string; en: string }> = {
  visit: {
    es: 'Visita de campo / asistencia técnica presencial',
    pt: 'Visita de campo / assistência técnica presencial',
    en: 'On-site field visit / technical assistance',
  },
  diagnosis: {
    es: 'Diagnóstico empresarial e levantamiento inicial',
    pt: 'Diagnóstico empresarial e levantamento inicial',
    en: 'Business diagnosis and initial assessment',
  },
  followup: {
    es: 'Seguimiento de recomendaciones acordadas',
    pt: 'Acompanhamento das recomendações acordadas',
    en: 'Follow-up on agreed recommendations',
  },
  call: {
    es: 'Sesión remota / llamada de consultoría',
    pt: 'Sessão remota / chamada de consultoria',
    en: 'Remote session / consultancy call',
  },
  other: {
    es: 'Intervención AT / consultoría',
    pt: 'Intervenção AT / consultoria',
    en: 'TA intervention / consultancy',
  },
};

const DELIVERABLE: Record<AtCaseKind, { es: string; pt: string; en: string }> = {
  visit: {
    es: 'Entregável: resumen de situación, hallazgos en sitio, 3 recomendaciones y próximo paso.',
    pt: 'Entregável: resumo da situação, achados no local, 3 recomendações e próximo passo.',
    en: 'Deliverable: situation summary, on-site findings, 3 recommendations and next step.',
  },
  diagnosis: {
    es: 'Entregável: mapa de brechas, prioridades de intervención y plan de 30 días.',
    pt: 'Entregável: mapa de lacunas, prioridades de intervenção e plano de 30 dias.',
    en: 'Deliverable: gap map, intervention priorities and 30-day plan.',
  },
  followup: {
    es: 'Entregável: estado vs. plan, bloqueos y acciones pendientes.',
    pt: 'Entregável: estado vs. plano, bloqueios e ações pendentes.',
    en: 'Deliverable: status vs. plan, blockers and pending actions.',
  },
  call: {
    es: 'Entregável: acuerdos de la llamada y tareas asignadas.',
    pt: 'Entregável: acordos da chamada e tarefas atribuídas.',
    en: 'Deliverable: call agreements and assigned tasks.',
  },
  other: {
    es: 'Entregável: conclusões e próximos passos registados.',
    pt: 'Entregável: conclusões e próximos passos registados.',
    en: 'Deliverable: recorded conclusions and next steps.',
  },
};

const CHECKLIST_VERB: Record<AtCaseKind, { es: string; pt: string; en: string }> = {
  visit: { es: 'Observar en sitio', pt: 'Observar no local', en: 'Observe on site' },
  diagnosis: { es: 'Evaluar', pt: 'Avaliar', en: 'Assess' },
  followup: { es: 'Confirmar avance en', pt: 'Confirmar avanço em', en: 'Confirm progress on' },
  call: { es: 'Abordar por llamada', pt: 'Abordar por chamada', en: 'Discuss on call' },
  other: { es: 'Documentar', pt: 'Documentar', en: 'Document' },
};

export type BuildAtBriefOptions = {
  focusAreaIndex?: number;
  companyName?: string;
  diagnosticHints?: string[];
};

export function buildSectorCaseChecklist(
  sectorId: string | null | undefined,
  caseKind: AtCaseKind,
  locale: AtPlaybookLocale = 'es'
): string[] {
  const sector = getEconomicSector(sectorId);
  const verb = L(CHECKLIST_VERB[caseKind], locale);
  if (!sector) {
    return [
      `${verb}: ${locale === 'es' ? 'contexto del negocio' : locale === 'pt' ? 'contexto do negócio' : 'business context'}`,
      `${verb}: ${locale === 'es' ? 'finanzas básicas' : locale === 'pt' ? 'finanças básicas' : 'basic finance'}`,
    ];
  }
  const items = sector.focusAreas.map((area) => `${verb}: ${L(area, locale)}`);
  const kindLabel = AT_CASE_KIND_LABELS[caseKind][locale] || AT_CASE_KIND_LABELS[caseKind].es;
  items.push(
    locale === 'es'
      ? `Registrar conclusiones del caso (${kindLabel})`
      : locale === 'pt'
        ? `Registar conclusões do caso (${kindLabel})`
        : `Record case conclusions (${kindLabel})`
  );
  return items;
}

export function buildAtBriefTemplate(
  sectorId: string | null | undefined,
  caseKind: AtCaseKind,
  locale: AtPlaybookLocale = 'es',
  opts: BuildAtBriefOptions = {}
): string {
  const sector = getEconomicSector(sectorId);
  const intro = L(CASE_INTRO[caseKind], locale);
  const sectorName = sector ? L(sector.label, locale) : sectorLabel('other', locale) || '—';
  const companyLine = opts.companyName
    ? locale === 'es'
      ? `Empresa: ${opts.companyName}`
      : locale === 'pt'
        ? `Empresa: ${opts.companyName}`
        : `Company: ${opts.companyName}`
    : null;

  const focusLines =
    sector && typeof opts.focusAreaIndex === 'number'
      ? [L(sector.focusAreas[opts.focusAreaIndex]!, locale)]
      : sector?.focusAreas.map((a) => `- ${L(a, locale)}`) || [];

  const diagnosticBlock =
    opts.diagnosticHints && opts.diagnosticHints.length > 0
      ? [
          locale === 'es'
            ? '### Contexto diagnóstico NEXUS'
            : locale === 'pt'
              ? '### Contexto diagnóstico NEXUS'
              : '### NEXUS diagnostic context',
          ...opts.diagnosticHints.map((h) => `- ${h}`),
        ]
      : [];

  const observeHeader =
    locale === 'es'
      ? '### Puntos a abordar'
      : locale === 'pt'
        ? '### Pontos a abordar'
        : '### Points to address';

  const lines = [
    `## ${intro}`,
    locale === 'es' ? `Sector económico: ${sectorName}` : locale === 'pt' ? `Setor económico: ${sectorName}` : `Economic sector: ${sectorName}`,
    ...(companyLine ? [companyLine] : []),
    '',
    observeHeader,
    ...focusLines,
    ...diagnosticBlock,
    '',
    L(DELIVERABLE[caseKind], locale),
  ];

  return lines.join('\n').trim();
}

export function buildDiagnosisAtBrief(
  result: Pick<DiagnosticResult, 'overall' | 'weakestSectors' | 'weakestAreas'>,
  locale: AtPlaybookLocale = 'es',
  companyName?: string
): string {
  const hints: string[] = [
    locale === 'es'
      ? `Score global: ${result.overall}/100`
      : locale === 'pt'
        ? `Score global: ${result.overall}/100`
        : `Overall score: ${result.overall}/100`,
  ];
  for (const s of result.weakestSectors.slice(0, 3)) {
    hints.push(
      locale === 'es'
        ? `Pilar débil: ${s.sectorName} (${s.score})`
        : locale === 'pt'
          ? `Pilar fraco: ${s.sectorName} (${s.score})`
          : `Weak pillar: ${s.sectorName} (${s.score})`
    );
  }
  for (const a of result.weakestAreas.slice(0, 4)) {
    hints.push(
      locale === 'es'
        ? `Área prioritaria: ${a.areaName} (${a.score})`
        : locale === 'pt'
          ? `Área prioritária: ${a.areaName} (${a.score})`
          : `Priority area: ${a.areaName} (${a.score})`
    );
  }
  return buildAtBriefTemplate('other', 'diagnosis', locale, {
    companyName,
    diagnosticHints: hints,
  });
}

export function sectorProgramSummary(
  sectorId: string | null | undefined,
  locale: AtPlaybookLocale = 'es'
): { title: string; focusAreas: string[] } | null {
  const sector = getEconomicSector(sectorId);
  if (!sector) return null;
  return {
    title: L(sector.label, locale),
    focusAreas: sector.focusAreas.map((a) => L(a, locale)),
  };
}

export const AT_CASE_DRAFT_KEY = 'nexus-at-case-draft-v1';

export type AtCaseDraft = {
  companyId: string;
  caseKind: AtCaseKind;
  brief: string;
  checklistItems?: string[];
  source: 'diagnosis' | 'playbook';
};

export function saveAtCaseDraft(draft: AtCaseDraft): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(AT_CASE_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota */
  }
}

export function loadAtCaseDraft(companyId?: string | null): AtCaseDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(AT_CASE_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as AtCaseDraft;
    if (!d?.brief || !d.caseKind) return null;
    if (companyId && d.companyId !== companyId) return null;
    return d;
  } catch {
    return null;
  }
}

export function clearAtCaseDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(AT_CASE_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function pickSuggestedCaseKind(sector: EconomicSector | null): AtCaseKind {
  return sector?.suggestedCaseKinds[0] || 'diagnosis';
}
