/** Uso: npx tsx --require dotenv/config scripts/find-user.ts [email] */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const needle = (process.argv[2] || 'tiagorezende@ruralcommerceglobal.com').trim().toLowerCase();

async function main() {
  await prisma.$connect();
  const all = await prisma.user.findMany({
    select: { id: true, email: true, isActive: true, password: true },
  });
  const match = all.filter((u) => u.email.toLowerCase() === needle);
  console.log('DATABASE_URL host:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':****@'));
  console.log('Total users:', all.length);
  console.log('Procurado:', needle);
  console.log(
    'Encontrado:',
    match.length
      ? match.map((u) => ({
          id: u.id,
          email: u.email,
          isActive: u.isActive,
          hasPassword: Boolean(u.password && u.password.length > 0),
        }))
      : 'NENHUM (email exato, case-insensitive na lista carregada)'
  );
  if (all.length <= 30) {
    console.log('Todos os emails:', all.map((u) => u.email));
  } else {
    console.log('Amostra (20):', all.slice(0, 20).map((u) => u.email));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
