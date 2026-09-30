import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  fundColumnDataFromMeta,
  parseFundHubMeta,
  writeFundHubMeta,
} from '@/lib/opportunity/pipeline';

/**
 * R3 — ponte FundHub → SIEP após ganho.
 * Cria um projeto SIEP mínimo (DRAFT) e grava siepProjectId no meta do fundo.
 * Não faz spenddown / pós-prémio no FundHub.
 */
export async function handoffFundToSiep(opts: {
  companyId: string;
  fundId: string;
  userId: string;
  locale?: string;
}): Promise<
  | { ok: true; projectId: string; created: boolean; href: string }
  | { ok: false; error: string }
> {
  const fund = await prisma.fund.findFirst({
    where: { id: opts.fundId, companyId: opts.companyId, isActive: true },
    select: {
      id: true,
      name: true,
      institution: true,
      notes: true,
      amount: true,
      amountRequested: true,
      currency: true,
      pipelineStatus: true,
      fundHubMetaJson: true,
      countries: true,
    },
  });
  if (!fund) return { ok: false, error: 'Fundo não encontrado' };

  const meta = parseFundHubMeta(fund.notes);
  const fromJson =
    fund.fundHubMetaJson && typeof fund.fundHubMetaJson === 'object' && !Array.isArray(fund.fundHubMetaJson)
      ? (fund.fundHubMetaJson as { siepProjectId?: string })
      : {};
  const existingId = meta.siepProjectId || fromJson.siepProjectId;
  if (existingId) {
    const existing = await prisma.project.findFirst({
      where: { id: existingId, companyId: opts.companyId },
      select: { id: true },
    });
    if (existing) {
      return {
        ok: true,
        projectId: existing.id,
        created: false,
        href: `/siep/projects/${existing.id}`,
      };
    }
  }

  const budget = fund.amountRequested ?? fund.amount ?? 0;
  const desc =
    opts.locale === 'pt'
      ? `Criado a partir do FundHub (ganho). Doador: ${fund.institution || '—'}. Execução e reportes no SIEP.`
      : opts.locale === 'en'
        ? `Created from FundHub (won). Donor: ${fund.institution || '—'}. Execution and reporting live in SIEP.`
        : `Creado desde FundHub (ganado). Donante: ${fund.institution || '—'}. Ejecución y reportes en SIEP.`;

  const project = await prisma.project.create({
    data: {
      companyId: opts.companyId,
      name: fund.name.slice(0, 200),
      description: desc.slice(0, 2000),
      donorName: (fund.institution || '').slice(0, 200) || null,
      status: 'DRAFT',
      budget: typeof budget === 'number' && budget > 0 ? budget : 0,
      currency: fund.currency || 'USD',
      country: fund.countries?.split(/[,;]/)[0]?.trim().slice(0, 80) || null,
      contentLocale: opts.locale === 'pt' || opts.locale === 'en' ? opts.locale : 'es',
      members: {
        create: {
          userId: opts.userId,
          role: 'owner',
          status: 'active',
        },
      },
    },
    select: { id: true },
  });

  const notes = writeFundHubMeta(fund.notes, { siepProjectId: project.id });
  const nextMeta = parseFundHubMeta(notes);
  const cols = fundColumnDataFromMeta(nextMeta);
  await prisma.fund.update({
    where: { id: fund.id },
    data: {
      notes,
      fundHubMetaJson: cols.fundHubMetaJson,
      lastReviewedAt: new Date(),
    },
  });

  return {
    ok: true,
    projectId: project.id,
    created: true,
    href: `/siep/projects/${project.id}`,
  };
}
