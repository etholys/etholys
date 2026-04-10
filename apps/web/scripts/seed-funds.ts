import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const seedFunds = async () => {
  try {
    // Buscar la empresa (asumir que existe una empresa por defecto)
    const company = await prisma.company.findFirst();
    if (!company) {
      console.log('No company found. Create one first.');
      return;
    }

    console.log(`Using company: ${company.name} (${company.id})`);

    // Fondos de ejemplo basados en el CSV del Abacus
    const funds = [
      {
        companyId: company.id,
        name: 'GAFSP Business Investment Financing Track (BIFT) Pilot',
        institution: 'World Bank Group',
        description: 'Programa piloto de financiamiento concesional para pequeños agricultores',
        linkOficial: 'https://www.gafspfund.org/business-investment-financing-track-pilot',
        type: 'Grant',
        category: 'Agricultura',
        amount: 15000000,
        currency: 'USD',
        deadline: new Date('2026-06-30'),
        status: 'open',
        countries: 'Global, Africa, Asia',
        sectors: 'Agricultura,Cadenas agrícolas',
        matchScore: 65,
      },
      {
        companyId: company.id,
        name: 'Kenya Agricultural Carbon Project (KACP)',
        institution: 'BioCarbon Fund',
        description: 'Proyecto de generación de créditos de carbono del suelo',
        linkOficial: 'https://www.viagroforestry.org/projects/kacp/',
        type: 'Grant',
        category: 'Sustentabilidad',
        amount: 500000,
        currency: 'USD',
        deadline: new Date('2029-12-31'),
        status: 'open',
        countries: 'Kenya',
        sectors: 'Carbono,Agroforestería',
        matchScore: 42,
      },
      {
        companyId: company.id,
        name: 'Northeast SARE Farmer Grant Program 2026',
        institution: 'Northeast Sustainable Agriculture Research',
        description: 'Financiamiento para agricultores en investigación agrícola sustentable',
        linkOficial: 'https://northeast.sare.org/grants/',
        type: 'Grant',
        category: 'Agricultura Sustentable',
        amount: 30000,
        currency: 'USD',
        deadline: new Date('2025-12-09'),
        status: 'open',
        countries: 'USA',
        sectors: 'Agricultura Sustentable',
        matchScore: 55,
      },
      {
        companyId: company.id,
        name: 'USDA Rural Cooperative Development Grant',
        institution: 'USDA Rural Development',
        description: 'Subvenciones para desarrollo cooperativo rural',
        linkOficial: 'https://www.rd.usda.gov/programs-services/',
        type: 'Grant',
        category: 'Cooperativismo',
        amount: 200000,
        currency: 'USD',
        deadline: null,
        status: 'open',
        countries: 'USA',
        sectors: 'Cooperativismo',
        matchScore: 72,
      },
      {
        companyId: company.id,
        name: 'iFood Chega Junto 2025',
        institution: 'iFood',
        description: 'Inversión en proyectos sociales y de impacto',
        linkOficial: 'https://entregador.ifood.com.br/',
        type: 'Grant',
        category: 'Proyectos Sociales',
        amount: 500000,
        currency: 'BRL',
        deadline: new Date('2025-11-30'),
        status: 'open',
        countries: 'Brasil',
        sectors: 'Social,Educación',
        matchScore: 38,
      },
    ];

    let created = 0;
    for (const fund of funds) {
      const existing = await prisma.fund.findFirst({
        where: { name: fund.name },
      });

      if (!existing) {
        await prisma.fund.create({ data: fund });
        created++;
        console.log(`✅ Created: ${fund.name}`);
      } else {
        console.log(`⏭️  Already exists: ${fund.name}`);
      }
    }

    console.log(`\n✅ Seeded ${created} new funds`);
  } catch (error) {
    console.error('Error seeding funds:', error);
  } finally {
    await prisma.$disconnect();
  }
};

seedFunds();
