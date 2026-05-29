/**
 * Falha o arranque se o client gerado não incluir modelos FORGE.
 * Uso: node scripts/verify-forge-prisma.mjs
 */
import { PrismaClient } from '@prisma/client';

const client = new PrismaClient();
const forgeKeys = Object.keys(client).filter((k) => k.startsWith('forge'));

if (typeof client.forgeCourse?.findMany !== 'function') {
  console.error(
    '[verify-forge-prisma] Client SEM modelos FORGE.',
    forgeKeys.length ? `Delegates parciais: ${forgeKeys.join(', ')}` : 'Nenhum delegate forge*.',
    '\nCorrija: npx prisma generate (em apps/web) ou reinicie o volume Docker node_modules.'
  );
  process.exit(1);
}

console.log('[verify-forge-prisma] OK:', forgeKeys.join(', '));
