import { prisma } from '@/lib/prisma';
import {
  planIndicatorActivityRepairs,
  type ObjectiveNode,
} from '@/lib/siep/objective-hierarchy';

type ObjectiveDelegate = typeof prisma.objective;

async function loadFlatObjectives(
  objective: ObjectiveDelegate,
  projectId: string,
): Promise<ObjectiveNode[]> {
  const rows = await objective.findMany({
    where: { projectId, isActive: true },
    orderBy: { order: 'asc' },
  });
  return rows.map((r) => ({ ...r, children: [] }));
}

export async function repairIndicatorActivities(
  projectId: string,
): Promise<{ reparented: number; activitiesCreated: number; remainingOrphans: number }> {
  let activitiesCreated = 0;
  let reparented = 0;

  await prisma.$transaction(async (tx) => {
    let flat = await loadFlatObjectives(tx.objective, projectId);
    let plan = planIndicatorActivityRepairs(flat);

    for (const spec of plan.activitiesToCreate) {
      const existing = await tx.objective.findFirst({
        where: {
          projectId,
          parentId: spec.anchorId,
          type: 'activity',
          isActive: true,
          description: spec.description,
        },
      });
      if (existing) continue;

      const siblingCount = await tx.objective.count({
        where: { projectId, parentId: spec.anchorId, isActive: true },
      });

      await tx.objective.create({
        data: {
          projectId,
          parentId: spec.anchorId,
          type: 'activity',
          code: spec.code,
          title: spec.title,
          description: spec.description,
          order: siblingCount,
        },
      });
      activitiesCreated++;
    }

    if (activitiesCreated > 0) {
      flat = await loadFlatObjectives(tx.objective, projectId);
      plan = planIndicatorActivityRepairs(flat);
    }

    for (const item of plan.items) {
      if (!item.toParentId || item.toParentId.startsWith('pending:')) continue;
      if (item.fromParentId === item.toParentId) continue;
      await tx.objective.update({
        where: { id: item.indicatorId },
        data: { parentId: item.toParentId },
      });
      reparented++;
    }
  });

  const afterFlat = await loadFlatObjectives(prisma.objective, projectId);
  const remaining = planIndicatorActivityRepairs(afterFlat).items.length;

  return { reparented, activitiesCreated, remainingOrphans: remaining };
}
