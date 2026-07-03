import { prisma } from '@/lib/prisma';
import type { ImportSectionKey } from '@/lib/siep/import-section-prompts';
import { importObjectivesTree } from '@/lib/siep/import-objectives-tree';
import { repairIndicatorActivities } from '@/lib/siep/repair-indicator-activities';
import { repairIndicatorMetadata } from '@/lib/siep/repair-indicator-metadata';

export async function applyImportSectionToProject(
  projectId: string,
  section: ImportSectionKey,
  data: Record<string, unknown>,
  mode: 'replace' | 'append',
): Promise<{ applied: number }> {
  switch (section) {
    case 'budgetLines': {
      const lines = (data.budgetLines as unknown[]) || [];
      if (mode === 'replace') {
        await prisma.budgetLine.updateMany({ where: { projectId, isActive: true }, data: { isActive: false } });
      }
      const startOrder = mode === 'append'
        ? await prisma.budgetLine.count({ where: { projectId, isActive: true } })
        : 0;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i] as Record<string, unknown>;
        await prisma.budgetLine.create({
          data: {
            projectId,
            category: String(l.category || 'other_direct'),
            description: String(l.description || 'Línea presupuestaria'),
            unit: l.unit ? String(l.unit) : null,
            quantity: parseFloat(String(l.quantity)) || 1,
            unitCost: parseFloat(String(l.unitCost)) || 0,
            total: parseFloat(String(l.total)) || (parseFloat(String(l.quantity)) || 1) * (parseFloat(String(l.unitCost)) || 0),
            narrative: String(l.narrative || ''),
            fundSource: String(l.fundSource || 'federal'),
            order: startOrder + i,
          },
        });
      }
      return { applied: lines.length };
    }

    case 'risks': {
      const items = (data.risks as unknown[]) || [];
      if (mode === 'replace') {
        await prisma.risk.deleteMany({ where: { projectId } });
      }
      for (const r of items) {
        const item = r as Record<string, unknown>;
        await prisma.risk.create({
          data: {
            projectId,
            title: String(item.title || 'Riesgo'),
            description: String(item.description || ''),
            level: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(String(item.level))
              ? String(item.level)
              : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
            impact: String(item.impact || ''),
            mitigation: String(item.mitigation || ''),
          },
        });
      }
      return { applied: items.length };
    }

    case 'milestones': {
      const items = (data.milestones as unknown[]) || [];
      if (mode === 'replace') {
        await prisma.milestone.deleteMany({ where: { projectId } });
      }
      const startOrder = mode === 'append'
        ? await prisma.milestone.count({ where: { projectId } })
        : 0;
      for (let i = 0; i < items.length; i++) {
        const m = items[i] as Record<string, unknown>;
        await prisma.milestone.create({
          data: {
            projectId,
            name: String(m.name || `Hito ${i + 1}`),
            description: m.description ? String(m.description) : null,
            dueDate: m.dueDate ? new Date(String(m.dueDate)) : null,
            order: startOrder + i,
          },
        });
      }
      return { applied: items.length };
    }

    case 'sow': {
      const sections = (data.sow as unknown[]) || [];
      for (const s of sections) {
        const sec = s as Record<string, unknown>;
        const sectionKey = String(sec.sectionKey || 'background');
        const content = sec.content
          ? String(sec.content)
          : Array.isArray(sec.items)
            ? (sec.items as string[]).map((x, i) => `${i + 1}. ${x}`).join('\n')
            : '';
        await prisma.sOWSection.upsert({
          where: { projectId_sectionKey: { projectId, sectionKey } },
          create: {
            projectId,
            sectionKey,
            title: String(sec.title || sectionKey),
            content,
            order: 0,
          },
          update: {
            title: String(sec.title || sectionKey),
            content: mode === 'append' ? undefined : content,
          },
        });
      }
      return { applied: sections.length };
    }

    case 'objectives': {
      const tree = (data.objectives as unknown[]) || [];
      if (!tree.length) {
        throw new Error('A IA não devolveu objectives na re-importação.');
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { goal: true, description: true },
      });
      const goalTitle = project?.goal || project?.description || null;

      const existingGoal = await prisma.objective.findFirst({
        where: { projectId, type: 'goal', isActive: true },
      });

      if (mode === 'replace') {
        await prisma.objective.updateMany({
          where: { projectId, isActive: true },
          data: { isActive: false },
        });
      }

      let rootParentId: string | null = null;
      if (existingGoal) {
        await prisma.objective.update({
          where: { id: existingGoal.id },
          data: { isActive: true },
        });
        rootParentId = existingGoal.id;
      }

      const applied = await importObjectivesTree(projectId, tree, {
        goalTitle: !rootParentId && mode === 'replace' ? goalTitle : null,
        rootParentId,
      });

      await repairIndicatorActivities(projectId);
      await repairIndicatorMetadata(projectId, { useAi: false });

      return { applied };
    }

    default:
      throw new Error(`Secção "${section}" ainda não suporta aplicar em projeto existente. Use o preview do Smart Import.`);
  }
}
