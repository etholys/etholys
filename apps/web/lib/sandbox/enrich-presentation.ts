/**
 * Completa a empresa demo para apresentação: FundHub com percurso visível
 * e registos em falta nos outros sistemas. Idempotente.
 */

import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import { applyHorizonteOpportunityBriefing } from '@/lib/sandbox/horizonte-opportunity-briefing';

export const PRESENTATION_COMPANY_NAME = 'Horizonte Verde';
export const PRESENTATION_SHORT_NAME = 'Horizonte';

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function daysAgo(n: number) {
  return daysFromNow(-n);
}

async function upsertMemory(
  prisma: PrismaClient,
  companyId: string,
  category: string,
  key: string,
  value: string,
  source: string,
) {
  const existing = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category, key },
  });
  if (existing) {
    await prisma.aiCompanyMemory.update({
      where: { id: existing.id },
      data: { value, source },
    });
  } else {
    await prisma.aiCompanyMemory.create({
      data: { companyId, category, key, value, source },
    });
  }
}

type FundSeed = {
  name: string;
  institution: string;
  type: string;
  category: string;
  amount: number;
  deadlineDays: number | null;
  status: string;
  countries: string;
  sectors: string;
  matchScore: number;
  matchJustification: string;
  summary: string;
  description: string;
  eligibilityCriteria: string;
  linkOficial: string;
  saved: boolean;
};

const FUNDS: FundSeed[] = [
  {
    name: 'Convocatoria Innovación Rural 2026 (demo)',
    institution: 'Agencia Demo de Cooperación',
    type: 'grant',
    category: 'innovación',
    amount: 350000,
    deadlineDays: 12,
    status: 'open',
    countries: 'UY,AR,BR,PY',
    sectors: 'agro,educación,clima',
    matchScore: 82,
    matchJustification: 'Alineado con cadenas verdes y formación híbrida de la organización.',
    summary: 'Subvención para escalar cadenas agroalimentarias sostenibles en el norte.',
    description:
      'Financia asistencia técnica, comercialización diferenciada y formación de jóvenes. La organización ya tiene un proyecto en curso que cubre el mismo territorio.',
    eligibilityCriteria: 'ONG o cooperativa con operación en el Cono Sur, al menos 2 años de ejecución y contraparte local.',
    linkOficial: 'https://www.iadb.org',
    saved: true,
  },
  {
    name: 'BID Lab — Innovación agroclimática 2026',
    institution: 'BID Lab',
    type: 'grant',
    category: 'clima',
    amount: 500000,
    deadlineDays: 6,
    status: 'open',
    countries: 'UY,BR',
    sectors: 'clima,agro,tecnología',
    matchScore: 91,
    matchJustification: 'El sensor de humedad y los planes de finca encajan en el componente de innovación.',
    summary: 'La mejor coincidencia del catálogo: plazo corto y encaje alto con Cadenas Verdes.',
    description:
      'Convocatoria para pilotos que combinen datos de campo y asistencia técnica a productores familiares.',
    eligibilityCriteria: 'Entidad ejecutora con socio tecnológico y meta de al menos 200 familias.',
    linkOficial: 'https://bidlab.org',
    saved: true,
  },
  {
    name: 'Fondo Verde UE — Cadenas cortas',
    institution: 'Unión Europea',
    type: 'grant',
    category: 'cadenas',
    amount: 280000,
    deadlineDays: 21,
    status: 'open',
    countries: 'UY,AR',
    sectors: 'agro,comercio',
    matchScore: 76,
    matchJustification: 'Encaja en comercialización, con menos peso en formación.',
    summary: 'Apoyo a circuitos cortos entre cooperativas y compras institucionales.',
    description: 'Cubre logística, certificación y acuerdos con municipios.',
    eligibilityCriteria: 'Consorcio de al menos dos organizaciones, una de ellas local.',
    linkOficial: 'https://ec.europa.eu',
    saved: true,
  },
  {
    name: 'Premio Jóvenes Rurales 2026',
    institution: 'Fundación Horizonte',
    type: 'prize',
    category: 'juventud',
    amount: 40000,
    deadlineDays: 28,
    status: 'open',
    countries: 'UY',
    sectors: 'educación,emprendimiento',
    matchScore: 68,
    matchJustification: 'Sirve al programa Escuela de Innovación Rural, no al proyecto principal.',
    summary: 'Premio para emprendimientos de jóvenes ya formados en la escuela rural.',
    description: 'Monto menor, útil como complemento del programa de formación.',
    eligibilityCriteria: 'Organización que acompañe a jóvenes de 18 a 29 años en zonas rurales.',
    linkOficial: 'https://www.fonplata.org',
    saved: false,
  },
  {
    name: 'CAF — Crédito verde MIPYME',
    institution: 'CAF',
    type: 'credit',
    category: 'finanzas',
    amount: 150000,
    deadlineDays: 55,
    status: 'open',
    countries: 'UY,PY',
    sectors: 'finanzas,agro',
    matchScore: 54,
    matchJustification: 'Posible para cooperativas socias; la ONG no es la tomadora ideal del crédito.',
    summary: 'Línea de crédito. Aparece en la búsqueda para compararla con las subvenciones.',
    description: 'Muestra que FundHub distingue subvención, premio y crédito.',
    eligibilityCriteria: 'MIPYME con flujo de caja y garantía. La ONG puede articular, no endeudarse.',
    linkOficial: 'https://www.caf.com',
    saved: false,
  },
  {
    name: 'Alianza de compras públicas locales',
    institution: 'Municipio Sierra Norte',
    type: 'alliance',
    category: 'mercado',
    amount: 90000,
    deadlineDays: null,
    status: 'open',
    countries: 'UY',
    sectors: 'agro,público',
    matchScore: 47,
    matchJustification: 'Ventanilla abierta: acuerdo comercial, no una convocatoria con cierre.',
    summary: 'Oportunidad continua. Sirve para explicar fondos sin fecha de cierre.',
    description: 'El municipio compra a cooperativas acompañadas por la organización.',
    eligibilityCriteria: 'Proveedor local con trazabilidad básica.',
    linkOficial: 'https://www.gub.uy',
    saved: false,
  },
  {
    name: 'FAO — Agricultura familiar Cono Sur',
    institution: 'FAO',
    type: 'grant',
    category: 'agro',
    amount: 220000,
    deadlineDays: 18,
    status: 'open',
    countries: 'UY,AR,BR',
    sectors: 'agro,género,clima',
    matchScore: 73,
    matchJustification: 'Cubre asistencia a familias productoras; menos innovación tecnológica que BID Lab.',
    summary: 'Subvención de medio plazo. Sirve para comparar encaje con la convocatoria estrella.',
    description: 'Fortalece organizaciones de agricultura familiar con mercados locales y prácticas de suelo.',
    eligibilityCriteria: 'Organización de productores o ONG acompañante, con línea de base y meta de hogares.',
    linkOficial: 'https://www.fao.org',
    saved: true,
  },
  {
    name: 'ANII — Validación de sensores de campo',
    institution: 'ANII',
    type: 'grant',
    category: 'tecnología',
    amount: 80000,
    deadlineDays: 35,
    status: 'open',
    countries: 'UY',
    sectors: 'tecnología,agro',
    matchScore: 61,
    matchJustification: 'Encaja con el tablero de humedad, no con el componente de formación.',
    summary: 'Convocatoria menor para validar la sonda antes de escalar el piloto.',
    description: 'Financia prueba de campo de sensores y un informe de adopción con productores.',
    eligibilityCriteria: 'Entidad uruguaya con prototipo y al menos una finca de prueba.',
    linkOficial: 'https://www.anii.org.uy',
    saved: false,
  },
];

const COMPLIANCE: Array<{ id: string; items: Record<string, boolean>; notes?: string }> = [
  {
    id: 'governance',
    items: { '1': true, '2': true, '3': true, '4': false },
    notes:
      'Falta designar director financiero dedicado. El resto de la gobernanza está documentado para la convocatoria BID Lab.',
  },
  { id: 'financial', items: { '1': true, '2': true, '3': true, '4': true } },
  { id: 'esg', items: { '1': true, '2': true, '3': false, '4': true } },
  { id: 'compliance', items: { '1': true, '2': true, '3': true, '4': false } },
];

