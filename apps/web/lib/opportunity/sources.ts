import 'server-only';

import { prisma } from '@/lib/prisma';

export type MonitoredSourceDto = {
  id: string;
  label: string;
  url: string;
  languages: string;
  isActive: boolean;
  createdAt: string;
};

export async function listMonitoredSources(companyId: string, userId: string): Promise<MonitoredSourceDto[]> {
  const rows = await prisma.userMonitoredSource.findMany({
    where: { companyId, userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      customUrl: true,
      languages: true,
      isActive: true,
      createdAt: true,
      catalog: { select: { url: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    url: r.customUrl || r.catalog?.url || '',
    languages: r.languages ?? 'pt',
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function addMonitoredSource(opts: {
  companyId: string;
  userId: string;
  label: string;
  url: string;
  languages?: string;
}): Promise<MonitoredSourceDto> {
  const label = opts.label.trim().slice(0, 120) || 'Fonte personalizada';
  const url = opts.url.trim().slice(0, 500);
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL inválida — use http:// ou https://');
  }

  const row = await prisma.userMonitoredSource.create({
    data: {
      companyId: opts.companyId,
      userId: opts.userId,
      label,
      customUrl: url,
      languages: opts.languages?.trim().slice(0, 40) || 'pt',
      isActive: true,
    },
  });

  return {
    id: row.id,
    label: row.label,
    url: row.customUrl ?? url,
    languages: row.languages ?? 'pt',
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function removeMonitoredSource(
  companyId: string,
  userId: string,
  sourceId: string,
): Promise<void> {
  const row = await prisma.userMonitoredSource.findFirst({
    where: { id: sourceId, companyId, userId },
  });
  if (!row) throw new Error('Fonte não encontrada');
  await prisma.userMonitoredSource.delete({ where: { id: sourceId } });
}
