/**
 * Cria titular Rural Commerce + empresas (BD vazia em produção).
 * Uso: npx tsx --require dotenv/config scripts/bootstrap-expedicion-owner.ts
 */
import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const EMAIL = 'tiagorezende@ruralcommerceglobal.com';
const COMPANIES = [
  { name: 'Rural Commerce LLC', shortName: 'RC LLC' },
  { name: 'Rural Commerce LTDA', shortName: 'RC LTDA' },
];

async function main() {
  const prisma = new PrismaClient();
  const password = process.env.BOOTSTRAP_OWNER_PASSWORD || 'Expedicion2026!';
  const hash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email: EMAIL.toLowerCase() },
    update: { name: 'Tiago Rezende', role: UserRole.ADMIN },
    create: {
      email: EMAIL.toLowerCase(),
      name: 'Tiago Rezende',
      password: hash,
      role: UserRole.ADMIN,
      locale: 'es',
    },
  });

  let first = true;
  for (const c of COMPANIES) {
    let company = await prisma.company.findFirst({
      where: {
        shortName: c.shortName,
        companyUsers: { some: { userId: user.id } },
      },
    });
    if (!company) {
      company = await prisma.company.create({
        data: { name: c.name, shortName: c.shortName, currency: 'USD' },
      });
    } else {
      company = await prisma.company.update({
        where: { id: company.id },
        data: { name: c.name },
      });
    }

    await prisma.companyUser.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: { role: UserRole.ADMIN, isDefault: first },
      create: {
        userId: user.id,
        companyId: company.id,
        role: UserRole.ADMIN,
        isDefault: first,
      },
    });
    first = false;
    console.log('Empresa:', company.name, company.id);
  }

  console.log('Titular:', user.email, user.id);
  if (!process.env.BOOTSTRAP_OWNER_PASSWORD) {
    console.log('Password (defina BOOTSTRAP_OWNER_PASSWORD em produção):', password);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