export async function enrichSandboxPresentation(
  prisma: PrismaClient,
  companyId: string,
  ownerId: string,
  summary: string[],
) {
  await prisma.company.update({
    where: { id: companyId },
    data: {
      name: PRESENTATION_COMPANY_NAME,
      shortName: PRESENTATION_SHORT_NAME,
      description:
        'Organización sin fines de lucro en el norte de Uruguay. Fortalece cadenas agroalimentarias sostenibles, forma jóvenes rurales y articula cooperativas, gobiernos locales y cooperación internacional.',
      incorporationCountry: 'UY',
      entityType: 'NGO',
      businessActivity: 'Cooperación y desarrollo rural',
      currency: 'USD',
      isActive: true,
    },
  });
  summary.push(`Empresa de presentación: ${PRESENTATION_COMPANY_NAME} (${PRESENTATION_SHORT_NAME})`);

  const project = await prisma.project.findFirst({
    where: { companyId, code: 'SBX-001' },
    select: { id: true },
  });

  const fundIds = new Map<string, string>();
  for (const f of FUNDS) {
    const data = {
      type: f.type,
      category: f.category,
      amount: f.amount,
      currency: 'USD',
      deadline: f.deadlineDays == null ? null : daysFromNow(f.deadlineDays),
      status: f.status,
      countries: f.countries,
      sectors: f.sectors,
      matchScore: f.matchScore,
      matchJustification: f.matchJustification,
      summary: f.summary,
      description: f.description,
      eligibilityCriteria: f.eligibilityCriteria,
      linkOficial: f.linkOficial,
      requisites: f.eligibilityCriteria,
      sourceOfInformation: 'sandbox-presentation',
      lastReviewedAt: new Date(),
      isActive: true,
    };
    const existing = await prisma.fund.findFirst({
      where: { companyId, name: f.name, institution: f.institution },
    });
    const row = existing
      ? await prisma.fund.update({ where: { id: existing.id }, data })
      : await prisma.fund.create({
          data: { companyId, name: f.name, institution: f.institution, ...data },
        });
    fundIds.set(f.name, row.id);
    if (f.saved) {
      await prisma.userFundStatus.upsert({
        where: { fundId_userId: { fundId: row.id, userId: ownerId } },
        create: { fundId: row.id, userId: ownerId, status: 'saved', notes: 'Guardado para la presentación.' },
        update: { status: 'saved' },
      });
    }
  }
  summary.push(`FundHub: ${fundIds.size} fondos (plazos, encaje y tipos distintos)`);

  const bidId = fundIds.get('BID Lab — Innovación agroclimática 2026')!;
  const ruralId = fundIds.get('Convocatoria Innovación Rural 2026 (demo)')!;
  const euId = fundIds.get('Fondo Verde UE — Cadenas cortas')!;

  await ensureProposal(prisma, {
    companyId,
    ownerId,
    fundId: bidId,
    workspaceId: `sandbox-proposal-bid-${companyId.slice(0, 8)}`,
    title: 'Propuesta BID Lab — Pilotos agroclimáticos',
    status: 'draft',
    editalSummary: 'Borrador listo para revisar en la reunión: problema, método y presupuesto.',
    sections: [
      ['Resumen ejecutivo', 'Horizonte Verde propone un piloto de 18 meses con 220 familias en Salto y Tacuarembó, combinando planes de finca y sensores de humedad.'],
      ['Problema', 'Los productores familiares pierden cosecha por decisiones tardías de riego y no acceden a compradores que paguen trazabilidad.'],
      ['Método', 'Asistencia técnica quincenal, tablero de datos en FORGE y acuerdos de compra con dos municipios.'],
      ['Presupuesto', 'USD 500.000: 45% asistencia técnica, 25% equipamiento, 20% formación, 10% gestión.'],
    ],
  });

  await ensureProposal(prisma, {
    companyId,
    ownerId,
    fundId: ruralId,
    workspaceId: `sandbox-proposal-${companyId.slice(0, 8)}`,
    title: 'Propuesta Cadenas Verdes — Fase 2 (demo)',
    status: 'draft',
    editalSummary: 'Segunda propuesta en borrador, ligada al proyecto SIEP ya en ejecución.',
    sections: [
      ['Resumen ejecutivo', 'Escalamiento territorial con énfasis en productores familiares y mercados diferenciados.'],
      ['Problema y justificación', 'Las cadenas locales enfrentan baja trazabilidad y acceso limitado a asistencia técnica continua.'],
      ['Resultados esperados', '400 familias con planes de finca; 3 hubs de comercialización; 120 jóvenes formados.'],
    ],
  });

  await ensureProposal(prisma, {
    companyId,
    ownerId,
    fundId: euId,
    workspaceId: `sandbox-proposal-eu-${companyId.slice(0, 8)}`,
    title: 'Propuesta UE — Cadenas cortas (enviada)',
    status: 'submitted',
    submittedAt: daysAgo(4),
    editalSummary: 'Ejemplo de propuesta ya enviada, para mostrar el estado posterior al borrador.',
    sections: [
      ['Resumen', 'Consorcio Horizonte Verde + Red de Cooperativas del Litoral para tres circuitos cortos.'],
      ['Socios', 'Universidad Demo del Litoral aporta evaluación. AgroSense aporta trazabilidad.'],
    ],
  });
  summary.push('FundHub: 2 propuestas en borrador y 1 enviada');

  await applyHorizonteOpportunityBriefing(prisma, companyId);

  const partners = [
    {
      name: 'Universidad Demo del Litoral',
      country: 'UY',
      role: 'Evaluación académica',
      website: 'https://www.universidad.edu.uy',
      notes: 'Mide resultados del proyecto Cadenas Verdes.',
    },
    {
      name: 'Startup AgroSense',
      country: 'BR',
      role: 'Tecnología de campo',
      website: 'https://agrosense.example',
      notes: 'Sensores de humedad usados en el piloto BID Lab.',
    },
    {
      name: 'Red de Cooperativas del Litoral',
      country: 'UY',
      role: 'Implementación territorial',
      website: 'https://www.gub.uy',
      notes: 'Llega a las familias productoras. Socia de la propuesta europea.',
    },
    {
      name: 'INTA Regional Norte',
      country: 'UY',
      role: 'Asistencia técnica pública',
      website: 'https://www.inia.uy',
      notes: 'Valida los planes de finca.',
    },
  ];
  for (const p of partners) {
    const existing = await prisma.fundhubPartner.findFirst({
      where: { companyId, name: p.name },
    });
    if (existing) {
      await prisma.fundhubPartner.update({
        where: { id: existing.id },
        data: { ...p, isActive: true },
      });
    } else {
      await prisma.fundhubPartner.create({ data: { companyId, ...p } });
    }
  }
  summary.push(`FundHub: ${partners.length} socios`);

  await upsertMemory(
    prisma,
    companyId,
    'fundhub_coalition',
    'members_v1',
    JSON.stringify({
      members: [
        {
          id: 'sbx-coal-1',
          orgName: 'Universidad Demo del Litoral',
          country: 'UY',
          role: 'Evaluación de impacto',
          contactEmail: 'alianzas@litoral.demo',
          addedAt: daysAgo(20).toISOString(),
        },
        {
          id: 'sbx-coal-2',
          orgName: 'Red de Cooperativas del Litoral',
          country: 'UY',
          role: 'Implementación con familias productoras',
          contactEmail: 'red@cooperativas.demo',
          addedAt: daysAgo(18).toISOString(),
        },
        {
          id: 'sbx-coal-3',
          orgName: 'Startup AgroSense',
          country: 'BR',
          role: 'Trazabilidad y sensores',
          contactEmail: 'hola@agrosense.demo',
          addedAt: daysAgo(12).toISOString(),
        },
      ],
    }),
    'sandbox-presentation',
  );
  summary.push('FundHub: coalición de 3 organizaciones');

  for (const c of COMPLIANCE) {
    const existing = await prisma.fundhubComplianceChecklist.findFirst({
      where: { companyId, fundId: null, checklistId: c.id },
    });
    const payload = { itemsJson: JSON.stringify(c.items), notes: c.notes ?? null };
    if (existing) {
      await prisma.fundhubComplianceChecklist.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.fundhubComplianceChecklist.create({
        data: { companyId, fundId: null, checklistId: c.id, ...payload },
      });
    }
  }
  summary.push('FundHub: compliance parcialmente completo');

  await prisma.fundhubEligibilityCheck.upsert({
    where: { companyId_userId_fundId: { companyId, userId: ownerId, fundId: bidId } },
    create: {
      companyId,
      userId: ownerId,
      fundId: bidId,
      completionPct: 75,
      itemsJson: JSON.stringify([
        { id: 'years', label: 'Más de 2 años de operación', done: true },
        { id: 'territory', label: 'Trabajo activo en Uruguay', done: true },
        { id: 'families', label: 'Meta de 200 familias', done: true },
        { id: 'cfo', label: 'Director financiero dedicado', done: false },
      ]),
    },
    update: { completionPct: 75 },
  });

  const alert = await prisma.fundhubAlert.upsert({
    where: { companyId_userId: { companyId, userId: ownerId } },
    create: {
      companyId,
      userId: ownerId,
      name: 'Encaje alto',
      description: 'Avisar cuando una convocatoria supere 70% de encaje.',
      matchThreshold: 70,
      isActive: true,
      notificationType: 'in_app',
    },
    update: { isActive: true, matchThreshold: 70 },
  });
  const existingTrigger = await prisma.fundhubAlertTrigger.findFirst({
    where: { alertId: alert.id, fundId: bidId },
  });
  if (!existingTrigger) {
    await prisma.fundhubAlertTrigger.create({
      data: { alertId: alert.id, fundId: bidId, matchScore: 91 },
    });
  }

  const discovery = await prisma.fundhubDiscoveryRun.findFirst({
    where: { companyId, source: 'sandbox-presentation' },
  });
  if (!discovery) {
    await prisma.fundhubDiscoveryRun.create({
      data: {
        companyId,
        initiatedByUserId: ownerId,
        source: 'sandbox-presentation',
        status: 'completed',
        scanned: 18,
        created: FUNDS.length,
        updated: 0,
        errorCount: 0,
        finishedAt: daysAgo(1),
        durationMs: 42000,
        startedAt: daysAgo(1),
      },
    });
  }

  const monitored = await prisma.userMonitoredSource.findFirst({
    where: { companyId, userId: ownerId, label: 'BID Lab convocatorias' },
  });
  if (!monitored) {
    await prisma.userMonitoredSource.create({
      data: {
        companyId,
        userId: ownerId,
        label: 'BID Lab convocatorias',
        customUrl: 'https://bidlab.org',
        languages: 'es,pt',
        isActive: true,
      },
    });
  }

  try {
    await seedRestOfSystems(prisma, companyId, ownerId, project?.id ?? null, summary);
  } catch (e) {
    summary.push(`Outros sistemas: ${e instanceof Error ? e.message : 'erro'}`);
  }
}

async function ensureProposal(
  prisma: PrismaClient,
  input: {
    companyId: string;
    ownerId: string;
    fundId: string;
    workspaceId: string;
    title: string;
    status: string;
    editalSummary: string;
    sections: Array<[string, string]>;
    submittedAt?: Date;
  },
) {
  const existing =
    (await prisma.proposal.findUnique({ where: { workspaceId: input.workspaceId } })) ||
    (await prisma.proposal.findFirst({
      where: { companyId: input.companyId, title: input.title, deletedAt: null },
    }));

  const proposal = existing
    ? await prisma.proposal.update({
        where: { id: existing.id },
        data: {
          fundId: input.fundId,
          title: input.title,
          status: input.status,
          editalSummary: input.editalSummary,
          submittedAt: input.submittedAt ?? null,
          deletedAt: null,
        },
      })
    : await prisma.proposal.create({
        data: {
          companyId: input.companyId,
          fundId: input.fundId,
          workspaceId: input.workspaceId,
          title: input.title,
          status: input.status,
          createdBy: input.ownerId,
          editalSummary: input.editalSummary,
          editalLink: 'https://bidlab.org',
          submittedAt: input.submittedAt,
        },
      });

  const count = await prisma.proposalSection.count({ where: { proposalId: proposal.id } });
  if (count === 0) {
    await prisma.proposalSection.createMany({
      data: input.sections.map(([title, content], order) => ({
        proposalId: proposal.id,
        title,
        content,
        order,
      })),
    });
  }
}

async function tryStep(summary: string[], label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    summary.push(`${label}: ${e instanceof Error ? e.message : 'erro'}`);
  }
}

async function seedRestOfSystems(
  prisma: PrismaClient,
  companyId: string,
  ownerId: string,
  projectId: string | null,
  summary: string[],
) {
  await tryStep(summary, 'ATLAS', () => seedAtlas(prisma, companyId, ownerId, projectId, summary));
  await tryStep(summary, 'NEXUS', () => seedNexusAt(prisma, companyId, projectId, summary));
  await tryStep(summary, 'AURORA-RADAR', () => seedAuroraAndRadar(prisma, companyId, ownerId, summary));
  await tryStep(summary, 'STUDIO', () => seedStudio(prisma, companyId, ownerId, summary));
  await tryStep(summary, 'CHORUS', () => seedMeet(prisma, companyId, ownerId, projectId, summary));
  await tryStep(summary, 'PRISM', () => seedPrism(prisma, companyId, summary));
}

async function seedInvoice(
  prisma: PrismaClient,
  companyId: string,
  projectId: string | null,
  summary: string[],
) {
  const invoice = await prisma.invoice.findFirst({
    where: { companyId, number: 'INV-SBX-001' },
  });
  if (!invoice) {
    await prisma.invoice.create({
      data: {
        companyId,
        projectId,
        type: 'RECEIVABLE',
        status: 'PAID',
        number: 'INV-SBX-001',
        description: 'Desembolso 1 — Fundación Horizonte',
        currency: 'USD',
        subtotal: 120000,
        total: 120000,
        issueDate: daysAgo(90),
        paidDate: daysAgo(88),
        items: {
          create: [{ description: 'Primer desembolso Cadenas Verdes', quantity: 1, unitPrice: 120000, total: 120000, order: 0 }],
        },
      },
    });
    summary.push('ATLAS: factura de desembolso');
  }
}

type HrStaff = {
  email: string;
  name: string;
  position: string;
  department: string;
  contractType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACTOR' | 'INTERN';
  salary: number;
  currency: 'UYU' | 'USD';
  hours: number;
  startDaysAgo: number;
  endDaysFromNow?: number;
  socialSecurity: number;
  healthInsurance: number;
  bonuses: number;
  notes: string;
  dedication?: number;
  phone?: string;
};

