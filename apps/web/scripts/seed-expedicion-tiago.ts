/**
 * Publica / actualiza La Expedición Sostenible en todas las empresas de Tiago Rezende.
 * Uso: npx tsx --require dotenv/config scripts/seed-expedicion-tiago.ts [--replace]
 */
import { getForgeDb } from '../lib/forge/db';
import { seedExpedicionForOwner } from '../lib/forge/seed-expedicion-for-owner';

async function main() {
  const replace = !process.argv.includes('--no-replace');
  const result = await seedExpedicionForOwner({ replace });
  console.log('Titular:', result.ownerEmail);
  for (const c of result.courses) {
    console.log(`  ${c.companyName} → ${c.courseId}`);
    console.log(`    http://localhost:3000/hub/forge/cursos/${c.courseId}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => getForgeDb().$disconnect());
