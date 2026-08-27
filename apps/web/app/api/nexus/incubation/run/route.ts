export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';
import { safeVentureStage } from '@/lib/nexus-guides';
import {
  defaultIncubationRun,
  diagnosisFromAnalyze,
  normalizeIncubationRun,
  parseIncubationRunFromNotes,
  parseHumanNotesFromIncubatorNotes,
  pushAdvance,
  recordDiagnosis,
  serializeIncubatorNotes,
  syncLayerProgressFromTasks,
  type ImplementedTool,
  type IncubationRun,
} from '@/lib/nexus-incubation-run';
import { normalizeProgram } from '@/lib/nexus-incubation-program';
import type { DiagnosticAnalyzeResult } from '@/lib/nexus-diagnostic-analyze';

async function resolveScope(
  tenant: NonNullable<Awaited<ReturnType<typeof getUserCompanyIds>>>,
  networkIdRaw: string,
  companyIdRaw: string,
) {
  if (networkIdRaw) {
    const network = await loadNetworkForTenant(networkIdRaw, tenant.companyIds);
    if (!network) return null;
    const ids = memberCompanyIds(network);
    const companyId = companyIdRaw && ids.includes(companyIdRaw) ? companyIdRaw : network.anchorCompanyId;
    return { networkId: network.id, companyId, memberIds: ids };
  }
  const companyId =
    companyIdRaw && tenant.companyIds.includes(companyIdRaw) ? companyIdRaw : tenant.companyIds[0] || '';
  if (!companyId) return null;
  return { networkId: null as string | null, companyId, memberIds: [companyId] };
}

async function loadVentureNotes(networkId: string | null, companyId: string) {
  if (networkId) {
    const state = await prisma.nexusVentureState.findUnique({ where: { networkId } });
    return state?.incubatorNotes ?? '';
  }
  const state = await prisma.nexusVentureState.findUnique({ where: { companyId } });
  return state?.incubatorNotes ?? '';
}

async function saveVentureNotes(
  networkId: string | null,
  companyId: string,
  notes: string,
  stage?: string,
) {
  const st = safeVentureStage(stage);
  if (networkId) {
    await prisma.nexusVentureState.upsert({
      where: { networkId },
      create: { networkId, stage: st, incubatorNotes: notes },
      update: { incubatorNotes: notes, ...(stage ? { stage: st } : {}) },
    });
  } else {
    await prisma.nexusVentureState.upsert({
      where: { companyId },
      create: { companyId, stage: st, incubatorNotes: notes },
      update: { incubatorNotes: notes, ...(stage ? { stage: st } : {}) },
    });
  }
}

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const networkIdRaw = String(req.nextUrl.searchParams.get('networkId') || '').trim();
  const companyIdRaw = String(req.nextUrl.searchParams.get('companyId') || '').trim();
  const scope = await resolveScope(tenant, networkIdRaw, companyIdRaw);
  if (!scope) return NextResponse.json({ error: 'Âmbito inválido.' }, { status: 400 });

  const notes = await loadVentureNotes(scope.networkId, scope.companyId);
  let run = parseIncubationRunFromNotes(notes);
  const humanNotes = parseHumanNotesFromIncubatorNotes(notes);

  if (!run) {
    return NextResponse.json({ run: null, progress: null, humanNotes, companyId: scope.companyId });
  }

  const tasks = await prisma.task.findMany({
    where: {
      companyId: scope.companyId,
      isActive: true,
      tags: { contains: 'nexus:incubation' },
    },
    select: { id: true, status: true, tags: true, description: true },
    take: 200,
  });

  const synced = syncLayerProgressFromTasks(run, tasks);
  run = synced.run;

  return NextResponse.json({
    run,
    progress: synced.progress,
    humanNotes,
    companyId: scope.companyId,
    networkId: scope.networkId,
  });
}

export async function PUT(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const networkIdRaw = String(body.networkId || '').trim();
  const companyIdRaw = String(body.companyId || body.targetCompanyId || '').trim();
  const scope = await resolveScope(tenant, networkIdRaw, companyIdRaw);
  if (!scope) return NextResponse.json({ error: 'Âmbito inválido.' }, { status: 400 });

  const existingNotes = await loadVentureNotes(scope.networkId, scope.companyId);
  const humanNotes = parseHumanNotesFromIncubatorNotes(existingNotes);
  let run = parseIncubationRunFromNotes(existingNotes) || defaultIncubationRun(normalizeProgram(body.program as never), {
    companyId: scope.companyId,
    networkId: scope.networkId,
  });

  if (body.program) {
    run = { ...run, program: normalizeProgram({ ...run.program, ...(body.program as object) }) };
  }

  if (body.analyze && body.sectorId) {
    const snap = diagnosisFromAnalyze(body.analyze as DiagnosticAnalyzeResult, String(body.sectorId));
    run = recordDiagnosis(run, snap);
    if (body.program && typeof body.program === 'object') {
      run.program = normalizeProgram({ ...run.program, ...(body.program as object) });
    }
  }

  if (body.action === 'add_tool') {
    const tool = body.tool as ImplementedTool;
    if (tool?.name?.trim()) {
      run = pushAdvance(
        {
          ...run,
          toolsImplemented: [
            {
              id: tool.id || `tool-${Date.now()}`,
              name: String(tool.name).slice(0, 120),
              category: tool.category || 'other',
              implementedAt: new Date().toISOString(),
              notes: tool.notes?.slice(0, 500),
            },
            ...run.toolsImplemented,
          ].slice(0, 40),
        },
        { type: 'tool', label: `Ferramenta: ${String(tool.name).slice(0, 80)}` },
      );
    }
  }

  if (body.action === 'advance_layer') {
    const idx = Number(body.layerIndex);
    if (Number.isFinite(idx)) {
      run = pushAdvance(run, {
        type: 'layer_complete',
        label: `Camada ${idx + 1} concluída`,
      });
      run = {
        ...run,
        currentLayerIndex: Math.min(run.layers.length - 1, idx + 1),
        layers: run.layers.map((l) =>
          l.index === idx
            ? { ...l, status: 'completed' }
            : l.index === idx + 1
              ? { ...l, status: 'active' }
              : l,
        ),
      };
    }
  }

  if (body.run && typeof body.run === 'object') {
    run = normalizeIncubationRun({ ...run, ...(body.run as Partial<IncubationRun>) });
  }

  run.targetCompanyId = scope.companyId;
  run.networkId = scope.networkId;

  const notes = serializeIncubatorNotes(run, humanNotes);
  await saveVentureNotes(scope.networkId, scope.companyId, notes.slice(0, 8000), run.program.ventureStage);

  const tasks = await prisma.task.findMany({
    where: { companyId: scope.companyId, isActive: true, tags: { contains: 'nexus:incubation' } },
    select: { id: true, status: true, tags: true, description: true },
    take: 200,
  });
  const synced = syncLayerProgressFromTasks(run, tasks);

  return NextResponse.json({ ok: true, run: synced.run, progress: synced.progress });
}