const HR_STAFF: HrStaff[] = [
  {
    email: 'master.horizonte@etholys.com',
    name: 'Dirección Horizonte',
    position: 'Dirección general',
    department: 'Dirección',
    contractType: 'FULL_TIME',
    salary: 185000,
    currency: 'UYU',
    hours: 40,
    startDaysAgo: 1400,
    socialSecurity: 27750,
    healthInsurance: 9250,
    bonuses: 0,
    notes: 'demo:hr:master',
    dedication: 20,
  },
  {
    email: 'lucia.ferrero@horizonte.demo',
    name: 'Lucía Ferrero',
    position: 'Coordinación de programas',
    department: 'Programas',
    contractType: 'FULL_TIME',
    salary: 112000,
    currency: 'UYU',
    hours: 40,
    startDaysAgo: 980,
    socialSecurity: 16800,
    healthInsurance: 5600,
    bonuses: 8000,
    notes: 'demo:hr:lucia',
    dedication: 70,
    phone: '+598 99 100 201',
  },
  {
    email: 'martin.acosta@horizonte.demo',
    name: 'Martín Acosta',
    position: 'Técnico de campo',
    department: 'Programas',
    contractType: 'FULL_TIME',
    salary: 86000,
    currency: 'UYU',
    hours: 40,
    startDaysAgo: 760,
    socialSecurity: 12900,
    healthInsurance: 4300,
    bonuses: 4000,
    notes: 'demo:hr:martin',
    dedication: 100,
    phone: '+598 99 100 202',
  },
  {
    email: 'sofia.pereira@horizonte.demo',
    name: 'Sofía Pereira',
    position: 'Administración y finanzas',
    department: 'Administración',
    contractType: 'FULL_TIME',
    salary: 94000,
    currency: 'UYU',
    hours: 40,
    startDaysAgo: 1100,
    socialSecurity: 14100,
    healthInsurance: 4700,
    bonuses: 0,
    notes: 'demo:hr:sofia',
    dedication: 30,
    phone: '+598 99 100 203',
  },
  {
    email: 'elena.duarte@horizonte.demo',
    name: 'Elena Duarte',
    position: 'Comunicación',
    department: 'Comunicación',
    contractType: 'PART_TIME',
    salary: 48000,
    currency: 'UYU',
    hours: 20,
    startDaysAgo: 420,
    socialSecurity: 7200,
    healthInsurance: 2400,
    bonuses: 0,
    notes: 'demo:hr:elena',
    dedication: 15,
    phone: '+598 99 100 204',
  },
  {
    email: 'camila.nunez@horizonte.demo',
    name: 'Camila Núñez',
    position: 'Pasante de monitoreo',
    department: 'Programas',
    contractType: 'INTERN',
    salary: 28000,
    currency: 'UYU',
    hours: 20,
    startDaysAgo: 70,
    endDaysFromNow: 110,
    socialSecurity: 0,
    healthInsurance: 0,
    bonuses: 0,
    notes: 'demo:hr:camila',
    dedication: 50,
    phone: '+598 99 100 205',
  },
  {
    email: 'jorge.villalba@horizonte.demo',
    name: 'Jorge Villalba',
    position: 'Contador externo',
    department: 'Administración',
    contractType: 'CONTRACTOR',
    salary: 1800,
    currency: 'USD',
    hours: 12,
    startDaysAgo: 500,
    socialSecurity: 0,
    healthInsurance: 0,
    bonuses: 0,
    notes: 'demo:hr:jorge',
    phone: '+598 99 100 206',
  },
  {
    email: 'andres.molina@horizonte.demo',
    name: 'Andrés Molina',
    position: 'Técnico de riego',
    department: 'Programas',
    contractType: 'CONTRACTOR',
    salary: 72000,
    currency: 'UYU',
    hours: 30,
    startDaysAgo: 400,
    endDaysFromNow: -45,
    socialSecurity: 0,
    healthInsurance: 0,
    bonuses: 0,
    notes: 'demo:hr:andres',
    phone: '+598 99 100 207',
  },
];

async function seedAtlas(
  prisma: PrismaClient,
  companyId: string,
  ownerId: string,
  projectId: string | null,
  summary: string[],
) {
  await seedInvoice(prisma, companyId, projectId, summary);
  await seedHr(prisma, companyId, ownerId, projectId, summary);
  await seedAtlasDesk(prisma, companyId, projectId, summary);
}

async function ensureDepartment(prisma: PrismaClient, companyId: string, name: string, code: string) {
  const existing = await prisma.department.findFirst({ where: { companyId, name } });
  if (existing) return existing;
  return prisma.department.create({ data: { companyId, name, code, isActive: true } });
}

async function ensureStaffUser(prisma: PrismaClient, companyId: string, row: HrStaff) {
  let user = await prisma.user.findUnique({ where: { email: row.email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: row.email,
        name: row.name,
        password: '',
        role: 'COLLABORATOR',
        locale: 'es',
        isActive: true,
        phone: row.phone ?? null,
      },
    });
  } else if (row.email.endsWith('@horizonte.demo')) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { name: row.name, isActive: true, locale: 'es', phone: row.phone ?? user.phone },
    });
  }

  const link = await prisma.companyUser.findUnique({
    where: { userId_companyId: { userId: user.id, companyId } },
  });
  if (!link) {
    await prisma.companyUser.create({
      data: { userId: user.id, companyId, role: 'COLLABORATOR', isDefault: false },
    });
  }

  try {
    await prisma.$executeRaw`
      UPDATE "CompanyUser"
      SET "jobTitle" = ${row.position}, "inviteKind" = COALESCE("inviteKind", 'employee')
      WHERE "userId" = ${user.id} AND "companyId" = ${companyId}
    `;
  } catch {
    /* coluna opcional em clientes Prisma antigos */
  }
  return user;
}

async function seedHr(
  prisma: PrismaClient,
  companyId: string,
  ownerId: string,
  projectId: string | null,
  summary: string[],
) {
  const deptNames = [
    ['Dirección', 'DIR'],
    ['Programas', 'PROG'],
    ['Administración', 'ADM'],
    ['Comunicación', 'COM'],
  ] as const;
  const depts = new Map<string, string>();
  for (const [name, code] of deptNames) {
    const dept = await ensureDepartment(prisma, companyId, name, code);
    depts.set(name, dept.id);
  }

  for (const row of HR_STAFF) {
    const user = await ensureStaffUser(prisma, companyId, row);
    const deptId = depts.get(row.department);
    if (deptId) {
      const member = await prisma.departmentUser.findUnique({
        where: { userId_departmentId: { userId: user.id, departmentId: deptId } },
      });
      if (!member) {
        await prisma.departmentUser.create({
          data: { userId: user.id, departmentId: deptId, role: row.department === 'Dirección' ? 'head' : 'member' },
        });
      }
    }

    const contractData = {
      contractType: row.contractType,
      position: row.position,
      department: row.department,
      salary: row.salary,
      currency: row.currency,
      startDate: daysAgo(row.startDaysAgo),
      endDate: row.endDaysFromNow == null ? null : daysFromNow(row.endDaysFromNow),
      workHours: row.hours,
      socialSecurity: row.socialSecurity,
      healthInsurance: row.healthInsurance,
      otherDeductions: 0,
      bonuses: row.bonuses,
      notes: row.notes,
      isActive: true,
    };
    const existing = await prisma.employeeContract.findFirst({
      where: { companyId, notes: row.notes },
    });
    if (existing) {
      await prisma.employeeContract.update({ where: { id: existing.id }, data: contractData });
    } else {
      await prisma.employeeContract.create({
        data: { companyId, userId: user.id, ...contractData },
      });
    }

    if (projectId && row.dedication) {
      try {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId: user.id } },
          create: {
            projectId,
            userId: user.id,
            role: 'member',
            dedicationPct: row.dedication,
            accessMode: 'company_staff',
            status: 'active',
          },
          update: { dedicationPct: row.dedication, status: 'active' },
        });
      } catch {
        /* a dedicação é extra; o contrato já ficou gravado */
      }
    }
  }

  const byEmail = new Map<string, string>();
  for (const row of HR_STAFF) {
    const user = await prisma.user.findUnique({ where: { email: row.email }, select: { id: true } });
    if (user) byEmail.set(row.email, user.id);
  }

  const leaves: Array<{
    marker: string;
    email: string;
    type: string;
    status: string;
    start: Date;
    end: Date;
    days: number;
    reason: string;
  }> = [
    {
      marker: 'demo:leave:lucia-vacaciones',
      email: 'lucia.ferrero@horizonte.demo',
      type: 'vacation',
      status: 'pending',
      start: daysFromNow(8),
      end: daysFromNow(12),
      days: 5,
      reason: 'Vacaciones. Martín cubre las visitas de campo esa semana.',
    },
    {
      marker: 'demo:leave:martin-salud',
      email: 'martin.acosta@horizonte.demo',
      type: 'sick',
      status: 'approved',
      start: daysAgo(6),
      end: daysAgo(4),
      days: 3,
      reason: 'Reposo por lumbalgia después de la jornada de cosecha.',
    },
    {
      marker: 'demo:leave:elena-personal',
      email: 'elena.duarte@horizonte.demo',
      type: 'personal',
      status: 'pending',
      start: daysFromNow(2),
      end: daysFromNow(3),
      days: 2,
      reason: 'Trámite familiar en Montevideo. El boletín de la semana ya está programado.',
    },
    {
      marker: 'demo:leave:camila-estudio',
      email: 'camila.nunez@horizonte.demo',
      type: 'other',
      status: 'rejected',
      start: daysFromNow(20),
      end: daysFromNow(21),
      days: 2,
      reason: 'Parcial de la tecnicatura. Coincide con el cierre de monitoreo; se reprograma.',
    },
  ];

  for (const leave of leaves) {
    const userId = byEmail.get(leave.email);
    if (!userId) continue;
    const data = {
      type: leave.type,
      status: leave.status,
      startDate: leave.start,
      endDate: leave.end,
      days: leave.days,
      reason: leave.reason,
      notes: leave.marker,
      reviewedBy: leave.status === 'pending' ? null : ownerId,
      reviewedAt: leave.status === 'pending' ? null : daysAgo(1),
    };
    const existing = await prisma.leaveRequest.findFirst({
      where: { companyId, notes: leave.marker },
    });
    if (existing) {
      await prisma.leaveRequest.update({ where: { id: existing.id }, data });
    } else {
      await prisma.leaveRequest.create({ data: { companyId, userId, ...data } });
    }
  }

  summary.push('ATLAS RH: 8 contratos, nómina en UYU y USD, 4 licencias, dedicación a Cadenas Verdes');
}

async function ensureNamed<T extends { id: string }>(
  find: () => Promise<T | null>,
  create: () => Promise<T>,
) {
  return (await find()) ?? (await create());
}

