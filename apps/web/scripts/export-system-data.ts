/**
 * Exporta utilizadores (sem hashes de password) e o resto dos dados Prisma para JSON.
 *
 * Uso (pasta apps/web, com Postgres acessível e .env com DATABASE_URL):
 *   npm run export:system
 *
 * Saída: exports/system-export-<ISO-timestamp>/
 */

import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/** BigInt e outros tipos que JSON.stringify não trata. */
function replacer(_key: string, value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value;
}

type Manifest = {
  exportedAt: string;
  databaseHost: string;
  models: Record<string, { count: number; file: string; error?: string }>;
};

function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return '(não definido)';
  return url.replace(/:([^:@/]+)@/, ':****@');
}

function sanitizeRow(model: string, row: Record<string, unknown>): Record<string, unknown> {
  if (model === 'user') {
    const { password, ...rest } = row;
    return {
      ...rest,
      passwordIsSet: Boolean(typeof password === 'string' && password.length > 0),
    };
  }
  if (model === 'account') {
    const {
      refresh_token,
      access_token,
      id_token,
      ...rest
    } = row as Record<string, unknown>;
    return {
      ...rest,
      oauthTokensPresent: Boolean(refresh_token || access_token || id_token),
    };
  }
  return row;
}

function getModelDelegates(): string[] {
  return Object.keys(prisma).filter(
    (key) =>
      !key.startsWith('$') &&
      !key.startsWith('_') &&
      typeof (prisma as unknown as Record<string, { findMany?: unknown }>)[key]?.findMany === 'function'
  );
}

async function main() {
  const outDir = path.join(
    process.cwd(),
    'exports',
    `system-export-${new Date().toISOString().replace(/[:.]/g, '-')}`
  );
  await mkdir(outDir, { recursive: true });

  const manifest: Manifest = {
    exportedAt: new Date().toISOString(),
    databaseHost: maskDatabaseUrl(process.env.DATABASE_URL),
    models: {},
  };

  try {
    await prisma.$connect();
  } catch (e) {
    console.error('Não foi possível ligar à base. Verifique DATABASE_URL e se o Postgres está a correr.\n', e);
    process.exit(1);
  }

  const delegates = getModelDelegates().sort();

  for (const model of delegates) {
    const fileName = `${model}.json`;
    const filePath = path.join(outDir, fileName);
    try {
      const delegate = (prisma as unknown as Record<string, { findMany: (args?: object) => Promise<unknown[]> }>)[
        model
      ];
      const rows = await delegate.findMany();
      const sanitized = rows.map((r) => sanitizeRow(model, r as Record<string, unknown>));
      await writeFile(filePath, JSON.stringify(sanitized, replacer, 2), 'utf-8');
      manifest.models[model] = { count: sanitized.length, file: fileName };
      console.log(`✓ ${model}: ${sanitized.length} registos → ${fileName}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Base antiga sem colunas novas do schema (ex.: ChatMessage.fileType) — exportar via SQL.
      if (model === 'chatMessage') {
        try {
          const rows = (await prisma.$queryRaw(
            Prisma.sql`SELECT * FROM "ChatMessage"`
          )) as Record<string, unknown>[];
          await writeFile(filePath, JSON.stringify(rows, replacer, 2), 'utf-8');
          manifest.models[model] = {
            count: rows.length,
            file: fileName,
            error: 'Exportação SQL raw (tabela sem algumas colunas do schema Prisma atual). Corra: npx prisma db push',
          };
          console.log(
            `✓ ${model}: ${rows.length} registos → ${fileName} (SQL raw; alinhe o DB com prisma db push)`
          );
          continue;
        } catch (e2) {
          const msg2 = e2 instanceof Error ? e2.message : String(e2);
          manifest.models[model] = { count: 0, file: fileName, error: `${msg} | fallback: ${msg2}` };
          console.error(`✗ ${model}: ${msg2}`);
          continue;
        }
      }
      manifest.models[model] = { count: 0, file: fileName, error: msg };
      console.error(`✗ ${model}: ${msg}`);
    }
  }

  await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\nConcluído. Pasta: ${outDir}`);
  console.log('Resumo de utilizadores: veja user.json (campo passwordIsSet indica se login por senha é possível).');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
