/**
 * Prompts para re-análise parcial (uma secção) no Smart Import SIEP.
 */

import {
  normalizeMilestonesPartial,
  type ImportActivityRow,
} from '@/lib/siep/import-activities';

export type ImportSectionKey =
  | 'project'
  | 'sow'
  | 'objectives'
  | 'diagnostics'
  | 'budgetLines'
  | 'risks'
  | 'milestones';

export const IMPORT_SECTION_LABELS: Record<ImportSectionKey, string> = {
  project: 'Dados do projeto',
  sow: 'SOW / Statement of Work',
  objectives: 'Marco lógico',
  diagnostics: 'Diagnósticos',
  budgetLines: 'Presupuesto / orçamento',
  risks: 'Riesgos',
  milestones: 'Hitos y actividades',
};

const BASE_RULES = `REGRA FUNDAMENTAL: COPIE TEXTUALMENTE o texto do documento. Não parafraseie, não resuma, não traduza.
Responda APENAS JSON válido (sem markdown).`;

export function buildSectionPrompt(
  section: ImportSectionKey,
  contextJson?: string,
): string {
  const ctx = contextJson
    ? `\n\nDADOS ATUAIS (para referência — substitua pela extração correta do novo ficheiro):\n${contextJson.slice(0, 8000)}`
    : '';

  const prompts: Record<ImportSectionKey, string> = {
    project: `${BASE_RULES}
Extraia SOMENTE os metadados do projeto do documento/imagem.
JSON: { "project": { "name", "description", "goal", "donorName", "country", "region", "currency", "budget", "startDate", "endDate" }, "confidence": "high|medium|low" }`,

    sow: `${BASE_RULES}
Extraia SOMENTE secciones SOW.
JSON: { "sow": [{ "sectionKey": "background|objectives|methodology|deliverables|scope|target|partners|assumptions", "title", "items": [], "content": "" }], "confidence": "high|medium|low" }`,

    objectives: `${BASE_RULES}
Extraia SOMENTE o marco lógico com hierarquia ANINHADA (children), NÃO lista plana.

CADEIA OBRIGATÓRIA: goal/impact → outcomes (R) → objectives/OE → outputs/OP → activities/A → indicators
- Cada outcome em children[] do goal; cada OE em children[] do outcome; cada OP em children[] do OE; etc.
- Códigos alinhados quando existirem (R1, OE1, P1.1, A1.1a).
- indicators[] dentro do nó onde se aplicam; preferir actividade como pai do indicador.

JSON: { "objectives": [...], "confidence": "high|medium|low" }`,

    diagnostics: `${BASE_RULES}
Extraia SOMENTE problem_statement, need, assumption, external_factor.
JSON: { "diagnostics": [{ "type", "code", "title", "description" }], "confidence": "high|medium|low" }`,

    budgetLines: `${BASE_RULES}
Extraia SOMENTE linhas de presupuesto / budget / planilha financeira.

CRÍTICO para descrições:
- Cada rubro, nombre de gasto, cargo, consultor ou ítem debe copiarse EXACTAMENTE como en la celda o texto original.
- NO inventar abreviaturas ni renombrar personas/equipos.
- Si es Excel: una fila = una budgetLine (salvo filas de encabezado/total).
- unitCost = costo cargado al proyecto; total = quantity * unitCost.

JSON: {
  "budgetLines": [{
    "category": "personnel|fringe|travel|equipment|supplies|contractual|other_direct|indirect",
    "description": "texto exacto del ítem",
    "unit": "month|unit|trip|...",
    "quantity": 1,
    "unitCost": 0,
    "total": 0,
    "narrative": "justificación si existe",
    "fundSource": "federal|cost_share"
  }],
  "confidence": "high|medium|low"
}`,

    risks: `${BASE_RULES}
Extraia SOMENTE matriz de riesgos.
JSON: { "risks": [{ "title", "description", "level": "LOW|MEDIUM|HIGH|CRITICAL", "impact", "mitigation" }], "confidence": "high|medium|low" }`,

    milestones: `${BASE_RULES}
Extraia SOMENTE cronograma / timeline / work plan / Activity Timeline del proyecto.

Si el archivo es Excel (.xlsx) con hojas "Timeline", "Cronograma", "Activities", "Work Plan" o similar:
- Cada FILA de actividad (con fechas inicio/fin) → un objeto en "activities[]".
- Copie textualmente el título/descripción de la actividad.
- Rellene code si existe (A1.1, Act 1, etc.), startDate y endDate en YYYY-MM-DD.
- Los hitos clave (milestones) van en "milestones[]" con name + dueDate.

NO devuelva arrays vacíos si el documento contiene filas de actividades.
JSON OBLIGATORIO:
{
  "activities": [{ "code": "A1.1", "title": "texto exacto", "startDate": "YYYY-MM-DD|null", "endDate": "YYYY-MM-DD|null", "description": "opcional" }],
  "milestones": [{ "name": "texto exacto", "description": null, "dueDate": "YYYY-MM-DD|null" }],
  "confidence": "high|medium|low"
}`,
  };

  return `${prompts[section]}${ctx}`;
}

