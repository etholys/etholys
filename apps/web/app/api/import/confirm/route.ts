export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { repairIndicatorActivities } from '@/lib/siep/repair-indicator-activities';
import { repairIndicatorMetadata } from '@/lib/siep/repair-indicator-metadata';
import { buildObjectiveImportData, extractIndicatorFields } from '@/lib/siep/indicator-fields';
import { resolveStoredContentLocale } from '@/lib/siep/import-language';
import type { ContentLocale } from '@/lib/siep/i18n';
import type { Locale } from '@/lib/i18n';

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    const body = await req.json();
    const {
      companyId,
      project: projData,
      sow,
      objectives,
      budgetLines,
      risks,
      milestones,
      diagnostics,
      sourceLanguage,
      contentLocale: detectedLocale,
    } = body;

    const declaredLang = (['auto', 'es', 'pt', 'en'].includes(String(sourceLanguage || ''))
      ? sourceLanguage
      : 'auto') as ContentLocale;
    const contentLocale = resolveStoredContentLocale(
      declaredLang,
      detectedLocale as string | null,
      'es' as Locale,
    );

    if (!companyId || !projData?.name) {
      return NextResponse.json({ error: 'companyId y nombre de proyecto son requeridos' }, { status: 400 });
    }

    // Verify company ownership
    if (!tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'No autorizado para esta empresa' }, { status: 403 });
    }

    // Calculate total budget from budget lines if not set
    const budgetFromLines = (budgetLines ?? []).reduce((s: number, l: any) => s + (parseFloat(l.total) || ((parseFloat(l.quantity) || 1) * (parseFloat(l.unitCost) || 0))), 0);
    const totalBudget = projData.budget > 0 ? projData.budget : budgetFromLines;

    // 1. Create the project as DRAFT with goal
    const project = await prisma.project.create({
      data: {
        name: projData.name,
        description: projData.description || null,
        goal: projData.goal || null,
        companyId,
        donorName: projData.donorName || null,
        country: projData.country || null,
        region: projData.region || null,
        currency: projData.currency || 'USD',
        budget: totalBudget,
        status: 'DRAFT',
        priority: 'MEDIUM',
        startDate: projData.startDate ? new Date(projData.startDate) : null,
        endDate: projData.endDate ? new Date(projData.endDate) : null,
        contentLocale,
      },
    });

    const projectId = project.id;
    const results: Record<string, number> = {};

    // 2. Create SOW sections (now with items support)
    if (sow?.length > 0) {
      await prisma.sOWSection.createMany({
        data: sow.map((s: any, i: number) => {
          // If items array exists, join as bullet list for content
          let content = s.content || '';
          if (s.items && Array.isArray(s.items) && s.items.length > 0) {
            content = s.items.map((item: string) => `\u2022 ${item}`).join('\n');
          }
          return {
            projectId,
            sectionKey: s.sectionKey || `section_${i}`,
            title: s.title || `Secci\u00f3n ${i + 1}`,
            content,
            order: i,
          };
        }),
      });
      results.sow = sow.length;
    }

    // 3. Create objectives tree: Goal (root) → Outcomes → OEs → Outputs → Activities → Inputs
    const activitiesForTasks: { code: string; title: string; description: string | null; startDate: string | null; endDate: string | null; objectiveId: string }[] = [];

    const VALID_TYPES = new Set(['objective', 'outcome', 'output', 'activity', 'deliverable', 'goal', 'impact', 'problem_statement', 'need', 'input', 'assumption', 'external_factor', 'indicator']);

    const createObjectiveNode = async (o: any, parentId: string | null, order: number): Promise<number> => {
      let count = 0;

      const created = await prisma.objective.create({
        data: buildObjectiveImportData(projectId, o, parentId, order),
      });
      count++;

      // Collect activities/deliverables for Task creation
      if (created.type === 'activity' || created.type === 'deliverable') {
        activitiesForTasks.push({
          code: o.code || '',
          title: o.title || 'Actividad',
          description: o.description || null,
          startDate: o.startDate || null,
          endDate: o.endDate || null,
          objectiveId: created.id,
        });
      }

      // Recurse into children BEFORE attaching indicators (so activities exist as parents)
      if (o.children?.length > 0) {
        for (let i = 0; i < o.children.length; i++) {
          count += await createObjectiveNode(o.children[i], created.id, i);
        }
      }

      // Indicators belong under an activity when one exists under this node
      if (o.indicators && Array.isArray(o.indicators) && o.indicators.length > 0) {
        const activityChildren = await prisma.objective.findMany({
          where: { projectId, parentId: created.id, type: 'activity', isActive: true },
          orderBy: { order: 'asc' },
        });
        const indicatorParentId = activityChildren[0]?.id ?? created.id;

        for (let j = 0; j < o.indicators.length; j++) {
          const ind = o.indicators[j];
          const fields = extractIndicatorFields(ind);
          await prisma.objective.create({
            data: {
              projectId,
              parentId: indicatorParentId,
              type: 'indicator',
              code: fields.code,
              title: fields.title,
              description: null,
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
          count++;
        }
      }

      return count;
    };

    // Create the Goal node as root if project.goal exists
    let goalNodeId: string | null = null;
    let objCount = 0;
    if (projData.goal) {
      const goalNode = await prisma.objective.create({
        data: {
          projectId,
          parentId: null,
          type: 'goal',
          code: 'PG',
          title: projData.goal,
          description: null,
          order: 0,
        },
      });
      goalNodeId = goalNode.id;
      objCount++;
    }

    // Create objective tree nodes under the goal
    if (objectives?.length > 0) {
      for (let i = 0; i < objectives.length; i++) {
        objCount += await createObjectiveNode(objectives[i], goalNodeId, i);
      }
    }

    // Create diagnostic nodes (problem_statement, need, assumption, external_factor) as root-level
    if (diagnostics?.length > 0) {
      for (let i = 0; i < diagnostics.length; i++) {
        const d = diagnostics[i];
        const dType = (d.type && VALID_TYPES.has(d.type)) ? d.type : 'assumption';
        await prisma.objective.create({
          data: {
            projectId,
            parentId: null,
            type: dType,
            code: d.code || null,
            title: d.title || 'Diagnóstico',
            description: d.description || null,
            order: i,
          },
        });
        objCount++;
      }
      results.diagnostics = diagnostics.length;
    }

    if (objCount > 0) results.objectives = objCount;

    // 4. Create Tasks from activities extracted in the logic model
    if (activitiesForTasks.length > 0 && userId) {
      for (let i = 0; i < activitiesForTasks.length; i++) {
        const act = activitiesForTasks[i];
        await prisma.task.create({
          data: {
            title: act.code ? `${act.code}: ${act.title}` : act.title,
            description: act.description,
            projectId,
            companyId,
            creatorId: userId,
            status: 'TODO',
            priority: 'MEDIUM',
            startDate: act.startDate ? new Date(act.startDate) : null,
            dueDate: act.endDate ? new Date(act.endDate) : null,
            order: i,
          },
        });
      }
      results.tasks = activitiesForTasks.length;
    }

    // 5. Create budget lines
    if (budgetLines?.length > 0) {
      await prisma.budgetLine.createMany({
        data: budgetLines.map((l: any, i: number) => ({
          projectId,
          category: l.category || 'other_direct',
          description: l.description || 'L\u00ednea presupuestaria',
          unit: l.unit || null,
          quantity: parseFloat(l.quantity) || 1,
          unitCost: parseFloat(l.unitCost) || 0,
          total: parseFloat(l.total) || ((parseFloat(l.quantity) || 1) * (parseFloat(l.unitCost) || 0)),
          narrative: l.narrative || '',
          fundSource: l.fundSource || 'federal',
          order: i,
        })),
      });
      results.budgetLines = budgetLines.length;
    }

    // 6. Create risks
    if (risks?.length > 0) {
      await prisma.risk.createMany({
        data: risks.map((r: any) => ({
          projectId,
          title: r.title || 'Riesgo sin t\u00edtulo',
          description: r.description || null,
          level: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(r.level) ? r.level : 'MEDIUM',
          impact: r.impact || null,
          mitigation: r.mitigation || null,
          status: 'open',
        })),
      });
      results.risks = risks.length;
    }

    // 7. Create milestones
    if (milestones?.length > 0) {
      await prisma.milestone.createMany({
        data: milestones.map((m: any, i: number) => ({
          projectId,
          name: m.name || `Hito ${i + 1}`,
          description: m.description || null,
          dueDate: m.dueDate ? new Date(m.dueDate) : null,
          order: i,
        })),
      });
      results.milestones = milestones.length;
    }

    console.log(`[Import] Project created: ${project.id} "${project.name}" with:`, results);

    if (results.objectives) {
      try {
        const linkRepair = await repairIndicatorActivities(project.id);
        if (linkRepair.reparented > 0) results.indicatorLinks = linkRepair.reparented;
        if (linkRepair.activitiesCreated > 0) results.activityNodes = linkRepair.activitiesCreated;
        await repairIndicatorMetadata(project.id, { useAi: false });
      } catch (linkErr) {
        console.warn('[Import] Indicator activity link repair skipped:', linkErr);
      }
    }

    return NextResponse.json({ project, results });
  } catch (error: any) {
    console.error('[Import] Confirm error:', error);
    return NextResponse.json({ error: 'Error al crear el proyecto' }, { status: 500 });
  }
}
