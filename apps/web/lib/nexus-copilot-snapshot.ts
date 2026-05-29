import type { PrismaClient } from '@prisma/client';
import { loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';
import { safeVentureStage } from '@/lib/nexus-guides';
import { stageLabel, type VentureStageId } from '@/lib/nexus-venture';

type SnapshotOpts = {
  companyId: string;
  tenantCompanyIds: string[];
  networkId?: string | null;
  locale: 'pt' | 'es' | 'en';
};

function stageLoc(stage: VentureStageId, loc: 'pt' | 'es' | 'en') {
  return stageLabel(stage, loc === 'es' ? 'es' : loc === 'en' ? 'en' : 'pt');
}

/**
 * Resumo alinhado ao overview NEXUS, para o copiloto ser proactivo (pendentes, fase, rede).
 */
export async function buildNexusCopilotSnapshot(
  prisma: PrismaClient,
  opts: SnapshotOpts,
): Promise<string> {
  const { companyId, tenantCompanyIds, networkId, locale: loc } = opts;
  const l = loc === 'es' ? 'es' : loc === 'en' ? 'en' : 'pt';

  if (networkId) {
    const network = await loadNetworkForTenant(networkId, tenantCompanyIds);
    if (network) {
      const companyIds = memberCompanyIds(network);
      const [openServiceTickets, completedRoadmapActions, pendingRoadmapActions, ventureStateRow] =
        await Promise.all([
          prisma.task.count({
            where: {
              companyId: { in: companyIds },
              isActive: true,
              tags: { contains: 'nexus:service' },
              status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
            },
          }),
          prisma.task.count({
            where: {
              companyId: { in: companyIds },
              isActive: true,
              tags: { contains: 'nexus:roadmap' },
              status: 'DONE',
            },
          }),
          prisma.task.count({
            where: {
              companyId: { in: companyIds },
              isActive: true,
              tags: { contains: 'nexus:roadmap' },
              status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
            },
          }),
          prisma.nexusVentureState.findUnique({ where: { networkId: network.id } }),
        ]);
      const stage = safeVentureStage(ventureStateRow?.stage);
      const lines = [
        l === 'en'
          ? 'NEXUS (network context)'
          : l === 'es'
            ? 'NEXUS (contexto de red)'
            : 'NEXUS (contexto de rede)',
        `· ${l === 'en' ? 'Network' : l === 'es' ? 'Red' : 'Rede'}: ${network.name} (${network.members.length + 1} org.)`,
        `· ${l === 'en' ? 'Stage in the process' : l === 'es' ? 'Fase en el proceso' : 'Fase no processo'}: ${stageLoc(stage, l)}`,
        `· ${l === 'en' ? 'Live roadmap' : l === 'es' ? 'Ruta viva' : 'Rota viva'}: ${pendingRoadmapActions} ${
          l === 'en' ? 'pending' : l === 'es' ? 'pendiente(s)' : 'pendente(s)'
        }, ${completedRoadmapActions} ${l === 'en' ? 'done' : l === 'es' ? 'cerrada(s)' : 'concluída(s)'}.`,
        `· ${l === 'en' ? 'Internal service tickets' : l === 'es' ? 'Tickets de servicio' : 'Tickets de serviço'}: ${openServiceTickets}.`,
      ];
      return lines.join('\n');
    }
  }

  const [openServiceTickets, completedRoadmapActions, pendingRoadmapActions, ventureStateRow] = await Promise.all([
    prisma.task.count({
      where: {
        companyId,
        isActive: true,
        tags: { contains: 'nexus:service' },
        status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
      },
    }),
    prisma.task.count({
      where: {
        companyId,
        isActive: true,
        tags: { contains: 'nexus:roadmap' },
        status: 'DONE',
      },
    }),
    prisma.task.count({
      where: {
        companyId,
        isActive: true,
        tags: { contains: 'nexus:roadmap' },
        status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
      },
    }),
    prisma.nexusVentureState.findUnique({ where: { companyId } }),
  ]);
  const stage = safeVentureStage(ventureStateRow?.stage);
  const lines = [
    l === 'en' ? 'NEXUS (company context)' : l === 'es' ? 'NEXUS (contexto empresa)' : 'NEXUS (contexto da empresa)',
    `· ${l === 'en' ? 'Stage in the process' : l === 'es' ? 'Fase en el proceso' : 'Fase no processo'}: ${stageLoc(stage, l)}`,
    `· ${l === 'en' ? 'Live roadmap' : l === 'es' ? 'Ruta viva' : 'Rota viva'}: ${pendingRoadmapActions} ${
      l === 'en' ? 'pending' : l === 'es' ? 'pendiente(s)' : 'pendente(s)'
    }, ${completedRoadmapActions} ${l === 'en' ? 'done' : l === 'es' ? 'cerrada(s)' : 'concluída(s)'}.`,
    `· ${l === 'en' ? 'Service tickets' : l === 'es' ? 'Tickets' : 'Tickets de serviço'}: ${openServiceTickets}.`,
  ];
  return lines.join('\n');
}
