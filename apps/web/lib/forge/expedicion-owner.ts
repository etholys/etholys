import { getForgeDb } from '@/lib/forge/db';

import { EXPEDICION_OWNER_EMAIL } from '@/lib/forge/expedicion-owner-constants';

export { EXPEDICION_OWNER_EMAIL };

export async function getExpedicionOwner() {
  return getForgeDb().user.findUnique({
    where: { email: EXPEDICION_OWNER_EMAIL.toLowerCase() },
    include: {
      companyUsers: {
        include: { company: { select: { id: true, name: true, shortName: true } } },
      },
    },
  });
}

export function isExpedicionOwnerEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === EXPEDICION_OWNER_EMAIL.toLowerCase();
}

export async function isExpedicionOwnerUserId(userId: string): Promise<boolean> {
  const u = await getForgeDb().user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return isExpedicionOwnerEmail(u?.email);
}

export async function assertExpedicionOwnerCompany(companyId: string): Promise<void> {
  const owner = await getExpedicionOwner();
  if (!owner) {
    throw new Error(`Titular no encontrado (${EXPEDICION_OWNER_EMAIL}).`);
  }
  const allowed = new Set(owner.companyUsers.map((cu) => cu.companyId));
  if (!allowed.has(companyId)) {
    throw new Error(
      'La Expedición Sostenible solo puede publicarse en las empresas del titular del programa (Rural Commerce).'
    );
  }
}

export async function getExpedicionOwnerCompanyIds(): Promise<
  { userId: string; companyIds: string[]; companies: { id: string; name: string }[] }
> {
  const owner = await getExpedicionOwner();
  if (!owner) {
    throw new Error(`Utilizador titular não encontrado: ${EXPEDICION_OWNER_EMAIL}`);
  }
  const companies = owner.companyUsers.map((cu) => cu.company);
  return {
    userId: owner.id,
    companyIds: companies.map((c) => c.id),
    companies,
  };
}
