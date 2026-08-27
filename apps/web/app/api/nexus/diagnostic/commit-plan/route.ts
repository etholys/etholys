export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';
import { normalizeProgram } from '@/lib/nexus-incubation-program';
import { safeVentureStage } from '@/lib/nexus-guides';
import { buildAtCaseTags, isAtCaseKind, loadEngagementForTenant } from '@/lib/nexus-at';
import type { IncubationProgram } from '@/lib/nexus-incubation-program';
import type { DevelopmentLayer, StrategicPlanOutline } from '@/lib/nexus-incubation-workplan';
import {
  defaultIncubationRun,
  layersFromWorkPlan,
  parseHumanNotesFromIncubatorNotes,
  parseIncubationRunFromNotes,
  pushAdvance,
  recordDiagnosis,
  serializeIncubatorNotes,
  type IncubationDiagnosisSnapshot,
} from '@/lib/nexus-incubation-run';

type PlanItem = {
  id?: string;
  title: string;
  description?: string;
  pillar?: string;
  priority?: string;
  layerIndex?: number;
  horizon?: string;
  kind?: string;
  estimatedHours?: number;
};

const AT_KIND_MAP: Record<string, string> = {
  visit: 'visit',
  workshop: 'workshop',
  deliverable: 'deliverable',
  review: 'visit',
  training: 'training',
};

