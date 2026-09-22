export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireProjectPermission } from '@/lib/siep/permissions';
import { getUserCompanyIds } from '@/lib/tenant';
import { IMPULSA_LOS_SANTOS_REPORTING_TOOL } from '@/lib/siep/reporting-tool/impulsa-los-santos-v-agust';
import { findLinkedObjectiveId } from '@/lib/siep/reporting-tool/link-objective';

async function loadTool(projectId: string) {
  return prisma.projectReportingTool.findFirst({
    where: { projectId, isActive: true },
    orderBy: { createdAt: 'desc' },
    include: {
      lines: {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        include: {
          progressEntries: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
      },
    },
  });
}

async function enrichLines(
  projectId: string,
  lines: NonNullable<Awaited<ReturnType<typeof loadTool>>>['lines'],
) {
  const linkedIds = [...new Set((lines || []).map((l) => l.linkedObjectiveId).filter(Boolean))] as string[];
  const objectives = linkedIds.length
    ? await prisma.objective.findMany({
        where: { id: { in: linkedIds }, projectId },
        select: { id: true, title: true, indicator: true, baseline: true, target: true, actual: true, code: true, type: true },
      })
    : [];
  const byId = new Map(objectives.map((o) => [o.id, o]));
  return (lines || []).map((line) => {
    const latest = line.progressEntries?.[0] || null;
    return {
      ...line,
      linkedObjective: line.linkedObjectiveId ? byId.get(line.linkedObjectiveId) || null : null,
      reflectedActual: line.linkedObjectiveId ? byId.get(line.linkedObjectiveId)?.actual ?? null : null,
      latestProgress: latest,
      reportedValue: latest?.totalCumulative ?? latest?.progressDuring ?? null,
      reportedStatus: latest?.status ?? 'Not started',
    };
  });
}

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const gate = await requireProjectPermission(tenant.userId, params.projectId, [
      'siep.logframe.view',
      'siep.project.view',
    ]);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const tool = await loadTool(params.projectId);
    if (!tool) return NextResponse.json({ tool: null, lines: [] });

    const lines = await enrichLines(params.projectId, tool.lines);
    const counts = {
      total: lines.length,
      same_essence: lines.filter((l) => l.tag === 'same_essence').length,
      official_dos: lines.filter((l) => l.tag === 'official_dos').length,
      to_be_designed: lines.filter((l) => l.tag === 'to_be_designed').length,
      linked: lines.filter((l) => l.linkedObjectiveId).length,
    };
    return NextResponse.json({ tool: { ...tool, lines }, lines, counts });
  } catch (error: unknown) {
    console.error('[SIEP] reporting-tool GET:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/** Cria/atualiza a Reporting Tool a partir do mapa validado (não altera o logframe). */
export async function POST(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const gate = await requireProjectPermission(tenant.userId, params.projectId, [
      'siep.logframe.edit',
      'siep.project.edit',
    ]);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await req.json().catch(() => ({}));
    const replace = body.replace !== false;
    const seedKey = String(body.seed || 'impulsa-los-santos-v-agust');
    if (seedKey !== 'impulsa-los-santos-v-agust') {
      return NextResponse.json({ error: 'Seed não suportado' }, { status: 400 });
    }

    const seed = IMPULSA_LOS_SANTOS_REPORTING_TOOL;
    const objectives = await prisma.objective.findMany({
      where: { projectId: params.projectId, isActive: true },
      select: { id: true, type: true, title: true, indicator: true },
    });

    if (replace) {
      await prisma.projectReportingTool.updateMany({
        where: { projectId: params.projectId, isActive: true },
        data: { isActive: false },
      });
    }

    const tool = await prisma.projectReportingTool.create({
      data: {
        projectId: params.projectId,
        title: seed.title,
        version: seed.version,
        sourceFileName: seed.sourceFileName,
        notes: seed.notes,
        lines: {
          create: seed.lines.map((line) => ({
            projectId: params.projectId,
            order: line.order,
            block: line.block,
            resultContext: line.resultContext,
            indicatorText: line.indicatorText,
            isDos: line.isDos,
            tag: line.tag,
            baseline: line.baseline,
            target: line.target,
            notes: line.notes,
            siepHint: line.siepHint,
            linkedObjectiveId: findLinkedObjectiveId(line, objectives),
          })),
        },
      },
      include: { lines: { orderBy: { order: 'asc' } } },
    });

    const lines = await enrichLines(params.projectId, tool.lines);
    return NextResponse.json({
      tool: { ...tool, lines },
      linked: lines.filter((l) => l.linkedObjectiveId).length,
      total: lines.length,
    });
  } catch (error: unknown) {
    console.error('[SIEP] reporting-tool POST:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

/** Atualiza link / notas de uma linha (não altera indicadores do logframe). */
export async function PATCH(req: Request, { params }: { params: { projectId: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const gate = await requireProjectPermission(tenant.userId, params.projectId, [
      'siep.logframe.edit',
      'siep.project.edit',
    ]);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await req.json();
    const lineId = String(body.lineId || '');
    if (!lineId) return NextResponse.json({ error: 'lineId requerido' }, { status: 400 });

    const existing = await prisma.projectReportingToolLine.findFirst({
      where: { id: lineId, projectId: params.projectId },
    });
    if (!existing) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.linkedObjectiveId !== undefined) {
      data.linkedObjectiveId = body.linkedObjectiveId || null;
    }
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.tag !== undefined) data.tag = body.tag;

    const line = await prisma.projectReportingToolLine.update({ where: { id: lineId }, data });
    return NextResponse.json({ line });
  } catch (error: unknown) {
    console.error('[SIEP] reporting-tool PATCH:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
