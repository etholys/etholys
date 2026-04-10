/**
 * Diagnóstico rápido: ligação Postgres + utilizadores com password (login por email).
 * Executar na pasta apps/web: npx tsx --require dotenv/config scripts/diagnose-db.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('DATABASE_URL (host apenas):', maskUrl(process.env.DATABASE_URL));
  try {
    await prisma.$connect();
    console.log('✅ Prisma: ligação à base OK\n');
  } catch (e) {
    console.error('❌ Prisma: não conseguiu ligar. Verifique:\n');
    console.error('   - Postgres a correr (Docker: infra/docker-compose.yml → porta 5433 no host)\n');
    console.error('   - Em .env no PC: DATABASE_URL com localhost:5433 (não use hostname "postgres" fora do Docker)\n');
    console.error('Detalhe:', e);
    process.exit(1);
  }

  const total = await prisma.user.count();
  const withPassword = await prisma.user.count({ where: { password: { not: '' } } });
  console.log(`Utilizadores: ${total} total, ${withPassword} com password (login email/senha).`);

  if (withPassword === 0 && total > 0) {
    console.log('\n⚠️  Existem utilizadores mas nenhum tem password (ex.: só Google). Use registo com email ou faça seed.\n');
  }

  if (total === 0) {
    console.log('\n⚠️  Base vazia. Corra o seed (cria admin de desenvolvimento):\n');
    console.log('   npx prisma db seed\n');
    console.log('   Contas: admin@etholys.com / admin123  |  john@doe.com / johndoe123\n');
  } else {
    const samples = await prisma.user.findMany({
      take: 5,
      select: { email: true, isActive: true, password: true },
    });
    console.log('\nAmostra:');
    for (const u of samples) {
      const pw = u.password ? 'sim' : 'não (só OAuth ou vazio)';
      console.log(`  - ${u.email}  ativo=${u.isActive}  password=${pw}`);
    }
  }

  await prisma.$disconnect();
}

function maskUrl(url: string | undefined) {
  if (!url) return '(não definido)';
  const m = url.match(/@([^:/?]+)(?::(\d+))?/);
  if (m) return `${m[1]}:${m[2] || '(porta padrão)'}`;
  return '(formato desconhecido)';
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
