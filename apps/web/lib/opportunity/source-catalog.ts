import 'server-only';

import { prisma } from '@/lib/prisma';
import type { FundingSourceRef } from '@/lib/opportunity/scan-types';

/** URLs opcionais adicionadas pelo utilizador — NÃO são requisito para varredura. */
export async function listUserMonitoredUrls(companyId: string): Promise<FundingSourceRef[]> {
  const monitored = await prisma.userMonitoredSource.findMany({
    where: { companyId, isActive: true, customUrl: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 8,
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
