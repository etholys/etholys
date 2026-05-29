export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadNetworkForTenant } from '@/lib/nexus-network';
import {
  INTERNATIONAL_READINESS_ITEMS,
  internationalReadinessScore,
  isValidStage,
  parseInternationalChecklist,
  type VentureStageId,
  VENTURE_STAGES,
  VENTURE_STAGE_ORDER,
} from '@/lib/nexus-venture';
import { safeVentureStage } from '@/lib/nexus-guides';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const networkIdParam = req.nextUrl.searchParams.get('networkId');
  const companyIdParam = req.nextUrl.searchParams.get('companyId');

  if (networkIdParam) {
    const network = await loadNetworkForTenant(networkIdParam, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });
    const state = await prisma.nexusVentureState.findUnique({ where: { networkId: network.id } });
    const checklist = parseInternationalChecklist(state?.internationalChecklist);
    return NextResponse.json({
      scope: 'network' as const,
      networkId: network.id,
      stage: safeVentureStage(state?.stage),
      targetRegions: state?.targetRegions ?? '',
      checklist,
      incubatorNotes: state?.incubatorNotes ?? '',
      internationalScore: internationalReadinessScore(checklist),
      stages: VENTURE_STAGES,
      intlItems: INTERNATIONAL_READINESS_ITEMS,
      stageOrder: VENTURE_STAGE_ORDER,
    });
  }

  const companyId =
    companyIdParam && tenant.companyIds.includes(companyIdParam)
      ? companyIdParam
      : tenant.companyIds[0] || null;
  if (!companyId) return NextResponse.json({ error: 'Sem empresa associada.' }, { status: 400 });

  const state = await prisma.nexusVentureState.findUnique({ where: { companyId } });
  const checklist = parseInternationalChecklist(state?.internationalChecklist);
  return NextResponse.json({
    scope: 'company' as const,
    companyId,
    stage: safeVentureStage(state?.stage),
    targetRegions: state?.targetRegions ?? '',
    checklist,
    incubatorNotes: state?.incubatorNotes ?? '',
    internationalScore: internationalReadinessScore(checklist),
    stages: VENTURE_STAGES,
    intlItems: INTERNATIONAL_READINESS_ITEMS,
    stageOrder: VENTURE_STAGE_ORDER,
  });
}

export async function PATCH(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido.' }, { status: 400 });
  }

  const networkIdRaw = String(body.networkId || '').trim();
  const companyIdRaw = String(body.companyId || '').trim();

  const mergeChecklist = (existing: unknown, patch: unknown) => {
    const base = parseInternationalChecklist(existing);
    if (patch && typeof patch === 'object' && !Array.isArray(patch)) {
      for (const item of INTERNATIONAL_READINESS_ITEMS) {
        const v = (patch as Record<string, unknown>)[item.id];
        if (typeof v === 'boolean') base[item.id] = v;
      }
    }
    return base;
  };

  const resolveStage = (existingStage: string | null | undefined): VentureStageId => {
    let s: VentureStageId =
      existingStage && isValidStage(existingStage) ? (existingStage as VentureStageId) : 'DISCOVER';
    if (body.stage !== undefined && body.stage !== null) {
      const raw = String(body.stage).trim();
      if (raw && isValidStage(raw)) s = raw as VentureStageId;
    }
    return s;
  };

  if (networkIdRaw) {
    const network = await loadNetworkForTenant(networkIdRaw, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });
    const existing = await prisma.nexusVentureState.findUnique({ where: { networkId: network.id } });
    const stage = resolveStage(existing?.stage);
    const checklist =
      body.checklist !== undefined
        ? mergeChecklist(existing?.internationalChecklist, body.checklist)
        : parseInternationalChecklist(existing?.internationalChecklist);
    const targetRegions =
      body.targetRegions !== undefined ? String(body.targetRegions).slice(0, 2000) || null : existing?.targetRegions ?? null;
    const incubatorNotes =
      body.incubatorNotes !== undefined ? String(body.incubatorNotes).slice(0, 8000) || null : existing?.incubatorNotes ?? null;

    const updateData: Record<string, unknown> = { stage, internationalChecklist: checklist };
    if (body.targetRegions !== undefined) updateData.targetRegions = targetRegions;
    if (body.incubatorNotes !== undefined) updateData.incubatorNotes = incubatorNotes;

    await prisma.nexusVentureState.upsert({
      where: { networkId: network.id },
      create: {
        networkId: network.id,
        stage,
        targetRegions,
        internationalChecklist: checklist,
        incubatorNotes,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      update: updateData as any,
    });
    return NextResponse.json({
      ok: true,
      internationalScore: internationalReadinessScore(checklist),
    });
  }

  const companyId =
    companyIdRaw && tenant.companyIds.includes(companyIdRaw) ? companyIdRaw : tenant.companyIds[0] || null;
  if (!companyId) return NextResponse.json({ error: 'Sem empresa associada.' }, { status: 400 });

  const existing = await prisma.nexusVentureState.findUnique({ where: { companyId } });
  const stage = resolveStage(existing?.stage);
  const checklist =
    body.checklist !== undefined
      ? mergeChecklist(existing?.internationalChecklist, body.checklist)
      : parseInternationalChecklist(existing?.internationalChecklist);
  const targetRegions =
    body.targetRegions !== undefined ? String(body.targetRegions).slice(0, 2000) || null : existing?.targetRegions ?? null;
  const incubatorNotes =
    body.incubatorNotes !== undefined ? String(body.incubatorNotes).slice(0, 8000) || null : existing?.incubatorNotes ?? null;

  const updateDataCo: Record<string, unknown> = { stage, internationalChecklist: checklist };
  if (body.targetRegions !== undefined) updateDataCo.targetRegions = targetRegions;
  if (body.incubatorNotes !== undefined) updateDataCo.incubatorNotes = incubatorNotes;

  await prisma.nexusVentureState.upsert({
    where: { companyId },
    create: {
      companyId,
      stage,
      targetRegions,
      internationalChecklist: checklist,
      incubatorNotes,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update: updateDataCo as any,
  });

  return NextResponse.json({
    ok: true,
    internationalScore: internationalReadinessScore(checklist),
  });
}