async function seedAtlasDesk(
  prisma: PrismaClient,
  companyId: string,
  projectId: string | null,
  summary: string[],
) {
  const clients = [
    {
      name: 'Intendencia de Paysandú',
      type: 'government',
      contactName: 'Ana Berretta',
      email: 'compras@paysandu.gub.uy',
      city: 'Paysandú',
      country: 'UY',
      segment: 'compra pública',
      notes: 'demo:atlas:client:paysandu',
    },
    {
      name: 'Cooperativa Valle Verde',
      type: 'company',
      contactName: 'Rosa Techera',
      email: 'rosa@valleverde.uy',
      city: 'Guichón',
      country: 'UY',
      segment: 'producción',
      notes: 'demo:atlas:client:valle',
    },
    {
      name: 'Escuela Agraria Norte',
      type: 'company',
      contactName: 'Pablo Irigoyen',
      email: 'direccion@eanorte.edu.uy',
      city: 'Salto',
      country: 'UY',
      segment: 'formación',
      notes: 'demo:atlas:client:escuela',
    },
  ];
  for (const c of clients) {
    const existing = await prisma.client.findFirst({ where: { companyId, notes: c.notes } });
    const data = { ...c, isActive: true };
    if (existing) await prisma.client.update({ where: { id: existing.id }, data });
    else await prisma.client.create({ data: { companyId, ...data } });
  }

  const suppliers = [
    {
      name: 'Agroinsumos del Litoral',
      tradeName: 'Agroinsumos',
      category: 'insumos',
      city: 'Paysandú',
      country: 'UY',
      email: 'ventas@agroinsumos.uy',
      notes: 'demo:atlas:supplier:agro',
    },
    {
      name: 'Imprenta Norte',
      tradeName: 'Imprenta Norte',
      category: 'servicios',
      city: 'Salto',
      country: 'UY',
      email: 'hola@imprentanorte.uy',
      notes: 'demo:atlas:supplier:print',
    },
  ];
  const supplierIds = new Map<string, string>();
  for (const s of suppliers) {
    const row = await ensureNamed(
      () => prisma.supplier.findFirst({ where: { companyId, notes: s.notes } }),
      () => prisma.supplier.create({ data: { companyId, ...s, isActive: true } }),
    );
    if (row.notes !== s.notes) {
      await prisma.supplier.update({ where: { id: row.id }, data: s });
    }
    supplierIds.set(s.notes, row.id);
  }

  const products = [
    { sku: 'HV-KIT-01', name: 'Kit de monitoreo de humedad', category: 'equipo', stockQty: 24, minStock: 10, costPrice: 85, salePrice: 0, unit: 'unidad' },
    { sku: 'HV-SEM-LE', name: 'Semilla de lechuga', category: 'insumo', stockQty: 4, minStock: 8, costPrice: 12, salePrice: 0, unit: 'sobre' },
    { sku: 'HV-CAJA', name: 'Caja de cosecha', category: 'insumo', stockQty: 60, minStock: 20, costPrice: 6, salePrice: 0, unit: 'unidad' },
  ];
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { companyId, sku: p.sku } });
    const data = { ...p, currency: 'USD', isActive: true, location: 'Depósito Paysandú' };
    if (existing) await prisma.product.update({ where: { id: existing.id }, data });
    else await prisma.product.create({ data: { companyId, ...data } });
  }

  const agroId = supplierIds.get('demo:atlas:supplier:agro') ?? null;
  const invoices = [
    {
      number: 'INV-SBX-002',
      type: 'RECEIVABLE' as const,
      status: 'SENT' as const,
      description: 'Asistencia técnica — Escuela Agraria Norte',
      total: 8400,
      issueDaysAgo: 12,
      dueDaysFromNow: 18,
      supplierId: null as string | null,
    },
    {
      number: 'INV-SBX-003',
      type: 'PAYABLE' as const,
      status: 'OVERDUE' as const,
      description: 'Insumos de campo — Agroinsumos del Litoral',
      total: 2360,
      issueDaysAgo: 40,
      dueDaysFromNow: -10,
      supplierId: agroId,
    },
    {
      number: 'INV-SBX-004',
      type: 'PAYABLE' as const,
      status: 'PAID' as const,
      description: 'Impresión de cuadernos de campo',
      total: 640,
      issueDaysAgo: 25,
      dueDaysFromNow: -5,
      supplierId: supplierIds.get('demo:atlas:supplier:print') ?? null,
    },
  ];
  for (const inv of invoices) {
    const existing = await prisma.invoice.findFirst({ where: { companyId, number: inv.number } });
    if (existing) continue;
    await prisma.invoice.create({
      data: {
        companyId,
        projectId,
        supplierId: inv.supplierId,
        type: inv.type,
        status: inv.status,
        number: inv.number,
        description: inv.description,
        currency: 'USD',
        subtotal: inv.total,
        total: inv.total,
        issueDate: daysAgo(inv.issueDaysAgo),
        dueDate: daysFromNow(inv.dueDaysFromNow),
        paidDate: inv.status === 'PAID' ? daysAgo(5) : null,
        items: {
          create: [{ description: inv.description, quantity: 1, unitPrice: inv.total, total: inv.total, order: 0 }],
        },
      },
    });
  }

  const txs = [
    { title: 'demo:atlas:desembolso', type: 'INCOME' as const, amount: 120000, category: 'Cooperación', description: 'Primer desembolso Cadenas Verdes', days: 88, status: 'EXECUTED' },
    { title: 'demo:atlas:nomina', type: 'EXPENSE' as const, amount: 14800, category: 'Personal', description: 'Nómina del mes, convertida a USD para la caja', days: 5, status: 'EXECUTED' },
    { title: 'demo:atlas:insumos', type: 'EXPENSE' as const, amount: 2360, category: 'Campo', description: 'Insumos Agroinsumos del Litoral', days: 20, status: 'EXECUTED' },
    { title: 'demo:atlas:alquiler', type: 'EXPENSE' as const, amount: 900, category: 'Oficina', description: 'Alquiler depósito Paysandú — previsión', days: -12, status: 'FORECAST' },
    { title: 'demo:atlas:escuela', type: 'INCOME' as const, amount: 8400, category: 'Servicios', description: 'Cobro previsto Escuela Agraria Norte', days: -18, status: 'FORECAST' },
  ];
  for (const tx of txs) {
    const existing = await prisma.transaction.findFirst({ where: { companyId, title: tx.title } });
    const data = {
      type: tx.type,
      amount: tx.amount,
      currency: 'USD',
      description: tx.description,
      category: tx.category,
      date: tx.days >= 0 ? daysAgo(tx.days) : daysFromNow(-tx.days),
      executionStatus: tx.status,
      executedDate: tx.status === 'EXECUTED' ? (tx.days >= 0 ? daysAgo(tx.days) : new Date()) : null,
      projectId,
    };
    if (existing) await prisma.transaction.update({ where: { id: existing.id }, data });
    else await prisma.transaction.create({ data: { companyId, title: tx.title, ...data } });
  }

  summary.push('ATLAS: clientes, proveedores, stock, facturas y caja');
}

const RUN_TAG = '[[NEXUS_INCUBATION_RUN_V1]]';

type DemoDx = {
  sectorId: string;
  sectorName: string;
  overall: number;
  strengths: string[];
  weaknesses: string[];
  potentials: string[];
  summary: string;
};

function packRun(human: string, run: Record<string, unknown>) {
  return `${human}\n\n${RUN_TAG}${JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), ...run })}`;
}

async function ensureDemoCompany(
  prisma: PrismaClient,
  row: { shortName: string; name: string; description: string; sectorId: string },
) {
  const existing = await prisma.company.findFirst({
    where: { shortName: row.shortName, name: row.name },
  });
  const contextSetupJson = {
    v: 1,
    sectorId: row.sectorId,
    sectorIds: [row.sectorId],
    entityKind: 'sme',
    countryPrimary: 'UY',
  };
  if (existing) {
    return prisma.company.update({
      where: { id: existing.id },
      data: { description: row.description, isActive: true, contextSetupJson, contextSetupAt: new Date() },
    });
  }
  return prisma.company.create({
    data: {
      shortName: row.shortName,
      name: row.name,
      description: row.description,
      currency: 'USD',
      color: '#0F766E',
      isActive: true,
      contextSetupJson,
      contextSetupAt: new Date(),
    },
  });
}

