/**
 * Cria 2 utilizadores internos Etholys + empresa SANDBOX com dados fictícios em todos os sistemas.
 *
 * Uso (apps/web):
 *   npx tsx --require dotenv/config scripts/seed-internal-sandbox.ts
 *   npx tsx --require dotenv/config scripts/seed-internal-sandbox.ts --force
 *
 * Env:
 *   SANDBOX_PASSWORD=...   (default EtholysSandbox2026!)
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedInternalSandbox, SANDBOX_USERS } from '../lib/sandbox/seed-internal-sandbox';

async function main() {
  const force = process.argv.includes('--force');
  const password = process.env.SANDBOX_PASSWORD || 'EtholysSandbox2026!';
  const hash = await bcrypt.hash(password, 10);
  const prisma = new PrismaClient();

  try {
    const result = await seedInternalSandbox(prisma, {
      passwordHash: hash,
      forceReseed: force,
    });

    console.log('\n=== Etholys Sandbox ===\n');
    for (const line of result.summary) console.log('•', line);
    console.log('\nEmpresa:', result.companyName, `(${result.companyId})`);
    console.log('Dados criados agora:', result.createdData ? 'sim' : 'não (já existiam)');
    console.log('\nCredenciais (mesma senha para ambos):');
    for (const u of SANDBOX_USERS) {
      console.log(`  ${u.email}  —  ${u.name}`);
    }
    console.log(`  Senha: ${password}`);
    console.log('\nLogin: /login → Hub completo (ADMIN da empresa sandbox).');
    console.log('Sistemas: ATLAS, SIEP, FUNDHUB, NEXUS, FORGE, PRISM.\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
