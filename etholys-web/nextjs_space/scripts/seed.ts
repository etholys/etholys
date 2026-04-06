import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashedMasterPw = await bcrypt.hash('admin123', 10);
  const hashedTestPw = await bcrypt.hash('johndoe123', 10);

  // Create test account (required for system testing - do not remove)
  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: { password: hashedTestPw },
    create: {
      email: 'john@doe.com',
      name: 'Test Admin',
      password: hashedTestPw,
      role: 'ADMIN',
      locale: 'es',
    },
  });

  // Create master admin user
  await prisma.user.upsert({
    where: { email: 'admin@etholys.com' },
    update: { password: hashedMasterPw },
    create: {
      email: 'admin@etholys.com',
      name: 'Administrador Master',
      password: hashedMasterPw,
      role: 'ADMIN',
      locale: 'es',
    },
  });

  console.log('✅ Seed completed: master admin + test account created');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
