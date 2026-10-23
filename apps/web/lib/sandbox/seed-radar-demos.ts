/**
 * RADAR client-demo tenants (re-runnable upsert).
 *
 * Advanced = Horizonte Verde sandbox (full farm on OSM).
 * Empty = Campo Novo — first-run: no property, empty Caderno, onboarding rail.
 *
 * Demo password: SANDBOX_PASSWORD env or EtholysSandbox2026! (never commit secrets).
 */

import type { PrismaClient } from '@prisma/client';
import { WORKSPACE_SYSTEM_KEYS } from '@/lib/integrated-workspace-shared';
import {
  enrichSandboxPresentation,
  PRESENTATION_COMPANY_NAME,
  PRESENTATION_SHORT_NAME,
} from '@/lib/sandbox/enrich-presentation';

export const RADAR_EMPTY_SHORT_NAME = 'CampoNovo';
export const RADAR_EMPTY_COMPANY_NAME = 'Campo Novo';
export const RADAR_EMPTY_EMAIL = 'demo.campo.novo@etholys.com';
export const RADAR_EMPTY_NAME = 'Produtor Campo Novo';

const ADVANCED_EMAIL = 'master.horizonte@etholys.com';
const ADVANCED_NAME = 'Dirección Horizonte';
const ADVANCED_JOB = 'Dirección general';

/** Known presentation logins (same password for all demo users). */
export const RADAR_DEMO_LOGINS = {
  advanced: {
    email: ADVANCED_EMAIL,
    company: PRESENTATION_COMPANY_NAME,
    shortName: PRESENTATION_SHORT_NAME,
    shows:
      'Filled farm: Finca escuela pinned near Praça do Buriti, 4 spaces placed/rotated, crops, sensors, Caderno lines, lots, tasks.',
  },
  empty: {
    email: RADAR_EMPTY_EMAIL,
    company: RADAR_EMPTY_COMPANY_NAME,
    shortName: RADAR_EMPTY_SHORT_NAME,
    shows: 'First-run: no property / empty map & Caderno — onboarding characterize → draw → pin → sensors.',
  },
} as const;

