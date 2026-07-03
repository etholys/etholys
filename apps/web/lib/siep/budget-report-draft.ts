import { prisma } from '@/lib/prisma';
import { geminiCompleteJsonText } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import { loadReportGuideContext } from '@/lib/siep/report-guide-context';
import {
  computeBudgetLineTotals,
  resolveUnitType,
  type BudgetLineCalcInput,
} from '@/lib/siep/budget-line-calc';

export type BudgetReportDraft = {
  title: string;
  period: string;
  content: string;
  findings: string;
  recommendations: string;
  warnings: string[];
};

const PROMPT = `Eres un especialista en informes financieros de proyectos (USAID SF-425, BID, UE).
Genera un BORRADOR de informe financiero periódico siguiendo el manual del financiador.

Responde SOLO JSON válido:
{
  "title": "título sugerido",
  "period": "período cubierto",
  "content": "cuerpo narrativo y tablas en markdown con cifras del proyecto",
  "findings": "variaciones presupuesto vs ejecutado, observaciones",
  "recommendations": "acciones sugeridas",
  "warnings": ["campos que el usuario debe verificar manualmente"]
}

Usa las cifras reales del contexto. Marca estimaciones con [VERIFICAR].`;

export async function generateBudgetReportDraft(
  projectId: string,
  opts?: { periodStart?: string; periodEnd?: string; donorFormat?: string },
): Promise<BudgetReportDraft> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, budget: true, currency: true },
  });
  if (!project) throw new Error('Proyecto no encontrado');

  const rawLines = await prisma.budgetLine.findMany({
    where: { projectId, isActive: true },
    orderBy: [{ category: 'asc' }, { order: 'asc' }],
  });

  const inputs: BudgetLineCalcInput[] = rawLines.map((l) => ({
    id: l.id,
    category: l.category,
    quantity: l.quantity,
    unitCost: l.unitCost,
    unit: l.unit,
    unitType: l.unitType,
  }));
  const totals = computeBudgetLineTotals(inputs);

  const linesSummary = rawLines.map((l) => {
    const total = totals.get(l.id) ?? l.total;
    const mode = resolveUnitType(inputs.find((i) => i.id === l.id)!);
    return `- [${l.category}] ${l.description}: planificado ${total.toFixed(2)} (${mode === 'percent_of_direct' ? `${l.quantity}% indirectos` : `${l.quantity} × ${l.unitCost}`})`;
  });

  const txWhere: { projectId: string; date?: { gte?: Date; lte?: Date } } = { projectId };
  if (opts?.periodStart || opts?.periodEnd) {
    txWhere.date = {};
    if (opts.periodStart) txWhere.date.gte = new Date(opts.periodStart);
    if (opts.periodEnd) txWhere.date.lte = new Date(opts.periodEnd);
  }

  const txs = await prisma.transaction.findMany({
    where: txWhere,
    select: { type: true, amount: true, description: true, date: true, category: true },
    orderBy: { date: 'desc' },
    take: 200,
  });

  const expense = txs
    .filter((t) => t.type === 'EXPENSE' || t.type === 'TRANSFER_OUT')
    .reduce((s, t) => s + t.amount, 0);
  const income = txs.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0);
  const planned = Array.from(totals.values()).reduce((s, v) => s + v, 0);

  const guideContext = await loadReportGuideContext(projectId, 'budget');
  const periodLabel =
    opts?.periodStart && opts?.periodEnd
      ? `${opts.periodStart} — ${opts.periodEnd}`
      : opts?.periodStart || opts?.periodEnd || 'período actual';

  const userText = `Proyecto: ${project.name}
Moneda: ${project.currency || 'USD'}
Presupuesto autorizado (proyecto): ${project.budget}
Total planificado (líneas): ${planned.toFixed(2)}
Gastos ejecutados${periodLabel !== 'período actual' ? ` (${periodLabel})` : ''}: ${expense.toFixed(2)}
Ingresos${periodLabel !== 'período actual' ? ` (${periodLabel})` : ''}: ${income.toFixed(2)}
Formato donante: ${opts?.donorFormat || 'generic'}

LÍNEAS PRESUPUESTARIAS:
${linesSummary.join('\n')}

TRANSACCIONES RECIENTES (máx. 200):
${txs.slice(0, 40).map((t) => `- ${t.date.toISOString().slice(0, 10)} ${t.type} ${t.amount} — ${t.description || t.category || ''}`).join('\n')}

${guideContext ? `\n${guideContext}\n` : ''}`;

  const raw = await geminiCompleteJsonText(PROMPT, userText, { maxOutputTokens: 8192 });
  const parsed = extractFirstJsonObject(raw) as Partial<BudgetReportDraft>;

  return {
    title: parsed.title || `Informe financiero — ${periodLabel}`,
    period: parsed.period || periodLabel,
    content: parsed.content || '',
    findings: parsed.findings || '',
    recommendations: parsed.recommendations || '',
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
  };
}
