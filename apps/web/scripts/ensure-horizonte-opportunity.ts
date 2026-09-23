/**
 * Restaura o briefing de varredura da empresa demo Horizonte Verde.
 * Uso (apps/web): npx tsx --require dotenv/config scripts/ensure-horizonte-opportunity.ts
 */
import { PrismaClient } from '@prisma/client';
import { applyHorizonteOpportunityBriefing } from '../lib/sandbox/horizonte-opportunity-briefing';

async function main() {
  const prisma = new PrismaClient();
  try {
    const company = await prisma.company.findFirst({
      where: { shortName: { in: ['Horizonte', 'SANDBOX'] } },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, name: true },
    });
    if (!company) throw new Error('Empresa Horizonte não encontrada');
    await applyHorizonteOpportunityBriefing(prisma, company.id);
    console.log(`Briefing de oportunidade aplicado em ${company.name} (${company.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
