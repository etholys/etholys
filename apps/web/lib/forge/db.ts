import type { PrismaClient } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';

/** Prisma partilhado; recria o singleton se o client em cache não tiver FORGE. */
export function getForgeDb(): PrismaClient {
  return getPrisma();
}
