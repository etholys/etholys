/** Cálculo de líneas presupuestarias — incluye indirectos como % de costos directos. */

export type BudgetLineCalcInput = {
  id?: string;
  category?: string;
  quantity: number;
  unitCost: number;
  unit?: string | null;
  unitType?: string | null;
};

export const BUDGET_UNIT_TYPES = [
  { value: 'fixed', label: 'Cantidad × costo unitario' },
  { value: 'percent_of_direct', label: '% de costos directos' },
] as const;

export const BUDGET_UNITS = [
  { value: 'month', label: 'Meses' },
  { value: 'unit', label: 'Unidades' },
  { value: 'trip', label: 'Viajes' },
  { value: 'hour', label: 'Horas' },
  { value: 'lump_sum', label: 'Global / lump sum' },
  { value: 'percent', label: 'Porcentaje (%)' },
] as const;

export function resolveUnitType(line: BudgetLineCalcInput): 'fixed' | 'percent_of_direct' {
  if (line.unitType === 'percent_of_direct') return 'percent_of_direct';
  if (line.category === 'indirect') return 'percent_of_direct';
  const u = (line.unit || '').toLowerCase();
  if (u.includes('percent') || u.includes('%') || u.includes('porcent')) return 'percent_of_direct';
  return 'fixed';
}

export function sumDirectCosts(lines: BudgetLineCalcInput[], excludeId?: string): number {
  return lines
    .filter((l) => l.id !== excludeId && resolveUnitType(l) === 'fixed')
    .reduce((s, l) => s + (l.quantity || 0) * (l.unitCost || 0), 0);
}

export function computeLineTotal(line: BudgetLineCalcInput, allLines: BudgetLineCalcInput[]): number {
  if (resolveUnitType(line) === 'percent_of_direct') {
    const base = sumDirectCosts(allLines, line.id);
    return ((line.quantity || 0) / 100) * base;
  }
  return (line.quantity || 0) * (line.unitCost || 0);
}

export function computeBudgetLineTotals(lines: BudgetLineCalcInput[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    const key = line.id || '';
    totals.set(key, computeLineTotal(line, lines));
  }
  return totals;
}

export function inferUnitTypeFromLine(line: {
  category: string;
  unit?: string | null;
  unitType?: string | null;
}): 'fixed' | 'percent_of_direct' {
  return resolveUnitType({
    category: line.category,
    unit: line.unit,
    unitType: line.unitType,
    quantity: 0,
    unitCost: 0,
  });
}
