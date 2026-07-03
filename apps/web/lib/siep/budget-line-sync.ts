import { prisma } from '@/lib/prisma';
import {
  computeBudgetLineTotals,
  inferUnitTypeFromLine,
  type BudgetLineCalcInput,
} from '@/lib/siep/budget-line-calc';

/** Recalcula totales de líneas con unitType percent_of_direct y persiste en BD. */
export async function recalculateProjectBudgetLines(projectId: string): Promise<void> {
  const lines = await prisma.budgetLine.findMany({
    where: { projectId, isActive: true },
    select: {
      id: true,
      category: true,
      quantity: true,
      unitCost: true,
      unit: true,
      unitType: true,
      total: true,
    },
  });

  const inputs: BudgetLineCalcInput[] = lines.map((l) => ({
    id: l.id,
    category: l.category,
    quantity: l.quantity,
    unitCost: l.unitCost,
    unit: l.unit,
    unitType: l.unitType,
  }));

  const totals = computeBudgetLineTotals(inputs);

  await Promise.all(
    lines.map((line) => {
      const newTotal = totals.get(line.id) ?? line.total;
      if (Math.abs(newTotal - line.total) < 0.005) return Promise.resolve();
      return prisma.budgetLine.update({
        where: { id: line.id },
        data: { total: Math.round(newTotal * 100) / 100 },
      });
    }),
  );
}

export function normalizeBudgetLineInput(body: Record<string, unknown>, existing?: {
  category: string;
  unit?: string | null;
  unitType?: string | null;
}) {
  const category = String(body.category ?? existing?.category ?? 'other_direct');
  let unitType = String(body.unitType ?? existing?.unitType ?? '');
  const unit = body.unit !== undefined ? (body.unit ? String(body.unit) : null) : existing?.unit;

  if (!unitType) {
    unitType = inferUnitTypeFromLine({ category, unit, unitType: null });
  }
  if (unit === 'percent' || category === 'indirect') {
    unitType = 'percent_of_direct';
  }

  return {
    category,
    unit,
    unitType,
    quantity: parseFloat(String(body.quantity ?? 1)) || 0,
    unitCost: parseFloat(String(body.unitCost ?? 0)) || 0,
  };
}
