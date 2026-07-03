import { prisma } from '@/lib/prisma';
import { buildObjectiveImportData, extractIndicatorFields } from '@/lib/siep/indicator-fields';

export async function importObjectivesTree(
  projectId: string,
  objectives: unknown[],
  options?: { goalTitle?: string | null; rootParentId?: string | null },
): Promise<number> {
  let count = 0;
  let goalNodeId = options?.rootParentId ?? null;

  if (options?.goalTitle && !goalNodeId) {
    const goalNode = await prisma.objective.create({
      data: {
        projectId,
        parentId: null,
        type: 'goal',
        code: 'PG',
        title: options.goalTitle,
        description: null,
        order: 0,
      },
    });
    goalNodeId = goalNode.id;
    count++;
  }

  const createNode = async (o: Record<string, unknown>, parentId: string | null, order: number): Promise<number> => {
    let local = 0;

    const created = await prisma.objective.create({
      data: buildObjectiveImportData(projectId, o, parentId, order),
    });
    local++;

    const children = (o.children as unknown[]) || [];
    for (let i = 0; i < children.length; i++) {
      local += await createNode(children[i] as Record<string, unknown>, created.id, i);
    }

    const indicators = (o.indicators as unknown[]) || [];
    if (indicators.length > 0) {
      const activityChildren = await prisma.objective.findMany({
        where: { projectId, parentId: created.id, type: 'activity', isActive: true },
        orderBy: { order: 'asc' },
      });
      const indicatorParentId = activityChildren[0]?.id ?? created.id;

      for (let j = 0; j < indicators.length; j++) {
        const ind = indicators[j] as Record<string, unknown>;
        const fields = extractIndicatorFields(ind);
        await prisma.objective.create({
          data: {
            projectId,
            parentId: indicatorParentId,
            type: 'indicator',
            code: fields.code,
            title: fields.title,
            indicator: fields.indicator,
            indicatorType: fields.indicatorType,
            unitOfMeasure: fields.unitOfMeasure,
            baseline: fields.baseline ?? '',
            target: fields.target ?? '',
            dataSource: fields.dataSource,
            reportingFreq: fields.reportingFreq,
            responsibility: fields.responsibility,
            order: j,
          },
        });
        local++;
      }
    }

    return local;
  };

  for (let i = 0; i < objectives.length; i++) {
    count += await createNode(objectives[i] as Record<string, unknown>, goalNodeId, i);
  }

  return count;
}