export async function POST(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const items = (body.items || []) as PlanItem[];
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Selecione ações do plano.' }, { status: 400 });
  }
  if (items.length > 40) {
    return NextResponse.json({ error: 'Máximo 40 ações por commit.' }, { status: 400 });
  }

  const program = normalizeProgram(body.program as Partial<IncubationProgram>);
  const networkIdRaw = String(body.networkId || '').trim();
  let companyId = String(body.companyId || body.targetCompanyId || '').trim() || tenant.companyIds[0] || '';
  let tagSuffix = ',nexus:incubation';

  if (networkIdRaw) {
    const network = await loadNetworkForTenant(networkIdRaw, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });
    const ids = memberCompanyIds(network);
    const target = String(body.targetCompanyId || body.companyId || '').trim() || network.anchorCompanyId;
    if (!ids.includes(target)) {
      return NextResponse.json({ error: 'Empresa alvo inválida.' }, { status: 403 });
    }
    companyId = target;
    tagSuffix += `,nexus:network:${networkIdRaw}`;
  } else if (!companyId || !tenant.companyIds.includes(companyId)) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }

  const atEngagementId = String(body.atEngagementId || program.atEngagementId || '').trim();
  const atProjectId = String(body.atProjectId || program.atProjectId || '').trim();
  let siepProjectId = String(body.siepProjectId || program.siepProjectId || '').trim() || undefined;

  let engagement = null;
  if (atEngagementId) {
    engagement = await loadEngagementForTenant(atEngagementId, tenant.companyIds);
    if (engagement) {
      tagSuffix += `,nexus:at-engagement:${atEngagementId}`;
      const project = atProjectId ? engagement.projects.find((p) => p.id === atProjectId && p.isActive) : null;
      if (project?.siepProjectId) siepProjectId = project.siepProjectId;
      else if (!siepProjectId && engagement.siepProjectId) siepProjectId = engagement.siepProjectId;
    }
  }

  const created: string[] = [];
  const workItemTaskMap: Record<string, string> = {};
  const layerTaskIds: Record<number, string[]> = {};

  for (const item of items.slice(0, 40)) {
    const title = String(item.title || '').trim();
    if (title.length < 4) continue;
    const pillar = String(item.pillar || 'sector').trim().toLowerCase();
    const layer = Number.isFinite(item.layerIndex) ? Math.trunc(item.layerIndex as number) : 0;
    const horizon = String(item.horizon || 'program');
    const kind = String(item.kind || 'deliverable').toLowerCase();
    const wiId = String(item.id || '').trim() || `wi_${created.length}`;
    const priorityRaw = String(item.priority || 'MEDIUM').toUpperCase();
    const priority = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(priorityRaw) ? priorityRaw : 'MEDIUM';

    const task = await prisma.task.create({
      data: {
        companyId,
        creatorId: tenant.userId,
        projectId: siepProjectId,
        title: title.slice(0, 180),
        description: String(item.description || '').slice(0, 8000) || null,
        priority: priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
        status: 'TODO',
        tags: `nexus:roadmap,pillar:${pillar},incubation:layer:${layer},horizon:${horizon},incubation:kind:${kind},incubation:wi:${wiId}${tagSuffix}`,
        isActive: true,
      },
      select: { id: true },
    });
    created.push(task.id);
    workItemTaskMap[wiId] = task.id;
    layerTaskIds[layer] = [...(layerTaskIds[layer] || []), task.id];
  }

  const atCaseIds: string[] = [];
  if (engagement && atProjectId) {
    let atCount = 0;
    for (const item of items.slice(0, 40)) {
      if (atCount >= 5) break;
      const pr = String(item.priority || '').toLowerCase();
      if (pr !== 'critical' && pr !== 'high') continue;
      const kindRaw = AT_KIND_MAP[String(item.kind || '').toLowerCase()] || 'visit';
      if (!isAtCaseKind(kindRaw)) continue;
      const brief = String(item.description || item.title || '').trim();
      if (brief.length < 8) continue;

      const ticket = await prisma.task.create({
        data: {
          companyId,
          creatorId: tenant.userId,
          projectId: siepProjectId,
          title: `[AT] ${String(item.title).slice(0, 140)}`,
          description: `${brief}\n\n— Gerado pelo plano de incubação NEXUS.`,
          priority: pr === 'critical' ? 'CRITICAL' : 'HIGH',
          status: 'TODO',
          tags: buildAtCaseTags(engagement.id, atProjectId, kindRaw),
          isActive: true,
        },
        select: { id: true },
      });
      atCaseIds.push(ticket.id);
      atCount += 1;
    }
  }

  const existingNotes = networkIdRaw
    ? (await prisma.nexusVentureState.findUnique({ where: { networkId: networkIdRaw } }))?.incubatorNotes
    : (await prisma.nexusVentureState.findUnique({ where: { companyId } }))?.incubatorNotes;

  const humanNotes = parseHumanNotesFromIncubatorNotes(existingNotes);
  let run =
    parseIncubationRunFromNotes(existingNotes) ||
    defaultIncubationRun(program, { companyId, networkId: networkIdRaw || null });

  run.program = normalizeProgram({
    ...program,
    atEngagementId: atEngagementId || program.atEngagementId,
    atProjectId: atProjectId || program.atProjectId,
    siepProjectId: siepProjectId || program.siepProjectId,
  });

  const layersIn = (body.layers || []) as DevelopmentLayer[];
  const strategicPlan = (body.strategicPlan || null) as StrategicPlanOutline | null;
  const diagnosisIn = body.diagnosis as IncubationDiagnosisSnapshot | null | undefined;

  if (diagnosisIn?.sectorId) {
    run = recordDiagnosis(run, diagnosisIn);
  }

  const layerStates = layersFromWorkPlan(Array.isArray(layersIn) ? layersIn : []);
  run.layers = layerStates.map((l) => ({
    ...l,
    taskIds: layerTaskIds[l.index] || [],
    status: l.index === 0 ? 'active' : 'pending',
  }));
  run.strategicPlan = strategicPlan;
  run.workItemTaskMap = { ...run.workItemTaskMap, ...workItemTaskMap };
  run.committedAt = new Date().toISOString();
  run.targetCompanyId = companyId;
  run.networkId = networkIdRaw || null;

  run = pushAdvance(run, {
    type: 'plan_commit',
    label: `Plano de trabalho · ${created.length} ações`,
    note: strategicPlan?.vision?.slice(0, 160),
  });

  const notes = serializeIncubatorNotes(run, humanNotes).slice(0, 8000);
  const stage = safeVentureStage(program.ventureStage);

  if (networkIdRaw) {
    await prisma.nexusVentureState.upsert({
      where: { networkId: networkIdRaw },
      create: { networkId: networkIdRaw, stage, incubatorNotes: notes },
      update: { stage, incubatorNotes: notes },
    });
  } else {
    await prisma.nexusVentureState.upsert({
      where: { companyId },
      create: { companyId, stage, incubatorNotes: notes },
      update: { stage, incubatorNotes: notes },
    });
  }

  return NextResponse.json({
    ok: true,
    createdCount: created.length,
    taskIds: created,
    atCaseIds,
    engagementId: atEngagementId || null,
  });
}
