import 'server-only';

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';

export const COALITION_CATEGORY = 'fundhub_coalition';
export const COALITION_KEY = 'members_v1';
const MAX_MEMBERS = 20;

export type CoalitionMember = {
  id: string;
  orgName: string;
  country?: string;
  role: string;
  contactEmail?: string;
  addedAt: string;
};

export type CoalitionPayload = { members: CoalitionMember[] };

function parsePayload(raw: string | null | undefined): CoalitionPayload {
  if (!raw) return { members: [] };
  try {
    const d = JSON.parse(raw) as { members?: unknown };
    if (!Array.isArray(d.members)) return { members: [] };
    const members: CoalitionMember[] = [];
    for (const it of d.members) {
      if (!it || typeof it !== 'object') continue;
      const o = it as Record<string, unknown>;
      if (typeof o.id === 'string' && typeof o.orgName === 'string' && typeof o.role === 'string') {
        members.push({
          id: o.id,
          orgName: o.orgName.slice(0, 200),
          country: typeof o.country === 'string' ? o.country.slice(0, 80) : undefined,
          role: o.role.slice(0, 300),
          contactEmail: typeof o.contactEmail === 'string' ? o.contactEmail.slice(0, 200) : undefined,
          addedAt: typeof o.addedAt === 'string' ? o.addedAt : new Date().toISOString(),
        });
      }
    }
    return { members: members.slice(0, MAX_MEMBERS) };
  } catch {
    return { members: [] };
  }
}

export async function readCoalition(companyId: string): Promise<CoalitionPayload> {
  const row = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: COALITION_CATEGORY, key: COALITION_KEY },
  });
  return parsePayload(row?.value);
}

export async function writeCoalition(
  companyId: string,
  payload: CoalitionPayload,
  source: string,
): Promise<CoalitionPayload> {
  const value = JSON.stringify({ members: payload.members.slice(0, MAX_MEMBERS) });
  const existing = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: COALITION_CATEGORY, key: COALITION_KEY },
  });
  if (existing) {
    await prisma.aiCompanyMemory.update({ where: { id: existing.id }, data: { value, source } });
  } else {
    await prisma.aiCompanyMemory.create({
      data: { companyId, category: COALITION_CATEGORY, key: COALITION_KEY, value, source },
    });
  }
  return parsePayload(value);
}

export function newCoalitionMember(input: {
  orgName: string;
  country?: string;
  role: string;
  contactEmail?: string;
}): CoalitionMember {
  return {
    id: randomUUID(),
    orgName: input.orgName.trim().slice(0, 200),
    country: input.country?.trim().slice(0, 80),
    role: input.role.trim().slice(0, 300),
    contactEmail: input.contactEmail?.trim().slice(0, 200),
    addedAt: new Date().toISOString(),
  };
}
