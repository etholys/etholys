export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany, deriveOpsAlerts, loadCompanySectors } from '@/lib/nexus-ops';
import { resolveSectorModule } from '@/lib/nexus-sector-modules';

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const companyId = String(url.searchParams.get('companyId') || '').trim();
  const engagementId = String(url.searchParams.get('engagementId') || '').trim() || null;
  if (!companyId) return NextResponse.json({ error: 'companyId obrigatório.' }, { status: 400 });
  if (!(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 });
  }

  const sectors = await loadCompanySectors(companyId);
  const mod = resolveSectorModule(sectors);
  const [units, entries, sensors, readings, latestDx, alerts] = await Promise.all([
    prisma.nexusOpsUnit.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
      take: 40,
    }),
    prisma.nexusFieldEntry.findMany({
      where: { companyId },
      orderBy: { occurredAt: 'desc' },
      take: 8,
      include: { unit: { select: { id: true, name: true } } },
    }),
    prisma.nexusSensor.findMany({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, name: true, metric: true, unitId: true, lastSeenAt: true },
    }),
    prisma.nexusReading.findMany({
      where: { companyId },
      orderBy: { recordedAt: 'desc' },
      take: 12,
      include: { sensor: { select: { id: true, name: true } }, opsUnit: { select: { id: true, name: true } } },
    }),
    prisma.nexusDiagnosis.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, overall: true, sectorIds: true, createdAt: true },
    }),
    deriveOpsAlerts(companyId),
  ]);

  return NextResponse.json({
    companyId,
    sectorIds: sectors,
    module: {
      moduleId: mod.moduleId,
      unitKind: mod.unitKind,
      unitLabel: mod.unitLabel,
      bookLabel: mod.bookLabel,
      monitorLabel: mod.monitorLabel,
      intro: mod.intro,
      namePlaceholder: mod.namePlaceholder,
      showAreaHa: Boolean(mod.showAreaHa),
      qtyLabel: mod.qtyLabel || null,
      cropLabel: mod.cropLabel || null,
      entryKinds: mod.entryKinds,
      metrics: mod.metrics,
      protocols: mod.protocols.map((p) => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        dxQuestionIds: p.dxQuestionIds || [],
      })),
    },
    units,
    recentEntries: entries,
    sensors,
    readings: readings.map(({ opsUnit, ...r }) => ({ ...r, unit: opsUnit })),
    latestDiagnosis: latestDx,
    alerts,
  });
}
