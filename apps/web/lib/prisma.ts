import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

type PrismaRuntimeDmmf = {
  _runtimeDataModel?: { models: Record<string, { fields: Record<string, unknown> }> };
};

function forgeReady(client: PrismaClient): boolean {
  if (typeof client.forgeCourse?.findMany !== 'function') return false;
  try {
    const dmmf = (client as unknown as PrismaRuntimeDmmf)._runtimeDataModel;
    return Boolean(dmmf?.models?.ForgeEnrollment?.fields?.inviteToken);
  } catch {
    return false;
  }
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

function resolvePrisma(): PrismaClient {
  const cached = globalForPrisma.prisma;
  if (cached && forgeReady(cached)) return cached;

  if (cached) {
    delete globalForPrisma.prisma;
    void cached.$disconnect().catch(() => undefined);
  }

  const client = createPrismaClient();
  if (!forgeReady(client) && process.env.NODE_ENV !== 'production') {
    console.warn(
      '[prisma] Modelos FORGE ausentes no client. Execute: cd apps/web && npx prisma generate && npm run dev:clean'
    );
  }

  globalForPrisma.prisma = client;
  return client;
}

export function getPrisma(): PrismaClient {
  return resolvePrisma();
}

export const prisma = getPrisma();
