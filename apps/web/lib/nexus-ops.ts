import { prisma } from './prisma';
import { canAccessAtClientCompany } from './nexus-at';
import { parseCompanySectorIds } from './nexus-economic-sectors';
import { evaluateProtocolAlerts, resolveSectorModule, type DerivedAlert } from './nexus-sector-modules';

export {
  FIELD_ENTRY_KINDS,
  generateSensorToken,
  hashSensorToken,
  ingestCompanyForSensor,
  isFieldEntryKind,
  verifySensorToken,
} from './nexus-ops-token';
export type { FieldEntryKindId } from './nexus-ops-token';

/** Dono da empresa ou técnico AT do engagement. */
export async function canAccessNexusOpsCompany(
  tenantCompanyIds: string[],
  targetCompanyId: string,
  engagementId?: string | null
): Promise<boolean> {
  return canAccessAtClientCompany(tenantCompanyIds, targetCompanyId, engagementId);
}

export async function loadCompanySectors(companyId: string): Promise<string[]> {
  const row = await prisma.company.findFirst({
    where: { id: companyId, isActive: true },
    select: { contextSetupJson: true },
  });
  return parseCompanySectorIds(row?.contextSetupJson);
}

type InputPayload = {
  phiDays?: unknown;
  product?: unknown;
};

function phiDaysFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const n = Number((payload as InputPayload).phiDays);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function deriveOpsAlerts(companyId: string): Promise<DerivedAlert[]> {
  const sectors = await loadCompanySectors(companyId);
  const mod = resolveSectorModule(sectors);
  const now = new Date();

  const [lastEntry, lastInput, readings] = await Promise.all([
    prisma.nexusFieldEntry.findFirst({
      where: { companyId },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    }),
    prisma.nexusFieldEntry.findFirst({
      where: { companyId, kind: { in: ['input', 'health'] } },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true, payloadJson: true },
    }),
    prisma.nexusReading.findMany({
      where: { companyId },
      orderBy: { recordedAt: 'desc' },
      take: 40,
      select: { metric: true, value: true },
    }),
  ]);

  const lastReadingByMetric: Record<string, number> = {};
  for (const r of readings) {
    if (lastReadingByMetric[r.metric] == null) lastReadingByMetric[r.metric] = r.value;
  }

  return evaluateProtocolAlerts(mod.protocols, {
    now,
    lastEntryAt: lastEntry?.occurredAt ?? null,
    lastInputAt: lastInput?.occurredAt ?? null,
    lastInputPhiDays: phiDaysFromPayload(lastInput?.payloadJson),
    lastMoisture: lastReadingByMetric.soil_moisture ?? null,
    lastReadingByMetric,
  });
}