async function seedNexusAt(
  prisma: PrismaClient,
  companyId: string,
  projectId: string | null,
  summary: string[],
) {
  const admin = await prisma.companyUser.findFirst({
    where: { companyId, role: 'ADMIN' },
    select: { userId: true },
  });
  if (!admin) {
    summary.push('NEXUS: sem administrador para criar os exemplos de AT');
    return;
  }

  const examples: Array<{
    ref: string;
    title: string;
    description: string;
    client: { shortName: string; name: string; description: string; sectorId: string };
    stage: 'start' | 'diagnosis' | 'route' | 'live';
    dx?: DemoDx;
  }> = [
    {
      ref: 'SBX-AT-START',
      title: '1 · Por empezar — desde el diagnóstico',
      description: 'MIPYME recién incorporada. Todavía no hay diagnóstico ni ruta: el técnico empieza por el cuestionario.',
      client: {
        shortName: 'Ombú',
        name: 'Quesería Ombú',
        description: 'Elaboración de quesos de campo en Paysandú. 4 personas. Aún no fue diagnosticada.',
        sectorId: 'livestock',
      },
      stage: 'start',
    },
    {
      ref: 'SBX-AT-DX',
      title: '2 · Con diagnóstico — falta la ruta',
      description: 'El diagnóstico ya está cerrado. El siguiente paso es armar la ruta de trabajo; todavía no hay actividades.',
      client: {
        shortName: 'Sierra Norte',
        name: 'Municipio Sierra Norte',
        description: 'Compra institucional de alimentos. Diagnóstico hecho; el plan de trabajo todavía no se comprometió.',
        sectorId: 'professional_services',
      },
      stage: 'diagnosis',
      dx: {
        sectorId: 'professional_services',
        sectorName: 'Servicios profesionales',
        overall: 46,
        strengths: ['Hay demanda estable de compras públicas', 'El equipo conoce a los productores locales'],
        weaknesses: ['No hay criterios escritos de calidad', 'Los plazos de pago no están calendarizados'],
        potentials: ['Acuerdo marco con tres cooperativas', 'Ficha simple de producto para la licitación'],
        summary: 'El municipio compra, pero sin ruta: falta convertir el diagnóstico en visitas y entregables.',
      },
    },
    {
      ref: 'SBX-AT-ROUTE',
      title: '3 · Ruta definida — aún no ejecutada',
      description: 'Diagnóstico y ruta de trabajo listos. Las actividades están abiertas y nadie las empezó.',
      client: {
        shortName: 'Valle Verde',
        name: 'Cooperativa Valle Verde',
        description: 'Horticultura en Salto, 86 familias. La ruta está armada y espera la primera visita.',
        sectorId: 'horticulture',
      },
      stage: 'route',
      dx: {
        sectorId: 'horticulture',
        sectorName: 'Horta / hortícolas',
        overall: 58,
        strengths: ['Producción continua de hoja y fruto', 'Vínculo con dos ferias'],
        weaknesses: ['Pérdida poscosecha alta', 'Precio puesto en chacra sin registro'],
        potentials: ['Contrato semanal con el municipio', 'Cuaderno de caja de 4 semanas'],
        summary: 'La ruta ya existe: visita de campo, precios y un comprador ancla. Todavía no se ejecutó.',
      },
    },
    {
      ref: 'SBX-AT-LIVE',
      title: '4 · Ruta en curso',
      description: 'La ruta ya se está ejecutando: hay visitas hechas, una en marcha y el resto pendiente.',
      client: {
        shortName: 'Café Andes',
        name: 'Café Andes Export',
        description: 'Comercialización de café diferenciado. La ruta está en ejecución desde hace seis semanas.',
        sectorId: 'agroindustry',
      },
      stage: 'live',
      dx: {
        sectorId: 'agroindustry',
        sectorName: 'Agroindustria / transformación',
        overall: 71,
        strengths: ['Lote trazable y comprador en Brasil', 'Ficha de calidad ya usada en dos envíos'],
        weaknesses: ['El costo por saco no incluye flete', 'Un solo canal de exportación'],
        potentials: ['Segundo comprador en Argentina', 'Margen por lote visible para la cooperativa'],
        summary: 'La ruta está en marcha: calidad cerrada, costo en curso, segundo canal todavía abierto.',
      },
    },
  ];

  for (const example of examples) {
    const client = await ensureDemoCompany(prisma, example.client);
    let engagement = await prisma.nexusAtEngagement.findFirst({
      where: { operatorCompanyId: companyId, contractRef: example.ref },
    });
    if (!engagement) {
      engagement = await prisma.nexusAtEngagement.create({
        data: {
          title: example.title,
          kind: 'CONTRACT',
          status: 'ACTIVE',
          operatorCompanyId: companyId,
          siepProjectId: projectId,
          description: example.description,
          contractRef: example.ref,
          startDate: example.stage === 'start' ? daysAgo(5) : daysAgo(70),
          endDate: daysFromNow(180),
          projects: {
            create: [
              {
                name: 'Acompañamiento',
                description: example.description,
                siepProjectId: projectId,
                status: 'ACTIVE',
              },
            ],
          },
        },
      });
    } else {
      await prisma.nexusAtEngagement.update({
        where: { id: engagement.id },
        data: { title: example.title, description: example.description, isActive: true, status: 'ACTIVE' },
      });
    }

    const project =
      (await prisma.nexusAtProject.findFirst({
        where: { engagementId: engagement.id, isActive: true },
        orderBy: { sortOrder: 'asc' },
      })) ||
      (await prisma.nexusAtProject.create({
        data: {
          engagementId: engagement.id,
          name: 'Acompañamiento',
          description: example.description,
          siepProjectId: projectId,
          status: 'ACTIVE',
        },
      }));

    await prisma.nexusAtEngagementMember.upsert({
      where: { engagementId_companyId: { engagementId: engagement.id, companyId } },
      create: { engagementId: engagement.id, companyId, memberRole: 'operator', sortOrder: 0 },
      update: { memberRole: 'operator' },
    });
    await prisma.nexusAtEngagementMember.upsert({
      where: { engagementId_companyId: { engagementId: engagement.id, companyId: client.id } },
      create: {
        engagementId: engagement.id,
        companyId: client.id,
        memberRole: 'client',
        sortOrder: 1,
        notes: example.client.description,
      },
      update: { memberRole: 'client', notes: example.client.description },
    });

    if (example.stage === 'start') {
      summary.push(`NEXUS AT: ${example.client.shortName} por empezar`);
      continue;
    }

    const program = {
      mode: 'intensive',
      durationMonths: 6,
      hoursPerMonth: 8,
      totalHours: 48,
      ventureStage: example.stage === 'live' ? 'BUILD' : 'FOCUS',
      strategicHorizon: 'none',
      deliveryKind: 'at_assisted',
      diagnosticDepth: 'standard',
      atEngagementId: engagement.id,
      atProjectId: project.id,
      siepProjectId: projectId,
    };
    const dx = example.dx!;
    const diagnosis = {
      id: `dx-${example.ref}`,
      at: daysAgo(example.stage === 'live' ? 40 : 12).toISOString(),
      sectorId: dx.sectorId,
      sectorName: dx.sectorName,
      overall: dx.overall,
      strengths: dx.strengths,
      weaknesses: dx.weaknesses,
      potentials: dx.potentials,
      pillarScores: [
        { slug: 'commercial', name: 'Comercial', score: dx.overall },
        { slug: 'operations', name: 'Operaciones', score: Math.max(30, dx.overall - 8) },
      ],
      summary: dx.summary,
    };

    const withRoute = example.stage === 'route' || example.stage === 'live';
    const layers = withRoute
      ? [
          {
            index: 0,
            title: 'Base comercial',
            monthStart: 1,
            monthEnd: 2,
            hoursBudget: 16,
            goals: ['Oferta clara', 'Primer comprador'],
            status: example.stage === 'live' ? 'active' : 'active',
            taskIds: [] as string[],
          },
          {
            index: 1,
            title: 'Operación y margen',
            monthStart: 3,
            monthEnd: 6,
            hoursBudget: 32,
            goals: ['Costo visible', 'Entrega semanal'],
            status: 'pending',
            taskIds: [] as string[],
          },
        ]
      : [];

    const notes = packRun(dx.summary, {
      program,
      targetCompanyId: client.id,
      networkId: null,
      diagnosis,
      diagnosisHistory: [diagnosis],
      layers,
      strategicPlan: withRoute
        ? {
            horizon: '12m',
            vision: `${example.client.shortName}: vender con precio y comprador definidos.`,
            pillars: [{ name: 'Comercial', milestones: ['Comprador ancla', 'Precio de referencia'] }],
          }
        : null,
      currentLayerIndex: 0,
      advances: [
        { at: diagnosis.at, type: 'diagnosis', label: `Diagnóstico ${dx.sectorName} · ${dx.overall}/100` },
        ...(withRoute
          ? [{ at: daysAgo(8).toISOString(), type: 'plan_commit', label: 'Ruta de trabajo comprometida' }]
          : []),
      ],
      toolsImplemented: [],
      workItemTaskMap: {},
      committedAt: withRoute ? daysAgo(8).toISOString() : undefined,
    });

    await prisma.nexusVentureState.upsert({
      where: { companyId: client.id },
      create: { companyId: client.id, stage: program.ventureStage, incubatorNotes: notes },
      update: { stage: program.ventureStage, incubatorNotes: notes },
    });

    if (withRoute) {
      const items =
        example.stage === 'live'
          ? [
              { wi: 'live-1', layer: 0, title: 'Ficha de calidad del lote', status: 'DONE' as const, kind: 'deliverable', due: -20 },
              { wi: 'live-2', layer: 0, title: 'Visita: costo por saco con flete', status: 'IN_PROGRESS' as const, kind: 'visit', due: 4 },
              { wi: 'live-3', layer: 1, title: 'Segundo comprador en Argentina', status: 'TODO' as const, kind: 'followup', due: 21 },
            ]
          : [
              { wi: 'route-1', layer: 0, title: 'Visita de campo: pérdida poscosecha', status: 'TODO' as const, kind: 'visit', due: 10 },
              { wi: 'route-2', layer: 0, title: 'Cuaderno de precios de feria', status: 'TODO' as const, kind: 'deliverable', due: 18 },
              { wi: 'route-3', layer: 1, title: 'Borrador de contrato semanal', status: 'TODO' as const, kind: 'followup', due: 30 },
            ];
      for (const item of items) {
        const marker = `sbx-wi:${example.ref}:${item.wi}`;
        const tags = [
          'nexus:roadmap',
          'nexus:incubation',
          'pillar:commercial',
          `incubation:layer:${item.layer}`,
          'horizon:program',
          `incubation:kind:${item.kind === 'followup' ? 'review' : item.kind}`,
          `incubation:wi:${item.wi}`,
          `nexus:at-engagement:${engagement.id}`,
          marker,
        ].join(',');
        const existingTask = await prisma.task.findFirst({
          where: { companyId: client.id, tags: { contains: marker } },
        });
        if (!existingTask) {
          await prisma.task.create({
            data: {
              companyId: client.id,
              creatorId: admin.userId,
              projectId,
              title: item.title,
              description: dx.summary,
              priority: 'HIGH',
              status: item.status,
              dueDate: item.due < 0 ? daysAgo(-item.due) : daysFromNow(item.due),
              completedAt: item.status === 'DONE' ? daysAgo(-item.due) : null,
              tags,
              isActive: true,
            },
          });
        }
        const caseMarker = `sbx-case:${example.ref}:${item.wi}`;
        const caseTags = `nexus:at,nexus:at-engagement:${engagement.id},nexus:at-project:${project.id},at-kind:${item.kind === 'deliverable' ? 'diagnosis' : item.kind === 'followup' ? 'followup' : 'visit'},${caseMarker}`;
        const existingCase = await prisma.task.findFirst({
          where: { companyId: client.id, tags: { contains: caseMarker } },
        });
        if (!existingCase) {
          await prisma.task.create({
            data: {
              companyId: client.id,
              creatorId: admin.userId,
              projectId,
              title: `[AT] ${item.title}`,
              description: dx.summary,
              priority: 'HIGH',
              status: item.status,
              dueDate: item.due < 0 ? daysAgo(-item.due) : daysFromNow(item.due),
              completedAt: item.status === 'DONE' ? daysAgo(-item.due) : null,
              tags: caseTags,
              isActive: true,
            },
          });
        }
      }
    }

    summary.push(`NEXUS AT: ${example.client.shortName} · ${example.stage}`);
  }

  await prisma.nexusAtEngagement.updateMany({
    where: { operatorCompanyId: companyId, contractRef: 'SBX-AT-001' },
    data: { isActive: false },
  });

  const selfDx = {
    id: 'dx-sbx-self',
    at: daysAgo(50).toISOString(),
    sectorId: 'ngo',
    sectorName: 'Cooperación y desarrollo rural',
    overall: 64,
    strengths: ['Programa Cadenas Verdes con familias activas', 'Relato para donantes ya escrito'],
    weaknesses: ['El margen de la escuela rural no está cerrado', 'Pocos indicadores se actualizan solos'],
    potentials: ['Segunda convocatoria con el perfil de captura ya armado', 'Tablero de 4 indicadores en PRISM'],
    pillarScores: [
      { slug: 'strategy', name: 'Estrategia', score: 70 },
      { slug: 'finance', name: 'Finanzas', score: 55 },
      { slug: 'commercial', name: 'Comercial', score: 62 },
    ],
    summary: 'Horizonte ya recorrió diagnóstico y ruta: la capa comercial está avanzada y la de fondos sigue abierta.',
  };
  const selfNotes = packRun(
    'Autodesarrollo en marcha: diagnóstico cerrado, ruta viva y dos herramientas ya en uso.',
    {
      program: {
        mode: 'ongoing',
        durationMonths: 12,
        hoursPerMonth: 4,
        totalHours: 48,
        ventureStage: 'BUILD',
        strategicHorizon: '12m',
        deliveryKind: 'self_ai',
        diagnosticDepth: 'standard',
        atEngagementId: null,
        atProjectId: null,
        siepProjectId: projectId,
      },
      targetCompanyId: companyId,
      networkId: null,
      diagnosis: selfDx,
      diagnosisHistory: [selfDx],
      layers: [
        {
          index: 0,
          title: 'Oferta y relato',
          monthStart: 1,
          monthEnd: 3,
          hoursBudget: 16,
          goals: ['Narrativa de donantes', 'Oferta de asistencia'],
          status: 'active',
          taskIds: [],
        },
        {
          index: 1,
          title: 'Fondos y evidencia',
          monthStart: 4,
          monthEnd: 8,
          hoursBudget: 20,
          goals: ['Indicadores vivos', 'Próxima convocatoria'],
          status: 'pending',
          taskIds: [],
        },
      ],
      strategicPlan: {
        horizon: '12m',
        vision: 'Horizonte Verde sostiene las cadenas con evidencia y una carpeta de fondos siempre lista.',
        pillars: [
          { name: 'Relato', milestones: ['Narrativa publicada', 'Dos aliados nombrados'] },
          { name: 'Evidencia', milestones: ['4 indicadores en PRISM', 'Informe trimestral'] },
        ],
      },
      currentLayerIndex: 1,
      advances: [
        { at: selfDx.at, type: 'diagnosis', label: 'Diagnóstico de la propia organización · 64/100' },
        { at: daysAgo(30).toISOString(), type: 'plan_commit', label: 'Ruta de autodesarrollo comprometida' },
        { at: daysAgo(10).toISOString(), type: 'layer_complete', label: 'Capa Oferta y relato casi cerrada' },
      ],
      toolsImplemented: [
        { id: 'tool-narrativa', name: 'Narrativa para donantes', category: 'strategy', implementedAt: daysAgo(20).toISOString() },
        { id: 'tool-prism', name: 'Tablero PRISM (2 indicadores)', category: 'digital', implementedAt: daysAgo(6).toISOString() },
      ],
      workItemTaskMap: {},
      committedAt: daysAgo(30).toISOString(),
    },
  );
  await prisma.nexusVentureState.upsert({
    where: { companyId },
    create: {
      companyId,
      stage: 'BUILD',
      targetRegions: 'UY,AR,BR',
      incubatorNotes: selfNotes,
    },
    update: {
      stage: 'BUILD',
      targetRegions: 'UY,AR,BR',
      incubatorNotes: selfNotes,
    },
  });

  const selfItems = [
    { wi: 'self-1', layer: 0, title: 'Cerrar narrativa para donantes', status: 'DONE' as const, due: -20 },
    { wi: 'self-2', layer: 0, title: 'Nombrar dos aliados de la coalición', status: 'DONE' as const, due: -8 },
    { wi: 'self-3', layer: 1, title: 'Actualizar indicadores de familias y talleres', status: 'IN_PROGRESS' as const, due: 5 },
    { wi: 'self-4', layer: 1, title: 'Elegir la próxima convocatoria del mapa', status: 'TODO' as const, due: 14 },
  ];
  for (const item of selfItems) {
    const marker = `sbx-wi:SELF:${item.wi}`;
    const existingTask = await prisma.task.findFirst({
      where: { companyId, tags: { contains: marker } },
    });
    if (existingTask) continue;
    await prisma.task.create({
      data: {
        companyId,
        creatorId: admin.userId,
        projectId,
        title: item.title,
        description: selfDx.summary,
        priority: 'HIGH',
        status: item.status,
        dueDate: item.due < 0 ? daysAgo(-item.due) : daysFromNow(item.due),
        completedAt: item.status === 'DONE' ? daysAgo(-item.due) : null,
        tags: `nexus:roadmap,nexus:incubation,pillar:strategy,incubation:layer:${item.layer},horizon:program,incubation:kind:deliverable,incubation:wi:${item.wi},${marker}`,
        isActive: true,
      },
    });
  }
  summary.push('NEXUS: autodesarrollo de Horizonte ya en marcha');
}

