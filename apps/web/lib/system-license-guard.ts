import 'server-only';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getWorkspaceAccessForUser, hasSystem } from '@/lib/integrated-workspace';
import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';
import { isLikelyDbId } from '@/lib/utils';

export type SystemLicenseDenyReason = 'disabled' | 'no_systems' | 'missing_system' | 'invalid_company';

export type SystemLicenseCheck =
  | { allowed: true; enforced: false }
  | { allowed: true; enforced: true; companyId: string }
  | { allowed: false; enforced: true; reason: SystemLicenseDenyReason; companyId: string };

export function readActiveCompanyCookie(req: NextRequest | Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/(?:^|;\s*)rc360_company=([^;]*)/);
  const raw = match?.[1] ? decodeURIComponent(match[1].trim()) : '';
  return isLikelyDbId(raw) ? raw : null;
}

export function resolveCompanyForLicense(
  tenant: { companyIds: string[] },
  req: NextRequest | Request,
  explicit?: string | null,
): string | null {
  const url = req.url ? new URL(req.url) : null;
  const fromQuery = url?.searchParams.get('companyId')?.trim() ?? '';
  const candidates = [explicit, fromQuery, readActiveCompanyCookie(req)]
    .map((s) => String(s ?? '').trim())
    .filter(Boolean);
  for (const c of candidates) {
    if (tenant.companyIds.includes(c)) return c;
  }
  return tenant.companyIds[0] || null;
}

/** Sem grant na BD → em pré-comercial negar; senão permitir (legado). */
export async function checkSystemLicense(
  userId: string,
  companyId: string,
  system: WorkspaceSystemKey,
): Promise<SystemLicenseCheck> {
  if (!isLikelyDbId(companyId)) {
    return { allowed: false, enforced: true, reason: 'invalid_company', companyId };
  }

  const access = await getWorkspaceAccessForUser(userId, companyId);
  if (!access.ok) {
    if (access.reason === 'no_record') {
      const { isPrecommercialMode, isPlatformFullAccess } = await import('@/lib/platform-access');
      if (isPrecommercialMode()) {
        const user = await import('@/lib/prisma').then((m) =>
          m.prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } }),
        );
        if (isPlatformFullAccess({ email: user?.email, role: user?.role })) {
          return { allowed: true, enforced: false };
        }
        const { isCompanyAdmin } = await import('@/lib/integrated-workspace');
        if (await isCompanyAdmin(userId, companyId)) {
          return { allowed: true, enforced: false };
        }
        return { allowed: false, enforced: true, reason: 'no_systems', companyId };
      }
      return { allowed: true, enforced: false };
    }
    return {
      allowed: false,
      enforced: true,
      reason: access.reason === 'disabled' ? 'disabled' : 'no_systems',
      companyId,
    };
  }

  if (!hasSystem(access, system)) {
    return { allowed: false, enforced: true, reason: 'missing_system', companyId };
  }

  return { allowed: true, enforced: true, companyId };
}

export function systemLicenseForbiddenResponse(system: WorkspaceSystemKey, reason: SystemLicenseDenyReason) {
  return NextResponse.json(
    {
      error: `Sem licença para ${system}.`,
      code: 'SYSTEM_LICENSE_FORBIDDEN',
      system,
      reason,
    },
    { status: 403 },
  );
}

export async function guardSystemLicense(
  userId: string,
  companyId: string,
  system: WorkspaceSystemKey,
): Promise<NextResponse | null> {
  const check = await checkSystemLicense(userId, companyId, system);
  if (!check.allowed) {
    return systemLicenseForbiddenResponse(system, check.reason);
  }
  return null;
}
