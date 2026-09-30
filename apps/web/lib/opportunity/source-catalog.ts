import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  buildPortalRefreshBase,
  type PortalRefreshSource,
} from '@/lib/opportunity/portal-base';
import type { FundingSourceRef } from '@/lib/opportunity/scan-types';

/** URLs opcionais adicionadas pelo utilizador — NÃO são requisito para varredura. */
export async function listUserMonitoredUrls(companyId: string): Promise<FundingSourceRef[]> {
  const monitored = await prisma.userMonitoredSource.findMany({
    where: { companyId, isActive: true, customUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { label: true, customUrl: true },
  });

  return monitored
    .filter((m) => m.customUrl)
    .map((m) => ({ name: m.label, url: m.customUrl! }));
}

/** Dicas silenciosas do catálogo Etholys (se existir) — enriquece, nunca bloqueia. */
export async function listEtholysCatalogHints(): Promise<FundingSourceRef[]> {
  const catalog = await prisma.fundingSourceCatalog.findMany({
    where: { isActive: true },
    take: 15,
    select: { name: true, url: true, tags: true },
  });
  return catalog.map((c) => ({
    name: c.name,
    url: c.url,
    tags: c.tags ?? undefined,
  }));
}

/**
 * R2 — base permanente de refresh: portais oficiais (filtrados por país do perfil)
 * + monitorizadas do utilizador + hints do catálogo Etholys.
 */
export async function listPortalRefreshSources(opts: {
  companyId: string;
  countries?: string[];
  limit?: number;
}): Promise<PortalRefreshSource[]> {
  const [monitored, catalogHints] = await Promise.all([
    listUserMonitoredUrls(opts.companyId),
    listEtholysCatalogHints(),
  ]);
  return buildPortalRefreshBase({
    countries: opts.countries,
    monitored,
    catalogHints,
    limit: opts.limit ?? 12,
  });
}