type DiagBlockSeed = {
  id: string;
  status: 'done' | 'active';
  level: number;
  situation: string;
  gap: string;
  potential: string;
  userLine: string;
};

function auroraInterview(
  tech: { userId: string; name: string } | null,
  blocks: DiagBlockSeed[],
  activeBlockId: string | null,
  thread: Array<{ role: 'assistant' | 'user'; text: string }>,
) {
  const blockMap: Record<string, unknown> = {};
  for (const block of blocks) {
    const active = block.status === 'active' && block.id === activeBlockId;
    blockMap[block.id] = {
      id: block.id,
      status: block.status,
      level: block.status === 'done' ? block.level : null,
      situation: block.situation,
      gap: block.gap,
      potential: block.potential,
      messages: [
        {
          role: 'assistant',
          text: 'Contame cómo funciona esto hoy, con un ejemplo de la última semana.',
        },
        { role: 'user', text: block.userLine },
        {
          role: 'assistant',
          text: active
            ? `Queda así: ${block.situation} La brecha es «${block.gap}». El potencial es «${block.potential}». ¿Lo confirmamos?`
            : `Anotado. ${block.situation}`,
        },
      ],
      pending: active
        ? {
            reply: `Propongo dejar este bloque en ${block.level}. ${block.situation}`,
            ready: true,
            level: block.level,
            situation: block.situation,
            gap: block.gap,
            potential: block.potential,
          }
        : null,
      confirmedAt: block.status === 'done' ? daysAgo(6).toISOString() : null,
    };
  }
  const interview: Record<string, unknown> = {
    __auroraThread: thread,
    __auroraDiagnostic: {
      version: 1,
      activeBlockId,
      blocks: blockMap,
      updatedAt: new Date().toISOString(),
    },
  };
  if (tech) {
    interview.__auroraTech = { userId: tech.userId, name: tech.name, claimedAt: daysAgo(20).toISOString() };
  }
  return interview;
}

async function upsertDossier(
  prisma: PrismaClient,
  companyId: string,
  userId: string,
  data: {
    portraitText: string;
    hypothesis: string;
    hypothesisAccepted: boolean;
    gapsJson: Array<{ text: string; evidence?: string }>;
    potentialsJson: Array<{ text: string; evidence?: string }>;
    interviewJson: Record<string, unknown>;
    pulsoModule?: string | null;
  },
) {
  await prisma.businessDossier.upsert({
    where: { companyId },
    create: { companyId, updatedByUserId: userId, ...data },
    update: { updatedByUserId: userId, ...data },
  });
}

async function ensureBet(
  prisma: PrismaClient,
  companyId: string,
  bet: { title: string; why: string; status: string; dueDays: number | null; sortOrder: number },
) {
  const existing = await prisma.businessBet.findFirst({ where: { companyId, title: bet.title } });
  const dueAt = bet.dueDays == null ? null : daysFromNow(bet.dueDays);
  if (existing) {
    await prisma.businessBet.update({
      where: { id: existing.id },
      data: { why: bet.why, status: bet.status, dueAt, sortOrder: bet.sortOrder },
    });
    return;
  }
  await prisma.businessBet.create({
    data: { companyId, title: bet.title, why: bet.why, status: bet.status, dueAt, sortOrder: bet.sortOrder, ownerLabel: 'Técnico de campo' },
  });
}

async function seedAuroraAndRadar(
  prisma: PrismaClient,
  companyId: string,
  ownerId: string,
  summary: string[],
) {
  const master = await prisma.user.findFirst({
    where: { email: 'master.horizonte@etholys.com' },
    select: { id: true, name: true },
  });
  const tech = { userId: master?.id || ownerId, name: master?.name || 'Dirección Horizonte' };

  const clients = await prisma.company.findMany({
    where: { shortName: { in: ['Ombú', 'Sierra Norte', 'Valle Verde', 'Café Andes'] } },
    select: { id: true, shortName: true },
  });
  const byShort = new Map(clients.map((c) => [c.shortName, c.id]));

  const ombu = byShort.get('Ombú');
  if (ombu) {
    await upsertDossier(prisma, ombu, tech.userId, {
      portraitText: '',
      hypothesis: '',
      hypothesisAccepted: false,
      gapsJson: [],
      potentialsJson: [],
      interviewJson: auroraInterview(
        null,
        [
          {
            id: 'governance',
            status: 'active',
            level: 2,
            situation: 'La quesería la lleva una familia. No hay roles escritos.',
            gap: 'Todo está en una sola cabeza',
            potential: 'Repartir producción y venta',
            userLine: 'Somos cuatro. Mi hermano hace el queso y yo vendo en la feria. No anotamos nada.',
          },
        ],
        'governance',
        [
          { role: 'assistant', text: '¿Qué venden y quién decide el precio esta semana?' },
          { role: 'user', text: 'Queso de campo. El precio lo pongo yo el sábado, según lo que vi en la feria.' },
          { role: 'assistant', text: '¿Dónde queda anotada la producción de la semana?' },
          { role: 'user', text: 'En la cabeza de mi hermano. Si él no está, no sabemos cuántos quesos salieron.' },
        ],
      ),
    });
  }

  const sierra = byShort.get('Sierra Norte');
  if (sierra) {
    await upsertDossier(prisma, sierra, tech.userId, {
      portraitText:
        'El municipio compra alimentos a productores del norte, pero la calidad se decide de palabra. Hay demanda estable y tres cooperativas conocidas. Todavía no hay una ficha ni un calendario de pago.',
      hypothesis:
        'Si el municipio escribe criterios de calidad y un calendario de pago, puede comprar a tres cooperativas sin depender de un intermediario.',
      hypothesisAccepted: false,
      gapsJson: [
        { text: 'Criterios de calidad solo orales', evidence: 'conversa' },
        { text: 'Plazos de pago sin calendario', evidence: 'conversa' },
      ],
      potentialsJson: [{ text: 'Acuerdo marco con tres cooperativas', evidence: 'conversa' }],
      interviewJson: auroraInterview(
        tech,
        [
          { id: 'governance', status: 'done', level: 2, situation: 'La compra la decide una persona. No hay acta.', gap: 'Sin criterio escrito', potential: 'Una ficha de una página', userLine: 'Lo decide la encargada de compras. No queda escrito.' },
          { id: 'finance', status: 'done', level: 2, situation: 'Pagan cuando hay saldo. Los productores no saben la fecha.', gap: 'Pago imprevisible', potential: 'Calendario de 30 días', userLine: 'El mes pasado pagamos a los 47 días. Nadie avisa antes.' },
          { id: 'operations', status: 'done', level: 3, situation: 'Hay depósito y una balanza. La recepción no se registra.', gap: 'Recepción sin registro', potential: 'Planilla de ingreso', userLine: 'Pesamos en el depósito, pero el papel se pierde.' },
          { id: 'commercial', status: 'active', level: 2, situation: 'Compran a quien llega. No hay lista de proveedores ni ficha de producto.', gap: 'Sin ficha de calidad', potential: 'Tres cooperativas con acuerdo', userLine: 'Conocemos a Valle Verde y a dos más, pero cada compra se arma por teléfono.' },
        ],
        'commercial',
        [
          { role: 'assistant', text: '¿A quién le compran hoy y cómo eligen al proveedor?' },
          { role: 'user', text: 'A quien tenga mercadería esa semana. Llamamos y vemos el precio.' },
          { role: 'assistant', text: '¿Qué tendría que ser verdad para comprarles seguido a las cooperativas?' },
          { role: 'user', text: 'Saber qué es aceptable y cuándo vamos a pagar. Hoy las dos cosas se hablan y se olvidan.' },
        ],
      ),
    });
  }

  const valle = byShort.get('Valle Verde');
  if (valle) {
    await upsertDossier(prisma, valle, tech.userId, {
      portraitText:
        'Cooperativa de 86 familias en Salto. Producen hoja y fruto de forma continua y venden en dos ferias. Pierden producto después de la cosecha porque la feria no retira el mismo día y el precio no queda anotado.',
      hypothesis:
        'La pérdida poscosecha baja si la feria retira el mismo día y el precio de cada jornada queda en un cuaderno compartido.',
      hypothesisAccepted: true,
      gapsJson: [
        { text: 'Pérdida poscosecha alta', evidence: 'conversa' },
        { text: 'Precio de feria sin registro', evidence: 'conversa' },
      ],
      potentialsJson: [
        { text: 'Contrato semanal con el municipio', evidence: 'conversa' },
        { text: 'Cuaderno de caja de 4 semanas', evidence: 'conversa' },
      ],
      interviewJson: auroraInterview(
        tech,
        [
          { id: 'governance', status: 'done', level: 3, situation: 'Hay comisión. Las decisiones de precio siguen siendo de la feria.', gap: 'Precio sin dueño', potential: 'Acuerdo de precio mínimo', userLine: 'La comisión se reúne. El precio lo termina poniendo la feria.' },
          { id: 'finance', status: 'done', level: 2, situation: 'La caja está en un cuaderno de una familia.', gap: 'Caja personal', potential: 'Caja semanal de la cooperativa', userLine: 'Anota María, en su casa. Si falta, no hay números.' },
          { id: 'operations', status: 'done', level: 3, situation: 'Cosechan seguido. El frío es una heladera doméstica.', gap: 'Frío insuficiente', potential: 'Retiro el mismo día', userLine: 'Lo que no se vende el sábado se echa a perder el lunes.' },
          { id: 'people', status: 'done', level: 3, situation: 'Las familias saben producir. Falta quien anote.', gap: 'Sin rol de registro', potential: 'Una persona por feria', userLine: 'Producir sabemos. Anotar, no hay quien lo tome como tarea.' },
          { id: 'commercial', status: 'done', level: 3, situation: 'Dos ferias compran. No hay contrato.', gap: 'Venta solo de mostrador', potential: 'Pedido semanal fijo', userLine: 'Vendemos en dos ferias. Nadie nos encarga de una semana a la otra.' },
          { id: 'systems', status: 'active', level: 2, situation: 'El dato vive en cuadernos distintos. No hay un lugar único para precio y merma.', gap: 'Sin tablero de la semana', potential: 'Una planilla compartida de feria', userLine: 'Cada familia tiene su cuaderno. No los juntamos.' },
        ],
        'systems',
        [
          { role: 'assistant', text: '¿Cuánto se pierde entre la chacra y la feria?' },
          { role: 'user', text: 'No lo medimos. El sábado vuelve cajón y el lunes se tira lo que quedó.' },
          { role: 'assistant', text: 'La hipótesis ya está aceptada: retiro el mismo día y precio anotado. ¿Cuál es la apuesta de esta semana?' },
          { role: 'user', text: 'Una visita para pesar lo que se tira. Con eso armamos el pedido semanal.' },
        ],
      ),
    });
    await ensureBet(prisma, valle, {
      title: 'Visita: pérdida poscosecha',
      why: 'Medir cuánto se tira entre la chacra y la feria antes de armar la ruta completa.',
      status: 'accepted',
      dueDays: 10,
      sortOrder: 0,
    });
  }

  const cafe = byShort.get('Café Andes');
  if (cafe) {
    await upsertDossier(prisma, cafe, tech.userId, {
      portraitText:
        'Comercializan café diferenciado con lote trazable y un comprador en el sur de Brasil. La ficha de calidad ya se usó en dos envíos. El costo por saco todavía no incluye el flete y no hay un segundo canal.',
      hypothesis:
        'El margen se ve cuando el flete entra en el costo por saco y existe un segundo comprador que no depende del primero.',
      hypothesisAccepted: true,
      gapsJson: [
        { text: 'Flete fuera del costo', evidence: 'conversa' },
        { text: 'Un solo canal de exportación', evidence: 'conversa' },
      ],
      potentialsJson: [
        { text: 'Segundo comprador en Argentina', evidence: 'conversa' },
        { text: 'Margen por lote visible', evidence: 'conversa' },
      ],
      pulsoModule: 'agroindustry',
      interviewJson: auroraInterview(
        tech,
        [
          { id: 'governance', status: 'done', level: 4, situation: 'Hay responsable de calidad y de venta. Las decisiones quedan en acta.', gap: 'El flete no tiene dueño', potential: 'Dueño del costo logístico', userLine: 'Calidad y venta tienen nombre. El flete no.' },
          { id: 'finance', status: 'done', level: 3, situation: 'Conocen el precio de venta. El flete se mira después.', gap: 'Margen incompleto', potential: 'Costo por saco con flete', userLine: 'Sabemos a cuánto vendemos. El camión se paga aparte y no entra en el saco.' },
          { id: 'operations', status: 'done', level: 4, situation: 'El lote se identifica. La planta registra humedad y defecto.', gap: 'Sin meta de merma', potential: 'Merma máxima por lote', userLine: 'Cada lote tiene número. Anotamos humedad y defecto.' },
          { id: 'people', status: 'done', level: 3, situation: 'El equipo de planta está formado. La venta depende de una persona.', gap: 'Venta en una sola cabeza', potential: 'Segundo contacto comercial', userLine: 'Si Ana no está, nadie habla con el comprador.' },
          { id: 'commercial', status: 'done', level: 4, situation: 'Un comprador repite. Paga por calidad.', gap: 'Concentración de cliente', potential: 'Comprador en Argentina', userLine: 'Brasil compra seguido y paga mejor si el defecto es bajo. No hay otro.' },
          { id: 'systems', status: 'done', level: 3, situation: 'La ficha está en planilla. No entra sola al lote.', gap: 'Planilla suelta', potential: 'Ficha ligada al lote', userLine: 'La ficha está en Excel. Hay que copiarla a mano en el lote.' },
        ],
        'commercial',
        [
          { role: 'assistant', text: '¿El margen del último envío incluye el flete?' },
          { role: 'user', text: 'No. El flete llegó después y lo pagamos de caja. El saco parecía rendir más de lo que rindió.' },
          { role: 'assistant', text: 'La hipótesis ya está aceptada y hay tres apuestas abiertas. ¿Qué trabó esta semana?' },
          { role: 'user', text: 'El transportista no mandó el costo desglosado. Sin eso no cerramos el costo por saco.' },
        ],
      ),
    });
    await ensureBet(prisma, cafe, {
      title: 'Incluir el flete en el costo por saco',
      why: 'Sin el flete el margen de los dos envíos está inflado.',
      status: 'active',
      dueDays: 4,
      sortOrder: 0,
    });
    await ensureBet(prisma, cafe, {
      title: 'Abrir un comprador en Argentina',
      why: 'Un solo canal deja el lote sin alternativa si el comprador de Brasil frena.',
      status: 'accepted',
      dueDays: 21,
      sortOrder: 1,
    });
    await ensureBet(prisma, cafe, {
      title: 'Revisión semanal del lote',
      why: 'La ficha de calidad ya existe; falta mirarla cada semana con la planta.',
      status: 'active',
      dueDays: 7,
      sortOrder: 2,
    });
    const rhythmMarker = 'demo:aurora-cafe-week';
    const rhythm = await prisma.businessRhythmNote.findFirst({
      where: { companyId: cafe, happened: { contains: rhythmMarker } },
    });
    const happened = `${rhythmMarker} Se cerró la ficha del segundo envío y el comprador de Brasil confirmó el lote.`;
    const rhythmData = {
      happened,
      blocked: 'El transportista no pasó el costo del flete desglosado.',
      nextStep: 'Pedir el desglose y armar el costo por saco antes del viernes.',
      source: 'app',
    };
    if (rhythm) {
      await prisma.businessRhythmNote.update({ where: { id: rhythm.id }, data: { ...rhythmData, createdAt: daysAgo(1) } });
    } else {
      await prisma.businessRhythmNote.create({ data: { companyId: cafe, ...rhythmData, createdAt: daysAgo(1) } });
    }
  }

  summary.push('AURORA: cartera en conversación, retrato, apuesta y ritmo');

  await seedRadarFarm(prisma, companyId, ownerId, summary);
}

