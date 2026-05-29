/**
 * Cria o curso "La Expedición Sostenible" na empresa indicada.
 * Uso: npx tsx --require dotenv/config scripts/seed-expedicion.ts [companyId] [userId]
 */
import { getForgeDb } from '../lib/forge/db';
import { seedExpedicionSostenibleCourse } from '../lib/forge/seed-expedicion-sostenible';

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== '--replace');
  const replace = process.argv.includes('--replace');
  const companyId = args[0] ?? process.env.SEED_COMPANY_ID;
  if (!companyId) {
    console.error('Indique companyId: npx tsx scripts/seed-expedicion.ts <companyId> [--replace]');
    process.exit(1);
  }

  let userId = args[1];
  if (!userId) {
    const link = await getForgeDb().companyUser.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    });
    userId = link?.userId;
  }
  if (!userId) {
    console.error('Nenhum utilizador na empresa', companyId);
    process.exit(1);
  }

  const user = await getForgeDb().user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error('userId inválido:', userId);
    process.exit(1);
  }
  const courseId = await seedExpedicionSostenibleCourse(companyId, userId, { replace });
  console.log('Curso criado:', courseId);
  console.log('URL: /hub/forge/cursos/' + courseId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => getForgeDb().$disconnect());
