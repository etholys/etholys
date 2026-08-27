/**
 * Sandbox Etholys — empresa demo + dados fictícios em ATLAS/SIEP/FUNDHUB/NEXUS/FORGE/PRISM.
 * Idempotente: se a empresa SANDBOX já tiver o projecto marcador, só sincroniza users/acessos.
 */

import type { PrismaClient, User } from '@prisma/client';
import { WORKSPACE_SYSTEM_KEYS } from '@/lib/integrated-workspace-shared';
import { seedForgeDemoCourse } from '@/lib/forge/seed-demo';

export const SANDBOX_SHORT_NAME = 'SANDBOX';
export const SANDBOX_COMPANY_NAME = 'Etholys Sandbox Demo';

export const SANDBOX_USERS = [
  {
    key: 'ux',
    email: 'ux.content@etholys.com',
    name: 'Etholys UX & Conteúdo',
    jobTitle: 'UI / UX / Conteúdo',
  },
  {
    key: 'qa',
    email: 'qa.internal@etholys.com',
    name: 'Etholys QA Interno',
    jobTitle: 'Testing interno / QA',
  },
] as const;

const MARKER_PROJECT_CODE = 'SBX-001';

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n: number) {
  return daysFromNow(-n);
}

export type SandboxSeedResult = {
  companyId: string;
  companyName: string;
  users: Array<{ email: string; name: string; id: string }>;
  createdData: boolean;
  summary: string[];
};

