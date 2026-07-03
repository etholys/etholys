/**
 * SIEP — normalizar campos de indicador vindos do Smart Import (várias chaves da IA).
 */

export type IndicatorImportFields = {
  title: string;
  indicator: string | null;
  code: string | null;
  unitOfMeasure: string | null;
  baseline: string | null;
  target: string | null;
  dataSource: string | null;
  reportingFreq: string | null;
  responsibility: string | null;
  indicatorType: string | null;
};

function pickString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v).trim();
    }
  }
  return null;
}

function pickNumericString(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k];
    if (v === undefined || v === null || v === '') continue;
    return String(v).trim();
  }
  return null;
}

/** Extrai metadados M&E de um nó de import (child indicator ou entrada em indicators[]). */
export function extractIndicatorFields(o: Record<string, unknown>): IndicatorImportFields {
  const name =
    pickString(o, ['name', 'indicator', 'title', 'label', 'description']) || 'Indicador';

  return {
    title: name,
    indicator: pickString(o, ['name', 'indicator']) || name,
    code: pickString(o, ['code', 'id_code']),
    unitOfMeasure: pickString(o, [
      'unitOfMeasure',
      'unit_of_measure',
      'unit',
      'uom',
      'unidad',
      'units',
      'measure',
    ]),
    baseline: pickNumericString(o, ['baseline', 'base', 'linea_base', 'linha_base', 'valor_base']),
    target: pickNumericString(o, ['target', 'meta', 'goal', 'end_target', 'expected']),
    dataSource: pickString(o, ['dataSource', 'data_source', 'source', 'fuente']),
    reportingFreq: pickString(o, ['reportingFreq', 'reporting_freq', 'frequency', 'frecuencia']),
    responsibility: pickString(o, ['responsibility', 'responsable', 'responsible']),
    indicatorType: pickString(o, ['indicatorType', 'indicator_type', 'type']),
  };
}

export function hasIndicatorMetadata(o: Record<string, unknown>): boolean {
  const f = extractIndicatorFields(o);
  return Boolean(
    f.unitOfMeasure ||
      f.baseline ||
      f.target ||
      f.dataSource ||
      f.reportingFreq ||
      pickString(o, ['name', 'indicator']),
  );
}

export type ObjectiveImportRow = Record<string, unknown>;

const VALID_TYPES = new Set([
  'objective', 'outcome', 'output', 'activity', 'deliverable', 'goal', 'impact',
  'problem_statement', 'need', 'input', 'assumption', 'external_factor', 'indicator',
]);

export function resolveImportObjectiveType(o: ObjectiveImportRow): string {
  if (o.type && VALID_TYPES.has(String(o.type))) return String(o.type);
  if (hasIndicatorMetadata(o)) return 'indicator';
  return 'objective';
}

/** Payload Prisma para criar um nó do marco lógico a partir da IA. */
export function buildObjectiveImportData(
  projectId: string,
  o: ObjectiveImportRow,
  parentId: string | null,
  order: number,
) {
  const objType = resolveImportObjectiveType(o);
  const ind = extractIndicatorFields(o);
  const isIndicatorNode = objType === 'indicator';
  const trackableOnNode = !isIndicatorNode && Boolean(ind.indicator && (ind.unitOfMeasure || ind.target || ind.baseline));

  return {
    projectId,
    parentId,
    type: objType,
    code: (o.code ? String(o.code) : null) || ind.code,
    title: isIndicatorNode
      ? ind.title
      : String(o.title || o.name || 'Sin título'),
    description: o.description ? String(o.description) : null,
    indicator: isIndicatorNode || trackableOnNode ? ind.indicator : null,
    indicatorType: isIndicatorNode || trackableOnNode ? ind.indicatorType : null,
    unitOfMeasure: isIndicatorNode || trackableOnNode ? ind.unitOfMeasure : null,
    baseline: isIndicatorNode || trackableOnNode ? (ind.baseline ?? '') : null,
    target: isIndicatorNode || trackableOnNode ? (ind.target ?? '') : null,
    dataSource: isIndicatorNode || trackableOnNode ? ind.dataSource : null,
    reportingFreq: isIndicatorNode || trackableOnNode ? ind.reportingFreq : null,
    responsibility: isIndicatorNode || trackableOnNode ? ind.responsibility : null,
    order,
  };
}

export function inferUnitFromTitle(title: string): string | null {
  const t = title.toLowerCase();
  if (t.includes('percentage') || t.includes('percent') || t.includes('%')) return '%';
  if (t.includes('person-hour') || t.includes('person hour')) return 'person-hours';
  if (t.startsWith('number of') || t.includes('count of')) return 'number';
  if (t.includes('score') || t.includes('index')) return 'score';
  return null;
}

/** Campos para exibição M&E (fallback a metadados no próprio nó). */
export function resolveIndicatorMetrics(node: {
  type?: string;
  title?: string | null;
  indicator?: string | null;
  unitOfMeasure?: string | null;
  baseline?: string | null;
  target?: string | null;
  actual?: string | null;
  description?: string | null;
}): {
  unitOfMeasure: string;
  baseline: string;
  target: string;
  actual: string;
} {
  const raw = node as Record<string, unknown>;
  const extracted = extractIndicatorFields({
    ...raw,
    title: node.title,
    indicator: node.indicator,
    name: node.indicator || node.title,
  });

  const unitOfMeasure =
    (node.unitOfMeasure || extracted.unitOfMeasure || inferUnitFromTitle(node.title || node.indicator || '') || '').trim();
  const baseline = (node.baseline ?? extracted.baseline ?? '').toString().trim();
  const target = (node.target ?? extracted.target ?? '').toString().trim();
  const actual = (node.actual ?? '').toString().trim();

  return { unitOfMeasure, baseline, target, actual };
}

export function metricsMissing(node: {
  unitOfMeasure?: string | null;
  target?: string | null;
  baseline?: string | null;
}): boolean {
  const m = resolveIndicatorMetrics(node);
  return !m.unitOfMeasure && !m.target;
}
