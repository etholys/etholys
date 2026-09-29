import { isAttendedMemberRole } from './nexus-at-shared';

/** Uma semana + um dia — ritmo “desta semana” ainda conta na segunda. */
export const AURORA_RHYTHM_STALE_MS = 8 * 24 * 60 * 60 * 1000;

export type AuroraMethodStage = 'talk' | 'portrait' | 'bets' | 'rhythm' | 'steady';

export function auroraMethodStage(input: {
  hasPortrait: boolean;
  hypothesisAccepted: boolean;
  openBetCount: number;
  lastRhythmAt: Date | string | null;
  now?: Date;
}): AuroraMethodStage {
  if (!input.hasPortrait) return 'talk';
  if (!input.hypothesisAccepted) return 'portrait';
  if (input.openBetCount < 2) return 'bets';
  const at = input.lastRhythmAt ? new Date(input.lastRhythmAt).getTime() : 0;
  if (!at || Number.isNaN(at)) return 'rhythm';
  const now = (input.now ?? new Date()).getTime();
  if (now - at > AURORA_RHYTHM_STALE_MS) return 'rhythm';
  return 'steady';
}

export type AuroraAttendedBusiness = {
  companyId: string;
  name: string;
  shortName: string;
  engagementId: string;
  engagementTitle: string;
  /** Empresa incubadora / operadora do contrato AT (camada Hub). */
  operatorCompanyId: string;
};

export function collectAttendedBusinesses(
  engagements: Array<{
    id: string;
    title: string;
    updatedAt: Date;
    operatorCompanyId?: string;
    members: Array<{
      companyId: string;
      memberRole: string;
      company: { name: string; shortName: string };
    }>;
  }>
): AuroraAttendedBusiness[] {
  const byCompany = new Map<string, AuroraAttendedBusiness & { updatedAt: Date }>();
  for (const engagement of engagements) {
    const operatorCompanyId = String(engagement.operatorCompanyId || '').trim();
    for (const member of engagement.members) {
      if (!isAttendedMemberRole(member.memberRole)) continue;
      const prev = byCompany.get(member.companyId);
      if (prev && prev.updatedAt >= engagement.updatedAt) continue;
      byCompany.set(member.companyId, {
        companyId: member.companyId,
        name: member.company.name,
        shortName: member.company.shortName,
        engagementId: engagement.id,
        engagementTitle: engagement.title,
        operatorCompanyId,
        updatedAt: engagement.updatedAt,
      });
    }
  }
  return [...byCompany.values()]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map(({ updatedAt: _updatedAt, ...row }) => row);
}

export type AuroraPortfolioItem = AuroraAttendedBusiness & {
  hasPortrait: boolean;
  hypothesisAccepted: boolean;
  hypothesis: string;
  openBetCount: number;
  betTitles: string[];
  lastRhythmAt: string | null;
  lastRhythmHappened: string;
  lastRhythmBlocked: string;
  lastRhythmNext: string;
  portraitPreview: string;
  technicianName: string;
  technicianUserId: string;
  mine: boolean;
  stage: AuroraMethodStage;
  dueBetTitles: string[];
  diagnosticDone: number;
  diagnosticTotal: number;
  diagnosticComplete: boolean;
  diagnosticAvg: number | null;
};

export const AURORA_STAGE_ORDER: Record<AuroraMethodStage, number> = {
  talk: 0,
  portrait: 1,
  bets: 2,
  rhythm: 3,
  steady: 4,
};