export async function seedInternalSandbox(
  prisma: PrismaClient,
  opts: { passwordHash: string; forceReseed?: boolean },
): Promise<SandboxSeedResult> {
  const summary: string[] = [];

  let company = await prisma.company.findFirst({
    where: { shortName: SANDBOX_SHORT_NAME },
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: SANDBOX_COMPANY_NAME,
        shortName: SANDBOX_SHORT_NAME,
        description:
          'Empresa fictícia para UI/UX, conteúdo e testing interno. Dados de demonstração — não usar em produção real.',
        color: '#0D9488',
        currency: 'USD',
        contextSetupJson: {
          v: 1,
          sectorId: 'ngo',
          entityKind: 'ngo',
          countryPrimary: 'UY',
          currencyOp: 'USD',
          tradesInternationally: true,
          imports: false,
          exports: true,
          primaryGoals: ['operations', 'fundraising', 'impact_reporting', 'governance', 'export'],
          notesForAdvisor: 'Sandbox Etholys — dados fictícios para revisão visual e QA.',
          legalDisclaimerAcceptedAt: new Date().toISOString(),
        },
        contextSetupAt: new Date(),
      },
    });
    summary.push(`Empresa criada: ${company.name}`);
  } else {
    await prisma.company.update({
      where: { id: company.id },
      data: {
        name: SANDBOX_COMPANY_NAME,
        isActive: true,
        contextSetupJson: {
          v: 1,
          sectorId: 'ngo',
          entityKind: 'ngo',
          countryPrimary: 'UY',
          currencyOp: 'USD',
          tradesInternationally: true,
          primaryGoals: ['operations', 'fundraising', 'impact_reporting', 'governance', 'export'],
          notesForAdvisor: 'Sandbox Etholys — dados fictícios para revisão visual e QA.',
          legalDisclaimerAcceptedAt: new Date().toISOString(),
        },
        contextSetupAt: new Date(),
      },
    });
    summary.push(`Empresa existente: ${company.name}`);
  }

  const users: User[] = [];
  for (const u of SANDBOX_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        password: opts.passwordHash,
        role: 'ADMIN',
        isActive: true,
        locale: 'es',
      },
      create: {
        email: u.email,
        name: u.name,
        password: opts.passwordHash,
        role: 'ADMIN',
        isActive: true,
        locale: 'es',
      },
    });
    users.push(user);

    await prisma.companyUser.upsert({
      where: { userId_companyId: { userId: user.id, companyId: company.id } },
      update: {
        role: 'ADMIN',
        isDefault: true,
      },
      create: {
        userId: user.id,
        companyId: company.id,
        role: 'ADMIN',
        isDefault: true,
      },
    });

    // Cargo / inviteKind — colunas podem existir na BD antes do Prisma client no container
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "CompanyUser" SET "jobTitle" = $1, "inviteKind" = $2 WHERE "userId" = $3 AND "companyId" = $4`,
        u.jobTitle,
        'employee',
        user.id,
        company.id,
      );
    } catch {
      /* colunas ainda não migradas — ok */
    }

    await prisma.integratedWorkspaceAccess.upsert({
      where: { companyId_userId: { companyId: company.id, userId: user.id } },
      create: {
        companyId: company.id,
        userId: user.id,
        systems: [...WORKSPACE_SYSTEM_KEYS],
        enabled: true,
        grantedByUserId: user.id,
      },
      update: {
        systems: [...WORKSPACE_SYSTEM_KEYS],
        enabled: true,
      },
    });
  }
  summary.push(`Users: ${users.map((u) => u.email).join(', ')} (ADMIN + todos os sistemas)`);

  const marker = await prisma.project.findFirst({
    where: { companyId: company.id, code: MARKER_PROJECT_CODE },
  });

  let createdData = false;
  if (!marker || opts.forceReseed) {
    createdData = true;
    await seedSandboxContent(prisma, company.id, users[0]!.id, summary);
  } else {
    summary.push('Dados demo já existiam (marcador SBX-001) — só sincronizei users/acessos.');
    // Garantir curso FORGE mesmo se projecto já existe
    try {
      const courseId = await seedForgeDemoCourse(company.id, users[0]!.id);
      summary.push(`FORGE demo course: ${courseId}`);
    } catch (e) {
      summary.push(`FORGE seed avisou: ${e instanceof Error ? e.message : 'erro'}`);
    }
  }

  return {
    companyId: company.id,
    companyName: company.name,
    users: users.map((u) => ({ email: u.email, name: u.name || '', id: u.id })),
    createdData,
    summary,
  };
}

async function seedSandboxContent(
  prisma: PrismaClient,
  companyId: string,
  ownerId: string,
  summary: string[],
) {
  // --- Departamentos ---
  const deptOps =
    (await prisma.department.findFirst({ where: { companyId, name: 'Operaciones' } })) ||
    (await prisma.department.create({
      data: { companyId, name: 'Operaciones', code: 'OPS' },
    }));
  const deptProg =
    (await prisma.department.findFirst({ where: { companyId, name: 'Programas' } })) ||
    (await prisma.department.create({
      data: { companyId, name: 'Programas', code: 'PRG' },
    }));

  // --- ATLAS: clientes, fornecedores, produtos ---
  const clients = await Promise.all(
    [
      { name: 'Cooperativa Valle Verde', contactName: 'Ana Pérez', country: 'UY', city: 'Salto', segment: 'agro' },
      { name: 'Municipio Sierra Norte', contactName: 'Luis Gómez', country: 'UY', city: 'Tacuarembó', segment: 'público' },
      { name: 'Café Andes Export', contactName: 'María Silva', country: 'BR', city: 'Porto Alegre', segment: 'export' },
    ].map((c) =>
      prisma.client.create({
        data: { companyId, ...c, email: `${c.contactName.split(' ')[0]!.toLowerCase()}@demo.etholys.local`, type: 'company' },
      }),
    ),
  );

  const suppliers = await Promise.all(
    [
      { name: 'Insumos del Sur SA', category: 'insumos', country: 'UY', city: 'Montevideo', rating: 4 },
      { name: 'Logística Pampeana', category: 'logística', country: 'AR', city: 'Buenos Aires', rating: 5 },
    ].map((s) => prisma.supplier.create({ data: { companyId, ...s } })),
  );

  const products = await Promise.all(
    [
      { name: 'Kit diagnóstico rural', sku: 'KIT-DX-01', category: 'servicios', stockQty: 42, minStock: 10, salePrice: 180, costPrice: 95 },
      { name: 'Módulo formação digital', sku: 'MOD-EAD-02', category: 'formación', stockQty: 120, minStock: 20, salePrice: 45, costPrice: 12 },
      { name: 'Sensor umidade solo (demo)', sku: 'IOT-SOIL-1', category: 'hardware', stockQty: 8, minStock: 15, salePrice: 220, costPrice: 140 },
    ].map((p) => prisma.product.create({ data: { companyId, ...p, currency: 'USD', unit: 'unidad' } })),
  );

  await prisma.transactionCategory.createMany({
    data: [
      { companyId, name: 'Donaciones', color: '#10B981' },
      { companyId, name: 'Personal', color: '#6366F1' },
      { companyId, name: 'Viajes de campo', color: '#F59E0B' },
      { companyId, name: 'Equipamiento', color: '#0EA5E9' },
    ],
    skipDuplicates: true,
  });

  // --- SIEP: projectos ---
  const projectA = await prisma.project.create({
    data: {
      companyId,
      name: 'Cadenas Verdes — Escalamiento territorial',
      code: MARKER_PROJECT_CODE,
      description:
        'Proyecto demo de cooperación: fortalecimiento de cadenas agroalimentarias sostenibles en el norte uruguayo.',
      goal: 'Mejorar ingresos de 400 familias productoras en 24 meses.',
      donorName: 'Fundación Horizonte (ficticia)',
      donorContact: 'grants@horizonte.demo',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      startDate: daysAgo(120),
      endDate: daysFromNow(240),
      budget: 485000,
      spent: 162400,
      progress: 38,
      country: 'Uruguay',
      region: 'Norte',
      currency: 'USD',
      contentLocale: 'es',
      color: '#4F46E5',
    },
  });

  const projectB = await prisma.project.create({
    data: {
      companyId,
      name: 'Escuela de Innovación Rural',
      code: 'SBX-002',
      description: 'Programa de formación híbrida (FORGE) + asistencia técnica (NEXUS).',
      goal: 'Capacitar 120 jóvenes emprendedores rurales.',
      donorName: 'BID Lab (demo)',
      status: 'PLANNING',
      priority: 'MEDIUM',
      startDate: daysFromNow(14),
      endDate: daysFromNow(400),
      budget: 210000,
      spent: 8200,
      progress: 8,
      country: 'Uruguay',
      region: 'Centro',
      currency: 'USD',
      color: '#0D9488',
    },
  });

  for (const p of [projectA, projectB]) {
    await prisma.projectMember.create({
      data: {
        projectId: p.id,
        userId: ownerId,
        role: 'director',
        accessMode: 'company_staff',
        dedicationPct: 40,
      },
    });
  }

  await prisma.objective.createMany({
    data: [
      {
        projectId: projectA.id,
        type: 'outcome',
        code: 'R1',
        title: 'Productores adoptan prácticas sostenibles',
        indicator: '% de familias con plan de finca',
        baseline: '12%',
        target: '65%',
        actual: '28%',
        status: 'in_progress',
        order: 1,
      },
      {
        projectId: projectA.id,
        type: 'output',
        code: 'P1.1',
        title: 'Talleres de campo realizados',
        indicator: 'Nº de talleres',
        baseline: '0',
        target: '48',
        actual: '16',
        status: 'in_progress',
        order: 2,
      },
      {
        projectId: projectB.id,
        type: 'outcome',
        code: 'R1',
        title: 'Jóvenes lanzan emprendimientos viables',
        indicator: 'Nº de negocios en operación',
        baseline: '0',
        target: '40',
        actual: '0',
        status: 'not_started',
        order: 1,
      },
    ],
  });

  // Stakeholders
  await prisma.stakeholder.createMany({
    data: [
      {
        companyId,
        name: 'Fundación Horizonte',
        type: 'donor',
        allianceType: 'financiamiento',
        country: 'ES',
        status: 'active',
        sector: 'cooperación',
        description: 'Donante ficticio del proyecto Cadenas Verdes.',
      },
      {
        companyId,
        name: 'INTA Regional Norte',
        type: 'government',
        allianceType: 'técnico',
        country: 'UY',
        status: 'active',
        sector: 'investigación',
      },
      {
        companyId,
        name: 'Red de Cooperativas del Litoral',
        type: 'ong',
        allianceType: 'implementación',
        country: 'UY',
        status: 'pipeline',
        sector: 'agro',
      },
    ],
  });

  // Tasks (Work + SIEP)
  await prisma.task.createMany({
    data: [
      {
        title: 'Revisar narrativa del informe Q2',
        description: 'Ajustar tono visual y copy para donante (sandbox UX).',
        companyId,
        projectId: projectA.id,
        creatorId: ownerId,
        assigneeId: ownerId,
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: daysFromNow(5),
        departmentId: deptProg.id,
      },
      {
        title: 'Actualizar fotos del Hub / landing interna',
        companyId,
        creatorId: ownerId,
        assigneeId: ownerId,
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: daysFromNow(12),
        departmentId: deptOps.id,
      },
      {
        title: 'Checklist QA — flujo de invitaciones',
        companyId,
        creatorId: ownerId,
        status: 'TODO',
        priority: 'HIGH',
        dueDate: daysFromNow(3),
      },
      {
        title: 'Visita de campo — cooperativa Valle Verde',
        companyId,
        projectId: projectA.id,
        creatorId: ownerId,
        status: 'DONE',
        priority: 'MEDIUM',
        completedAt: daysAgo(7),
        dueDate: daysAgo(7),
      },
    ],
  });

  // Transactions ATLAS/SIEP
  await prisma.transaction.createMany({
    data: [
      {
        companyId,
        projectId: projectA.id,
        type: 'INCOME',
        amount: 120000,
        title: 'Desembolso 1 — Fundación Horizonte',
        category: 'Donaciones',
        date: daysAgo(90),
        executionStatus: 'EXECUTED',
        executedDate: daysAgo(90),
        scope: 'PROJECT',
      },
      {
        companyId,
        projectId: projectA.id,
        type: 'EXPENSE',
        amount: 18400,
        title: 'Talleres + materiales campo',
        category: 'Viajes de campo',
        date: daysAgo(20),
        executionStatus: 'EXECUTED',
        executedDate: daysAgo(20),
        scope: 'PROJECT',
      },
      {
        companyId,
        type: 'EXPENSE',
        amount: 6200,
        title: 'Nómina operativa (demo)',
        category: 'Personal',
        date: daysAgo(5),
        executionStatus: 'EXECUTED',
        executedDate: daysAgo(5),
        scope: 'COMPANY',
      },
      {
        companyId,
        projectId: projectB.id,
        type: 'EXPENSE',
        amount: 8200,
        title: 'Diseño de currículo FORGE',
        category: 'Equipamiento',
        date: daysAgo(2),
        executionStatus: 'FORECAST',
        scope: 'PROJECT',
      },
    ],
  });

  // Purchase order
  await prisma.purchaseOrder.create({
    data: {
      companyId,
      supplierId: suppliers[0]!.id,
      number: 'PO-SBX-001',
      status: 'sent',
      currency: 'USD',
      subtotal: 4500,
      taxRate: 0.1,
      taxAmount: 450,
      total: 4950,
      orderDate: daysAgo(10),
      expectedDate: daysFromNow(7),
      notes: 'Pedido demo — kits de diagnóstico',
      items: {
        create: [
          {
            description: products[0]!.name,
            quantity: 25,
            unitPrice: 180,
            total: 4500,
            productId: products[0]!.id,
          },
        ],
      },
    },
  });

  // --- FUNDHUB ---
  const fund = await prisma.fund.create({
    data: {
      companyId,
      name: 'Convocatoria Innovación Rural 2026 (demo)',
      institution: 'Agencia Demo de Cooperación',
      type: 'grant',
      category: 'innovación',
      amount: 350000,
      currency: 'USD',
      deadline: daysFromNow(45),
      status: 'open',
      countries: 'UY,AR,BR,PY',
      sectors: 'agro,educación,clima',
      matchScore: 82,
      matchJustification: 'Alineado con cadenas verdes y formación híbrida (sandbox).',
      summary: 'Fondo ficticio para probar matching y propuestas en FUNDHUB.',
      description: 'Datos de demostración Etholys Sandbox.',
    },
  });

  await prisma.proposal.create({
    data: {
      companyId,
      fundId: fund.id,
      workspaceId: `sandbox-proposal-${companyId.slice(0, 8)}`,
      title: 'Propuesta Cadenas Verdes — Fase 2 (demo)',
      status: 'draft',
      createdBy: ownerId,
      editalSummary: 'Edital ficticio para revisión de UI del editor de propuestas.',
      sections: {
        create: [
          {
            title: 'Resumen ejecutivo',
            order: 0,
            content:
              'Esta propuesta demo describe un escalamiento territorial con énfasis en productores familiares y mercados diferenciados.',
          },
          {
            title: 'Problema y justificación',
            order: 1,
            content:
              'Las cadenas locales enfrentan baja trazabilidad y acceso limitado a asistencia técnica continua.',
          },
          {
            title: 'Resultados esperados',
            order: 2,
            content: '400 familias con planes de finca; 3 hubs de comercialización; 120 jóvenes formados.',
          },
        ],
      },
    },
  });

  await prisma.fundingCaptureProfile.upsert({
    where: { companyId },
    create: {
      companyId,
      subscriptionTier: 'pro',
      countriesCsv: 'UY,AR,BR',
      themesCsv: 'agro,clima,educación',
      fundTypesCsv: 'grant,prize',
      crossEtholysOptIn: false,
    },
    update: {
      countriesCsv: 'UY,AR,BR',
      themesCsv: 'agro,clima,educación',
    },
  });

  await prisma.fundhubPartner.createMany({
    data: [
      { companyId, name: 'Universidad Demo del Litoral', country: 'UY', role: 'académico' },
      { companyId, name: 'Startup AgroSense', country: 'BR', role: 'tecnología' },
    ],
  });

  // --- NEXUS ---
  const network = await prisma.nexusNetwork.create({
    data: {
      name: 'Red Sandbox — Cooperativas del Norte',
      kind: 'COOP_HIERARCHY',
      anchorCompanyId: companyId,
      siepProjectId: projectA.id,
      isActive: true,
    },
  });

  await prisma.nexusNetworkMember.create({
    data: {
      networkId: network.id,
      companyId,
      memberRole: 'anchor',
      sortOrder: 0,
      siepProjectId: projectA.id,
    },
  });

  await prisma.nexusVentureState.upsert({
    where: { companyId },
    create: {
      companyId,
      networkId: network.id,
      stage: 'BUILD',
    },
    update: {
      networkId: network.id,
      stage: 'BUILD',
    },
  });

  // --- FORGE ---
  try {
    const courseId = await seedForgeDemoCourse(companyId, ownerId);
    summary.push(`FORGE: curso demo ${courseId}`);
  } catch (e) {
    summary.push(`FORGE: ${e instanceof Error ? e.message : 'erro'}`);
  }

  // Chat canal demo
  const channel = await prisma.chatChannel.create({
    data: {
      companyId,
      name: 'Sandbox — general',
      description: 'Canal demo para UX/QA',
      type: 'public',
      createdBy: ownerId,
      projectId: projectA.id,
      projectName: projectA.name,
    },
  });
  await prisma.chatChannelMember.create({
    data: { channelId: channel.id, userId: ownerId },
  });

  summary.push(
    `Dados: ${clients.length} clientes, ${suppliers.length} fornecedores, ${products.length} produtos, 2 projectos SIEP, FUNDHUB+proposta, rede NEXUS, tarefas, finanças.`,
  );
  void deptOps;
  void deptProg;
}
