import type { PrismaClient } from '@prisma/client';
import { loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';
import {
  internationalReadinessScore,
  parseInternationalChecklist,
  stageLabel,
  type VentureStageId,
} from '@/lib/nexus-venture';

export type NexusBoostPayload = {
  networkId?: string;
  projectId?: string;
};

/**
 * Contexto compacto para o Advisor atuar como "técnico permanente" do Nexus
 * (projeto + rede + fase da jornada + contagem de rotas).
 */
export async function buildNexusAdvisorContextBlock(
  prisma: PrismaClient,
  tenantCompanyIds: string[],
  boost: NexusBoostPayload
): Promise<string | null> {
  const parts: string[] = [];

  if (boost.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: boost.projectId, companyId: { in: tenantCompanyIds }, isActive: true },
      select: {
        id: true,
        name: true,
        description: true,
        goal: true,
        status: true,
        startDate: true,
        endDate: true,
        budget: true,
        spent: true,
        progress: true,
        company: { select: { name: true, shortName: true } },
      },
    });
    if (project) {
      const months =
        project.startDate && project.endDate
          ? Math.max(
              1,
              Math.round(
                (new Date(project.endDate).getTime() - new Date(project.startDate).getTime()) /
                  (30.44 * 86400000)
              )
            )
          : null;
      parts.push(`PROJETO SIEP / PROGRAMA (Nexus):
- Nome: ${project.name}
- Empresa gestora: ${project.company.name} (${project.company.shortName})
- Estado: ${project.status}
- Progresso: ${project.progress}%
- Orçamento / gasto: ${project.budget} / ${project.spent}
- Datas: ${project.startDate?.toISOString().slice(0, 10) ?? '?'} → ${project.endDate?.toISOString().slice(0, 10) ?? '?'}${months != null ? ` (~${months} meses)` : ''}
- Objectivo: ${project.goal ?? '(não definido)'}
- Descrição: ${(project.description ?? '').slice(0, 1200)}`);
    }
  }

  if (boost.networkId) {
    const network = await loadNetworkForTenant(boost.networkId, tenantCompanyIds);
    if (network) {
      const ids = memberCompanyIds(network);
      const [pendingRoadmap, venture] = await Promise.all([
        prisma.task.count({
          where: {
            companyId: { in: ids },
            isActive: true,
            tags: { contains: 'nexus:roadmap' },
            status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
          },
        }),
        prisma.nexusVentureState.findUnique({ where: { networkId: network.id } }),
      ]);
      const checklist = parseInternationalChecklist(venture?.internationalChecklist);
      const intl = internationalReadinessScore(checklist);
      const stage = (venture?.stage && String(venture.stage)) || 'DISCOVER';
      const safeStage = (['DISCOVER', 'FOCUS', 'BUILD', 'MEASURE', 'SCALE_GLOBAL'].includes(stage)
        ? stage
        : 'DISCOVER') as VentureStageId;
      parts.push(`REDE NEXUS:
- Nome: ${network.name}
- Âncora: ${network.anchorCompany.shortName}
- Membros: ${network.members.map((m) => m.company.shortName).join(', ')}
- Tarefas de rota Nexus pendentes (agregado): ${pendingRoadmap}
- Fase no processo: ${safeStage} (${stageLabel(safeStage, 'pt')})
- Prontidão internacional (score): ${intl}%
- Regiões-alvo (texto): ${venture?.targetRegions ?? '(não preenchido)'}`);
    }
  }

  if (parts.length === 0) return null;
  return `\n\n--- CONTEXTO NEXUS (uso interno Etholys) ---\n${parts.join('\n\n')}\n--- Fim contexto Nexus ---\n\nComo técnico do programa, ajude a desenhar rotas de implementação concretas para os empreendimentos, respeitando prazos do projeto. Se faltar dado, diga o que falta perguntar ao utilizador.`;
}