async function ensureCompanyUser(
  prisma: PrismaClient,
  opts: {
    companyId: string;
    email: string;
    name: string;
    passwordHash: string;
    locale?: string;
    jobTitle?: string;
  },
) {
  const user = await prisma.user.upsert({
    where: { email: opts.email },
    update: {
      name: opts.name,
      role: 'ADMIN',
      isActive: true,
      locale: opts.locale || 'pt',
      password: opts.passwordHash,
    },
    create: {
      email: opts.email,
      name: opts.name,
      password: opts.passwordHash,
      role: 'ADMIN',
      isActive: true,
      locale: opts.locale || 'pt',
    },
  });

  await prisma.companyUser.upsert({
    where: { userId_companyId: { userId: user.id, companyId: opts.companyId } },
    update: { role: 'ADMIN', isDefault: true },
    create: {
      userId: user.id,
      companyId: opts.companyId,
      role: 'ADMIN',
      isDefault: true,
    },
  });

  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "CompanyUser" SET "jobTitle" = $1, "inviteKind" = $2 WHERE "userId" = $3 AND "companyId" = $4`,
      opts.jobTitle || 'Administração',
      'employee',
      user.id,
      opts.companyId,
    );
  } catch {
    /* optional columns */
  }

  await prisma.integratedWorkspaceAccess.upsert({
    where: { companyId_userId: { companyId: opts.companyId, userId: user.id } },
    create: {
      companyId: opts.companyId,
      userId: user.id,
      systems: [...WORKSPACE_SYSTEM_KEYS],
      tools: ['ADVISOR', 'STUDIO', 'WORK', 'CHORUS'],
      enabled: true,
      grantedByUserId: user.id,
    },
    update: {
      systems: [...WORKSPACE_SYSTEM_KEYS],
      tools: ['ADVISOR', 'STUDIO', 'WORK', 'CHORUS'],
      enabled: true,
    },
  });

  return user;
}

/** Empty / first-run RADAR tenant — no properties, no caderno, no sensors. */
export async function seedRadarEmptyDemo(
  prisma: PrismaClient,
  opts: { passwordHash: string },
): Promise<{ companyId: string; email: string; summary: string[] }> {
  const summary: string[] = [];

  let company = await prisma.company.findFirst({
    where: { shortName: RADAR_EMPTY_SHORT_NAME },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: RADAR_EMPTY_COMPANY_NAME,
        shortName: RADAR_EMPTY_SHORT_NAME,
        description: 'Demo RADAR — estado inicial (ainda não começou a usar o sistema).',
        color: '#0F766E',
        currency: 'BRL',
        contextSetupJson: {
          v: 1,
          sectorId: 'agro',
          entityKind: 'producer',
          countryPrimary: 'BR',
          currencyOp: 'BRL',
          primaryGoals: ['operations'],
          notesForAdvisor: 'Demo vazia RADAR — first-run.',
          legalDisclaimerAcceptedAt: new Date().toISOString(),
        },
        contextSetupAt: new Date(),
      },
    });
    summary.push(`Empresa criada: ${company.name}`);
  } else {
    await prisma.company.update({
      where: { id: company.id },
      data: { name: RADAR_EMPTY_COMPANY_NAME, isActive: true },
    });
    summary.push(`Empresa existente: ${company.name}`);
  }

  // Keep empty: remove any leftover demo properties/units/entries for this company.
  const props = await prisma.radarProperty.findMany({ where: { companyId: company.id }, select: { id: true } });
  if (props.length) {
    await prisma.nexusOpsUnit.updateMany({
      where: { companyId: company.id },
      data: { isActive: false },
    });
    await prisma.radarProperty.deleteMany({ where: { companyId: company.id } });
    summary.push('Propriedades demo removidas (volta ao first-run)');
  }
  await prisma.nexusFieldEntry.deleteMany({ where: { companyId: company.id } });
  await prisma.nexusSensor.updateMany({ where: { companyId: company.id }, data: { isActive: false } });
  await prisma.radarLot.deleteMany({ where: { companyId: company.id } });

  await prisma.businessDossier.upsert({
    where: { companyId: company.id },
    create: { companyId: company.id, pulsoModule: null },
    update: { pulsoModule: null },
  });

  const user = await ensureCompanyUser(prisma, {
    companyId: company.id,
    email: RADAR_EMPTY_EMAIL,
    name: RADAR_EMPTY_NAME,
    passwordHash: opts.passwordHash,
    locale: 'pt',
    jobTitle: 'Produtor',
  });

  summary.push(`Login: ${user.email} — mapa/Caderno vazios, funil de onboarding`);
  return { companyId: company.id, email: user.email, summary };
}

/**
 * Refresh advanced (Horizonte) RADAR farm + ensure master login.
 * Does not wipe other sandbox systems; calls enrichSandboxPresentation which upserts RADAR.
 */
export async function seedRadarAdvancedDemo(
  prisma: PrismaClient,
  opts: { passwordHash: string },
): Promise<{ companyId: string; email: string; summary: string[] }> {
  const summary: string[] = [];

  let company = await prisma.company.findFirst({
    where: { shortName: { in: [PRESENTATION_SHORT_NAME, 'SANDBOX', 'Horizonte'] } },
    orderBy: { updatedAt: 'desc' },
  });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: PRESENTATION_COMPANY_NAME,
        shortName: PRESENTATION_SHORT_NAME,
        description: 'Empresa demo Horizonte Verde — RADAR avançado para apresentações.',
        color: '#0D9488',
        currency: 'USD',
      },
    });
    summary.push(`Empresa criada: ${company.name}`);
  } else {
    summary.push(`Empresa existente: ${company.name} (${company.shortName})`);
  }

  const user = await ensureCompanyUser(prisma, {
    companyId: company.id,
    email: ADVANCED_EMAIL,
    name: ADVANCED_NAME,
    passwordHash: opts.passwordHash,
    locale: 'es',
    jobTitle: ADVANCED_JOB,
  });

  await enrichSandboxPresentation(prisma, company.id, user.id, summary);
  summary.push(`Login avançado: ${user.email}`);
  return { companyId: company.id, email: user.email, summary };
}

export async function seedRadarDemos(
  prisma: PrismaClient,
  opts: { passwordHash: string },
): Promise<{ summary: string[]; logins: typeof RADAR_DEMO_LOGINS }> {
  const summary: string[] = [];
  const empty = await seedRadarEmptyDemo(prisma, opts);
  summary.push(...empty.summary);
  const advanced = await seedRadarAdvancedDemo(prisma, opts);
  summary.push(...advanced.summary);
  return { summary, logins: RADAR_DEMO_LOGINS };
}