async function seedRadarFarm(prisma: PrismaClient, companyId: string, ownerId: string, summary: string[]) {
  // Praça do Buriti (Brasília) — pin OSM for client walkthroughs of Ver/Seguir/Fazer/Quem.
  const DEMO_LAT = -15.7995;
  const DEMO_LNG = -47.9139;
  const PROPERTY_NAME = 'Finca escuela';

  let property = await prisma.radarProperty.findFirst({
    where: { companyId, name: PROPERTY_NAME },
  });
  if (!property) {
    property = await prisma.radarProperty.create({
      data: {
        companyId,
        name: PROPERTY_NAME,
        moduleId: 'agriculture',
        crop: 'Horticultura mixta',
        areaHa: 7.5,
        lat: DEMO_LAT,
        lng: DEMO_LNG,
      },
    });
  } else {
    property = await prisma.radarProperty.update({
      where: { id: property.id },
      data: {
        moduleId: 'agriculture',
        crop: 'Horticultura mixta',
        areaHa: 7.5,
        lat: DEMO_LAT,
        lng: DEMO_LNG,
      },
    });
  }

  const parcels = [
    { name: 'Cantero Norte', crop: 'Lechuga', areaHa: 1.2, key: 'norte', x: 18, y: 22, w: 22, h: 18, rotation: 8 },
    { name: 'Cantero Sur', crop: 'Tomate', areaHa: 0.8, key: 'sur', x: 48, y: 55, w: 20, h: 16, rotation: -6 },
    { name: 'Loma Este', crop: 'Zapallo', areaHa: 2.4, key: 'loma', x: 62, y: 20, w: 24, h: 20, rotation: 15 },
    { name: 'Bajo del monte', crop: 'Maíz', areaHa: 3.1, key: 'bajo', x: 22, y: 58, w: 26, h: 22, rotation: 0 },
  ];
  const unitIds = new Map<string, string>();
  for (const parcel of parcels) {
    const existing = await prisma.nexusOpsUnit.findFirst({
      where: { companyId, name: parcel.name, OR: [{ propertyId: property.id }, { propertyId: null }] },
    });
    const row = existing
      ? await prisma.nexusOpsUnit.update({
          where: { id: existing.id },
          data: {
            propertyId: property.id,
            kind: 'parcel',
            sectorId: 'agriculture',
            crop: parcel.crop,
            areaHa: parcel.areaHa,
            isActive: true,
          },
        })
      : await prisma.nexusOpsUnit.create({
          data: {
            companyId,
            propertyId: property.id,
            name: parcel.name,
            kind: 'parcel',
            sectorId: 'agriculture',
            crop: parcel.crop,
            areaHa: parcel.areaHa,
            notes: 'Finca escuela de Horizonte Verde — parcela de demostración.',
            isActive: true,
          },
        });
    unitIds.set(parcel.key, row.id);
  }

  const crops = [
    { id: 'crop_lechuga', name: 'Lechuga', variety: 'Crespa', season: 'Primavera' },
    { id: 'crop_tomate', name: 'Tomate', variety: 'Perita', season: 'Verano' },
    { id: 'crop_zapallo', name: 'Zapallo', variety: 'Cabutia', season: 'Otoño' },
    { id: 'crop_maiz', name: 'Maíz', variety: 'Choclo', season: 'Verano' },
  ];
  const layoutJson = {
    version: 1 as const,
    spaces: parcels.map((p) => ({
      id: unitIds.get(p.key)!,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      rotation: p.rotation,
      placed: true,
    })),
    sensors: [] as Array<{ id: string; spaceId: string | null; x: number; y: number }>,
    crops,
    devices: [] as Array<{ sensorId: string; sku: string; devEui: string | null; unitId: string | null }>,
    commands: [] as unknown[],
  };

  const lines: Array<{
    key: string;
    unit: string;
    kind: string;
    daysAgo: number;
    channel: string;
    payload: Record<string, unknown>;
  }> = [
    { key: 'norte-plant', unit: 'norte', kind: 'planting', daysAgo: 24, channel: 'app', payload: { note: 'Trasplante de lechuga. Riego de asiento.', demoKey: 'norte-plant' } },
    { key: 'norte-input', unit: 'norte', kind: 'input', daysAgo: 2, channel: 'app', payload: { note: 'Aplicación de cobre. No cosechar hasta cumplir la carencia.', product: 'cobre', phiDays: 12, demoKey: 'norte-input' } },
    { key: 'sur-irrig', unit: 'sur', kind: 'irrigation', daysAgo: 6, channel: 'whatsapp', payload: { note: 'Regamos 10 mm al atardecer. El suelo sigue claro.', mm: 10, demoKey: 'sur-irrig' } },
    { key: 'sur-obs', unit: 'sur', kind: 'observation', daysAgo: 1, channel: 'whatsapp', payload: { note: 'Hojas caídas al mediodía. Parece falta de agua, no plaga.', demoKey: 'sur-obs' } },
    { key: 'loma-obs', unit: 'loma', kind: 'observation', daysAgo: 1, channel: 'app', payload: { note: 'Fruto cuajado. Sin plaga visible. Humedad en rango.', demoKey: 'loma-obs' } },
    { key: 'bajo-obs', unit: 'bajo', kind: 'observation', daysAgo: 18, channel: 'app', payload: { note: 'Última recorrida: maíz en grano lechoso. Hace más de dos semanas que nadie anota.', demoKey: 'bajo-obs' } },
  ];

  for (const line of lines) {
    const unitId = unitIds.get(line.unit);
    if (!unitId) continue;
    const payload = { ...line.payload, demoKey: line.key };
    const existing = await prisma.nexusFieldEntry.findFirst({
      where: { companyId, payloadJson: { path: ['demoKey'], equals: line.key } },
    });
    const data = {
      unitId,
      kind: line.kind,
      occurredAt: daysAgo(line.daysAgo),
      payloadJson: payload,
      channel: line.channel,
      authorUserId: ownerId,
    };
    if (existing) await prisma.nexusFieldEntry.update({ where: { id: existing.id }, data });
    else await prisma.nexusFieldEntry.create({ data: { companyId, ...data } });
  }

  const readings: Array<{ unit: string; metric: string; value: number; unitLabel: string; hoursAgo: number; source: string }> = [
    { unit: 'norte', metric: 'soil_moisture', value: 41, unitLabel: '%', hoursAgo: 3, source: 'sensor' },
    { unit: 'sur', metric: 'soil_moisture', value: 18, unitLabel: '%', hoursAgo: 2, source: 'sensor' },
    { unit: 'sur', metric: 'irrigation_mm', value: 10, unitLabel: 'mm', hoursAgo: 6 * 24, source: 'manual' },
    { unit: 'loma', metric: 'soil_moisture', value: 51, unitLabel: '%', hoursAgo: 20, source: 'sensor' },
    { unit: 'bajo', metric: 'soil_moisture', value: 36, unitLabel: '%', hoursAgo: 18 * 24, source: 'manual' },
  ];
  for (const reading of readings) {
    const unitId = unitIds.get(reading.unit);
    if (!unitId) continue;
    const recordedAt = new Date(Date.now() - reading.hoursAgo * 60 * 60 * 1000);
    const existing = await prisma.nexusReading.findFirst({
      where: { companyId, unitId, metric: reading.metric, source: reading.source },
      orderBy: { recordedAt: 'desc' },
    });
    if (existing) {
      await prisma.nexusReading.update({
        where: { id: existing.id },
        data: { value: reading.value, unit: reading.unitLabel, recordedAt },
      });
    } else {
      await prisma.nexusReading.create({
        data: {
          companyId,
          unitId,
          metric: reading.metric,
          value: reading.value,
          unit: reading.unitLabel,
          source: reading.source,
          recordedAt,
        },
      });
    }
  }

  const surId = unitIds.get('sur');
  const norteId = unitIds.get('norte');
  if (surId) {
    const tokenHash = createHash('sha256').update('etholys-demo-sonda-cantero-sur').digest('hex');
    const sensor = await prisma.nexusSensor.upsert({
      where: { tokenHash },
      create: {
        companyId,
        unitId: surId,
        name: 'Sonda Cantero Sur',
        metric: 'soil_moisture',
        tokenHash,
        lastSeenAt: new Date(),
        isActive: true,
      },
      update: { unitId: surId, name: 'Sonda Cantero Sur', lastSeenAt: new Date(), isActive: true },
    });
    const latest = await prisma.nexusReading.findFirst({
      where: { companyId, unitId: surId, metric: 'soil_moisture', source: 'sensor' },
      orderBy: { recordedAt: 'desc' },
    });
    if (latest && !latest.sensorId) {
      await prisma.nexusReading.update({ where: { id: latest.id }, data: { sensorId: sensor.id } });
    }
    layoutJson.sensors = [{ id: sensor.id, spaceId: surId, x: 50, y: 45 }];
    layoutJson.devices = [{ sensorId: sensor.id, sku: 'SE01-LB', devEui: null, unitId: surId }];
  }
  if (norteId) {
    const tokenHashN = createHash('sha256').update('etholys-demo-sonda-cantero-norte').digest('hex');
    const sensorN = await prisma.nexusSensor.upsert({
      where: { tokenHash: tokenHashN },
      create: {
        companyId,
        unitId: norteId,
        name: 'Sonda Cantero Norte',
        metric: 'soil_moisture',
        tokenHash: tokenHashN,
        lastSeenAt: new Date(),
        isActive: true,
      },
      update: { unitId: norteId, name: 'Sonda Cantero Norte', lastSeenAt: new Date(), isActive: true },
    });
    layoutJson.sensors = [
      ...layoutJson.sensors.filter((s) => s.spaceId !== norteId),
      { id: sensorN.id, spaceId: norteId, x: 48, y: 52 },
    ];
    layoutJson.devices = [
      ...layoutJson.devices.filter((d) => d.unitId !== norteId),
      { sensorId: sensorN.id, sku: 'SE01-LB', devEui: null, unitId: norteId },
    ];
  }

  await prisma.radarProperty.update({
    where: { id: property.id },
    data: { layoutJson: layoutJson as object },
  });

  for (const rule of [
    { kind: 'irrigation', label: 'Irrigación por humedad', enabled: true, configJson: { threshold: 25, mm: 10 } },
    { kind: 'whatsapp_alerts', label: 'Alertas al campo', enabled: true, configJson: { locale: 'es' } },
  ]) {
    await prisma.nexusOpsRule.upsert({
      where: { companyId_kind: { companyId, kind: rule.kind } },
      create: { companyId, ...rule },
      update: { label: rule.label, enabled: rule.enabled, configJson: rule.configJson },
    });
  }

  const phone = '+59899000111';
  const link = await prisma.nexusWhatsappLink.findFirst({ where: { companyId } });
  if (!link) {
    const taken = await prisma.nexusWhatsappLink.findUnique({ where: { phoneE164: phone } });
    if (!taken) {
      await prisma.nexusWhatsappLink.create({
        data: {
          companyId,
          phoneE164: phone,
          displayName: 'Campo — Finca escuela',
          alertsEnabled: true,
          lastInboundAt: daysAgo(1),
          lastOutboundAt: new Date(),
        },
      });
    }
  } else {
    await prisma.nexusWhatsappLink.update({
      where: { id: link.id },
      data: { alertsEnabled: true, displayName: link.displayName || 'Campo — Finca escuela', lastInboundAt: daysAgo(1) },
    });
  }

  const lots: Array<{
    code: string;
    token: string;
    unit: string;
    crop: string;
    qty: number;
    stage: string;
    status: string;
    events: Array<{ stage: string; daysAgo: number; note: string }>;
  }> = [
    {
      code: 'HV-NORTE-14',
      token: 'demo-hv-norte-14',
      unit: 'norte',
      crop: 'Lechuga',
      qty: 180,
      stage: 'harvest',
      status: 'open',
      events: [{ stage: 'harvest', daysAgo: 1, note: 'Corte de la mañana. En carencia: no sale a la feria.' }],
    },
    {
      code: 'HV-SUR-09',
      token: 'demo-hv-sur-09',
      unit: 'sur',
      crop: 'Tomate',
      qty: 420,
      stage: 'transform',
      status: 'open',
      events: [
        { stage: 'harvest', daysAgo: 5, note: 'Cosecha en cajones de 18 kg.' },
        { stage: 'transform', daysAgo: 3, note: 'Selección y lavado en la planta escuela. Merma 6%.' },
      ],
    },
    {
      code: 'HV-LOMA-03',
      token: 'demo-hv-loma-03',
      unit: 'loma',
      crop: 'Zapallo',
      qty: 900,
      stage: 'transport',
      status: 'open',
      events: [
        { stage: 'harvest', daysAgo: 12, note: 'Cosecha de zapallo cabutia.' },
        { stage: 'transform', daysAgo: 9, note: 'Clasificación por calibre.' },
        { stage: 'transport', daysAgo: 2, note: 'En camino a Salto. Transportista: Cooperativa del Litoral.' },
      ],
    },
    {
      code: 'HV-BAJO-01',
      token: 'demo-hv-bajo-01',
      unit: 'bajo',
      crop: 'Maíz',
      qty: 1500,
      stage: 'sale',
      status: 'closed',
      events: [
        { stage: 'harvest', daysAgo: 40, note: 'Cosecha del lote de choclo.' },
        { stage: 'transform', daysAgo: 36, note: 'Deschalado y embolsado.' },
        { stage: 'transport', daysAgo: 30, note: 'Entrega en el municipio.' },
        { stage: 'sale', daysAgo: 28, note: 'Vendido a compras públicas de Sierra Norte.' },
      ],
    },
  ];

  for (const lot of lots) {
    const unitId = unitIds.get(lot.unit) || null;
    const row = await prisma.radarLot.upsert({
      where: { companyId_code: { companyId, code: lot.code } },
      create: {
        companyId,
        code: lot.code,
        publicToken: lot.token,
        unitId,
        crop: lot.crop,
        qty: lot.qty,
        unitLabel: 'kg',
        status: lot.status,
        currentStage: lot.stage,
      },
      update: {
        unitId,
        crop: lot.crop,
        qty: lot.qty,
        status: lot.status,
        currentStage: lot.stage,
      },
    });
    const existingEvents = await prisma.radarLotEvent.count({ where: { lotId: row.id } });
    if (existingEvents === 0) {
      await prisma.radarLotEvent.createMany({
        data: lot.events.map((event) => ({
          lotId: row.id,
          stage: event.stage,
          occurredAt: daysAgo(event.daysAgo),
          payloadJson: { note: event.note, demoKey: `${lot.code}:${event.stage}` },
          channel: 'app',
          authorUserId: ownerId,
        })),
      });
    }
  }

  await prisma.businessDossier.upsert({
    where: { companyId },
    create: {
      companyId,
      portraitText:
        'Horizonte Verde acompaña cadenas del norte y tiene una finca escuela donde el Radar lee humedad, carencia y el recorrido de cada lote.',
      hypothesis: 'La finca escuela muestra, con datos de hoy, qué tiene que hacer el campo antes de la visita.',
      hypothesisAccepted: true,
      pulsoModule: 'agriculture',
      updatedByUserId: ownerId,
    },
    update: { pulsoModule: 'agriculture' },
  });

  summary.push(
    'RADAR: Finca escuela (OSM Brasília) · 4 espaços colocados · cultivos · sondas · Caderno · WhatsApp · 4 lotes',
  );
}