/** Mapeia tab da UI de preview → chave de secção na API */
export const PREVIEW_TAB_TO_SECTION: Record<string, ImportSectionKey> = {
  project: 'project',
  sow: 'sow',
  objectives: 'objectives',
  diagnostics: 'diagnostics',
  budget: 'budgetLines',
  risks: 'risks',
  activities: 'milestones',
};

export function mergeSectionIntoExtracted(
  extracted: Record<string, unknown>,
  section: ImportSectionKey,
  partial: Record<string, unknown>,
  mode: 'replace' | 'append',
): Record<string, unknown> {
  const next = { ...extracted };
  const conf = { ...(next.confidence as Record<string, string> || {}) };

  if (partial.confidence && typeof partial.confidence === 'string') {
    const confKey = section === 'budgetLines' ? 'budgetLines' : section === 'milestones' ? 'milestones' : section;
    conf[confKey] = partial.confidence;
    if (section === 'budgetLines') conf.budget = partial.confidence;
  }

  if (section === 'project' && partial.project) {
    next.project = partial.project;
  } else if (section === 'sow' && Array.isArray(partial.sow)) {
    next.sow = mode === 'append' ? [...(next.sow as unknown[] || []), ...partial.sow] : partial.sow;
  } else if (section === 'objectives' && Array.isArray(partial.objectives)) {
    next.objectives = mode === 'append' ? [...(next.objectives as unknown[] || []), ...partial.objectives] : partial.objectives;
  } else if (section === 'diagnostics' && Array.isArray(partial.diagnostics)) {
    next.diagnostics = mode === 'append' ? [...(next.diagnostics as unknown[] || []), ...partial.diagnostics] : partial.diagnostics;
  } else if (section === 'budgetLines' && Array.isArray(partial.budgetLines)) {
    next.budgetLines = mode === 'append' ? [...(next.budgetLines as unknown[] || []), ...partial.budgetLines] : partial.budgetLines;
  } else if (section === 'risks' && Array.isArray(partial.risks)) {
    next.risks = mode === 'append' ? [...(next.risks as unknown[] || []), ...partial.risks] : partial.risks;
  } else if (section === 'milestones') {
    const normalized = normalizeMilestonesPartial(partial);
    const hasActivities = normalized.activities.length > 0;
    const hasMilestones = normalized.milestones.length > 0;

    if (hasMilestones) {
      next.milestones =
        mode === 'append'
          ? [...((next.milestones as unknown[]) || []), ...normalized.milestones]
          : normalized.milestones;
    } else if (mode === 'replace' && Array.isArray(partial.milestones) && partial.milestones.length === 0) {
      /* IA devolveu vazio — não apagar hitos existentes */
    }

    if (hasActivities) {
      next.activities =
        mode === 'append'
          ? [...((next.activities as ImportActivityRow[]) || []), ...normalized.activities]
          : normalized.activities;
    } else if (mode === 'replace' && Array.isArray(partial.activities) && partial.activities.length === 0) {
      /* não limpar — actividades podem vir só do marco lógico */
    }
  }

  next.confidence = conf;
  return next;
}
