/**
 * Refresh RADAR client demos (empty + advanced).
 *
 * Uso (apps/web, contra a BD alvo — local ou Contabo via DATABASE_URL):
 *   npx tsx --require dotenv/config scripts/seed-radar-demos.ts
 *   npm run seed:radar-demos
 *
 * Env:
 *   SANDBOX_PASSWORD=...   (default EtholysSandbox2026!)
 *   DATABASE_URL=...
 *
 * Contas (mesma senha):
 *   demo.campo.novo@etholys.com     — empresa vazia / first-run
 *   master.horizonte@etholys.com    — Horizonte Verde preenchida
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { RADAR_DEMO_LOGINS, seedRadarDemos } from '../lib/sandbox/seed-radar-demos';

async function main() {
  const password = process.env.SANDBOX_PASSWORD || 'EtholysSandbox2026!';
  const hash = await bcrypt.hash(password, 10);
  const prisma = new PrismaClient();
  try {
    const result = await seedRadarDemos(prisma, { passwordHash: hash });
    console.log('\n=== RADAR demos ===\n');
    for (const line of result.summary) console.log('•', line);
    console.log('\nCredenciais (mesma senha):');
    console.log(`  ${RADAR_DEMO_LOGINS.empty.email}     — empty / first-run`);
    console.log(`  ${RADAR_DEMO_LOGINS.advanced.email}  — advanced farm`);
    console.log(`  Senha: ${password}`);
    console.log('\nApós deploys futuros: npm run seed:radar-demos (com DATABASE_URL da BD alvo).\n');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
