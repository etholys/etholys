import { prisma } from '@/lib/prisma';
import { geminiGenerateContent } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import { extractIndicatorFields, inferUnitFromTitle, metricsMissing } from '@/lib/siep/indicator-fields';

type Row = {
  id: string;
  title: string;
  indicator: string | null;
  unitOfMeasure: string | null;
  baseline: string | null;
  target: string | null;
  description?: string | null;
};

/** Repara indicadores sem unidade/meta — heurística local + IA opcional. */
export async function repairIndicatorMetadata(
  projectId: string,
  options?: { useAi?: boolean; documentHint?: string },
): Promise<{ updated: number; inferred: number; aiFilled: number; remaining: number }> {
  const rows = await prisma.objective.findMany({
    where: { projectId, isActive: true, type: 'indicator' },
    select: {
      id: true,
      title: true,
      indicator: true,
      unitOfMeasure: true,
      baseline: true,
      target: true,
      description: true,
    },
  });

  let updated = 0;
  let inferred = 0;

  for (const row of rows) {
    if (!metricsMissing(row)) continue;

    const fromDesc = row.description ? extractIndicatorFields({ description: row.description }) : null;
    const unit =
      row.unitOfMeasure ||
      fromDesc?.unitOfMeasure ||
      inferUnitFromTitle(row.title || row.indicator || '') ||
      null;
    const baseline = row.baseline || fromDesc?.baseline || null;
    const target = row.target || fromDesc?.target || null;

    if (!unit && !baseline && !target) continue;

    await prisma.objective.update({
      where: { id: row.id },
      data: {
        unitOfMeasure: unit,
        baseline: baseline ?? '',
        target: target ?? '',
      },
    });
    updated++;
    if (unit && inferUnitFromTitle(row.title || '')) inferred++;
  }

  let aiFilled = 0;
  if (options?.useAi !== false) {
    const stillMissing = await prisma.objective.findMany({
      where: { projectId, isActive: true, type: 'indicator' },
      select: { id: true, title: true, indicator: true, unitOfMeasure: true, baseline: true, target: true },
    });
    const needAi = stillMissing.filter((r) => metricsMissing(r));
    if (needAi.length > 0) {
      aiFilled = await fillMissingWithAi(needAi, options?.documentHint);
    }
  }

  const remaining = (
    await prisma.objective.findMany({
      where: { projectId, isActive: true, type: 'indicator' },
      select: { unitOfMeasure: true, target: true, baseline: true, title: true },
    })
  ).filter((r) => metricsMissing(r)).length;

  return { updated, inferred, aiFilled, remaining };
}

async function fillMissingWithAi(rows: Row[], documentHint?: string): Promise<number> {
  const payload = rows.map((r) => ({
    id: r.id,
    title: r.title || r.indicator,
  }));

  const hint = documentHint?.trim()
    ? `\nContexto do documento:\n${documentHint.slice(0, 4000)}`
    : '';

  const prompt = `Para cada indicador de projecto M&E, infira unitOfMeasure, baseline e target quando possível a partir do título.
Use unidades padrão: "number", "%", "person-hours", "score", etc.
baseline padrão "0" se for contagem ou percentagem e não souber.
target só preencha se estiver explícito ou claramente inferível do título; senão null.
${hint}

Indicadores:
${JSON.stringify(payload)}

Responda APENAS JSON: { "items": [{ "id", "unitOfMeasure", "baseline", "target" }] }`;

  const { text } = await geminiGenerateContent({
    systemInstruction: prompt,
    userParts: [{ text: 'Preencha metadados M&E em falta.' }],
    temperature: 0.1,
    responseMimeType: 'application/json',
  });

  const parsed = JSON.parse(extractFirstJsonObject(text) || text) as {
    items?: Array<{ id: string; unitOfMeasure?: string; baseline?: string; target?: string }>;
  };

  let count = 0;
  for (const item of parsed.items || []) {
    if (!item?.id) continue;
    const row = rows.find((r) => r.id === item.id);
    if (!row || !metricsMissing(row)) continue;

    const unit = item.unitOfMeasure?.trim() || inferUnitFromTitle(row.title || '') || null;
    const baseline = item.baseline?.trim() ?? (unit === '%' || unit === 'number' ? '0' : '');
    const target = item.target?.trim() ?? '';

    if (!unit && !target) continue;

    await prisma.objective.update({
      where: { id: item.id },
      data: {
        unitOfMeasure: unit,
        baseline: baseline || '',
        target: target || '',
      },
    });
    count++;
  }
  return count;
}
