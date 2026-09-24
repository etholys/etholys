import { prisma } from './prisma';
import { normalizeSectorIdList } from './nexus-economic-sectors';

export type PersistDiagnosisInput = {
  companyId: string;
  createdByUserId: string;
  engagementId?: string | null;
  sectorIds?: unknown;
  sectorId?: unknown;
  overall?: number;
  scoresJson?: unknown;
  answersJson?: unknown;
};

export async function persistNexusDiagnosis(input: PersistDiagnosisInput) {
  const sectorIds = normalizeSectorIdList({
    sectorIds: input.sectorIds,
    sectorId: input.sectorId,
  });
  const overall = Number.isFinite(input.overall) ? Math.round(Number(input.overall)) : 0;
  return prisma.nexusDiagnosis.create({
    data: {
      companyId: input.companyId,
      createdByUserId: input.createdByUserId,
      engagementId: input.engagementId || null,
      sectorIds,
      overall: Math.max(0, Math.min(100, overall)),
      scoresJson: (input.scoresJson && typeof input.scoresJson === 'object' ? input.scoresJson : {}) as object,
      answersJson: (input.answersJson && typeof input.answersJson === 'object' ? input.answersJson : {}) as object,
    },
    select: {
      id: true,
      companyId: true,
      engagementId: true,
      sectorIds: true,
      overall: true,
      scoresJson: true,
      createdAt: true,
    },
  });
}