async function seedStudio(
  prisma: PrismaClient,
  companyId: string,
  ownerId: string,
  summary: string[],
) {
  const studioTitle = 'Narrativa para donantes — Cadenas Verdes';
  const studio = await prisma.studioDocument.findFirst({
    where: { companyId, title: studioTitle },
  });
  if (!studio) {
    await prisma.studioDocument.create({
      data: {
        companyId,
        title: studioTitle,
        format: 'proposal',
        status: 'draft',
        visibility: 'company',
        createdById: ownerId,
        updatedById: ownerId,
        canvasState: {
          version: 1,
          format: 'proposal',
          studioMode: 'write',
          pages: [
            {
              id: 'p1',
              title: 'Narrativa',
              order: 0,
              blocks: [
                {
                  id: 'b1',
                  kind: 'heading',
                  text: 'Cadenas Verdes — lo que ya está en marcha',
                  order: 0,
                },
                {
                  id: 'b2',
                  kind: 'paragraph',
                  text: 'En cuatro meses, Horizonte Verde acompañó a 16 talleres de campo y dejó el primer desembolso ejecutado. La propuesta a BID Lab pide escalar ese trabajo a 220 familias.',
                  order: 1,
                },
              ],
            },
          ],
        },
      },
    });
    summary.push('STUDIO: narrativa para donantes');
  }
}

async function seedMeet(
  prisma: PrismaClient,
  companyId: string,
  ownerId: string,
  projectId: string | null,
  summary: string[],
) {
  const room = 'horizonte-comite-donantes';
  const meet = await prisma.meetSession.findFirst({ where: { roomSlug: room } });
  if (!meet) {
    await prisma.meetSession.create({
      data: {
        companyId,
        createdById: ownerId,
        title: 'Comité con donantes — avance Cadenas Verdes',
        description: 'Revisión del informe y de la propuesta BID Lab.',
        mirror: 'siep',
        status: 'ended',
        scheduledAt: daysAgo(9),
        startedAt: daysAgo(9),
        endedAt: daysAgo(9),
        roomSlug: room,
        projectId,
        summaryText:
          'El comité validó el avance del 38% y pidió ajustar el presupuesto de la propuesta BID Lab antes del viernes. Próximo paso: cerrar la sección de socios.',
        actionItems: {
          create: [
            { title: 'Ajustar presupuesto BID Lab', status: 'accepted', sortOrder: 0 },
            { title: 'Confirmar carta de la Red de Cooperativas', status: 'draft', sortOrder: 1 },
          ],
        },
      },
    });
    summary.push('CHORUS: reunión con resumen y tareas');
  }

  const upcomingRoom = 'horizonte-sala-semanal';
  const upcoming = await prisma.meetSession.findFirst({ where: { roomSlug: upcomingRoom } });
  if (!upcoming) {
    await prisma.meetSession.create({
      data: {
        companyId,
        createdById: ownerId,
        title: 'Sala semanal — equipo Horizonte Verde',
        description: 'Reunión fija del equipo para la demostración.',
        mirror: 'loose',
        status: 'scheduled',
        scheduledAt: daysFromNow(2),
        endsAt: daysFromNow(2),
        roomSlug: upcomingRoom,
        isPermanent: true,
      },
    });
  }
}

async function seedPrism(prisma: PrismaClient, companyId: string, summary: string[]) {
  await upsertMemory(
    prisma,
    companyId,
    'hub_prism_mvp',
    'evidence_ledger_v1',
    JSON.stringify({
      items: [
        {
          id: 'sbx-prism-1',
          indicator: 'Familias con plan de finca: 28% (meta 65%)',
          link: 'https://app.etholys.com/hub',
          projectLabel: 'Cadenas Verdes — SBX-001',
          at: daysAgo(3).toISOString(),
        },
        {
          id: 'sbx-prism-2',
          indicator: 'Talleres de campo realizados: 16 de 48',
          link: 'https://app.etholys.com/hub',
          projectLabel: 'Cadenas Verdes — SBX-001',
          at: daysAgo(3).toISOString(),
        },
      ],
    }),
    'sandbox-presentation',
  );
  summary.push('PRISM: indicadores del proyecto');
}
