import 'server-only';

import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export const PASSPORT_SHARE_CATEGORY = 'fundhub_passport_share';
const TOKEN_PREFIX = 'tok:';
const META_PREFIX = 'meta:';

export type PassportShareMeta = {
  token: string;
  enabled: boolean;
  createdAt: string;
  createdByUserId?: string;
};

function parseMeta(raw: string | null | undefined): PassportShareMeta | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as PassportShareMeta;
    if (typeof d.token !== 'string' || typeof d.enabled !== 'boolean') return null;
    return d;
  } catch {
    return null;
  }
}

export async function getPassportShareMeta(companyId: string): Promise<PassportShareMeta | null> {
  const row = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: PASSPORT_SHARE_CATEGORY, key: `${META_PREFIX}${companyId}` },
  });
  return parseMeta(row?.value);
}

export async function resolveCompanyIdFromShareToken(token: string): Promise<string | null> {
  const clean = token.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(clean)) return null;

  const row = await prisma.aiCompanyMemory.findFirst({
    where: { category: PASSPORT_SHARE_CATEGORY, key: `${TOKEN_PREFIX}${clean}` },
    select: { value: true },
  });
  const companyId = row?.value?.trim();
  if (!companyId) return null;

  const meta = await getPassportShareMeta(companyId);
  if (!meta?.enabled || meta.token !== clean) return null;

  return companyId;
}

async function upsertMemoryRow(
  companyId: string,
  key: string,
  value: string,
  source: string,
): Promise<void> {
  const existing = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: PASSPORT_SHARE_CATEGORY, key },
  });
  if (existing) {
    await prisma.aiCompanyMemory.update({
      where: { id: existing.id },
      data: { value, source },
    });
  } else {
    await prisma.aiCompanyMemory.create({
      data: { companyId, category: PASSPORT_SHARE_CATEGORY, key, value, source },
    });
  }
}

export async function enablePassportShare(
  companyId: string,
  userId: string,
): Promise<PassportShareMeta> {
  const existing = await getPassportShareMeta(companyId);
  if (existing?.enabled) return existing;

  const token = randomBytes(16).toString('hex');
  const meta: PassportShareMeta = {
    token,
    enabled: true,
    createdAt: new Date().toISOString(),
    createdByUserId: userId,
  };

  await upsertMemoryRow(companyId, `${META_PREFIX}${companyId}`, JSON.stringify(meta), `passport-share:${userId}`);
  await upsertMemoryRow(companyId, `${TOKEN_PREFIX}${token}`, companyId, `passport-share:${userId}`);

  return meta;
}

export async function revokePassportShare(companyId: string, userId: string): Promise<void> {
  const meta = await getPassportShareMeta(companyId);
  if (!meta) return;

  const disabled: PassportShareMeta = { ...meta, enabled: false };
  await upsertMemoryRow(
    companyId,
    `${META_PREFIX}${companyId}`,
    JSON.stringify(disabled),
    `passport-share-revoke:${userId}`,
  );

  const tokRow = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: PASSPORT_SHARE_CATEGORY, key: `${TOKEN_PREFIX}${meta.token}` },
  });
  if (tokRow) {
    await prisma.aiCompanyMemory.delete({ where: { id: tokRow.id } });
  }
}
