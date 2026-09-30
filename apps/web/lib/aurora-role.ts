/**
 * Papel do utilizador no AURORA:
 * - incubator: opera AT (vê carteira, acompanha negócios externos)
 * - attended: é o negócio atendido (só vê o próprio avanço)
 */

import { listEngagementsForTenant } from './nexus-at';
import { isAttendedMemberRole } from './nexus-at-shared';

export type AuroraViewerRole = 'incubator' | 'attended';

export function pickAuroraViewerRole(input: { operates: boolean; attendedAs: boolean }): AuroraViewerRole {
  if (input.operates) return 'incubator';
  if (input.attendedAs) return 'attended';
  return 'incubator';
}

export type AuroraViewerContext = {
  role: AuroraViewerRole;
  activeCompanyId: string;
  /** Para attended: o próprio negócio + contrato AT. */
  self?: {
    companyId: string;
    engagementId: string;
    engagementTitle: string;
    companyName: string;
  } | null;
  operatesCount: number;
  attendedAsCount: number;
};

export async function resolveAuroraViewerContext(
  tenantCompanyIds: string[],
  activeCompanyId: string,
): Promise<AuroraViewerContext> {
  const active = String(activeCompanyId || '').trim();
  if (!active || !tenantCompanyIds.includes(active)) {
    return {
      role: 'incubator',
      activeCompanyId: active,
      self: null,
      operatesCount: 0,
      attendedAsCount: 0,
    };
  }

  const engagements = await listEngagementsForTenant(tenantCompanyIds);
  const asOperator = engagements.filter((e) => e.operatorCompanyId === active);
  const asAttended = engagements.filter((e) =>
    e.members.some((m) => m.companyId === active && isAttendedMemberRole(m.memberRole)),
  );

  const role = pickAuroraViewerRole({
    operates: asOperator.length > 0,
    attendedAs: asAttended.length > 0,
  });

  if (role === 'incubator') {
    return {
      role: 'incubator',
      activeCompanyId: active,
      self: null,
      operatesCount: asOperator.length,
      attendedAsCount: asAttended.length,
    };
  }

  const eng = [...asAttended].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0]!;
  const member = eng.members.find((m) => m.companyId === active);
  return {
    role: 'attended',
    activeCompanyId: active,
    self: {
      companyId: active,
      engagementId: eng.id,
      engagementTitle: eng.title,
      companyName: member?.company.name || member?.company.shortName || active,
    },
    operatesCount: 0,
    attendedAsCount: asAttended.length,
  };
}
