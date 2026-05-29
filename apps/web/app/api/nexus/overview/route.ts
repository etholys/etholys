export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadNetworkForTenant, memberCompanyIds } from '@/lib/nexus-network';
import { buildNexusQuickSteps, safeVentureStage } from '@/lib/nexus-guides';

type MaturityLevel = 'initial' | 'developing' | 'structured' | 'advanced';

function levelFromScore(score: number): MaturityLevel {
  if (score >= 75) return 'advanced';
  if (score >= 55) return 'structured';
  if (score >= 35) return 'developing';
  return 'initial';
}

type Persona = 'GESTOR' | 'TECNICO' | 'COLABORADOR';

function inferPersona(role: string | null | undefined): Persona {
  if (!role) return 'COLABORADOR';
  const r = role.toUpperCase();
  if (r === 'ADMIN' || r === 'PROJECT_MANAGER') return 'GESTOR';
  if (r === 'TECHNICIAN') return 'TECNICO';
  return 'COLABORADOR';
}

export async function GET(req: NextRequest) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const networkIdParam = req.nextUrl.searchParams.get('networkId');
  const companyIdParam = req.nextUrl.searchParams.get('companyId');
  const [user, roles] = await Promise.all([
    prisma.user.findUnique({ where: { id: tenant.userId }, select: { id: true, name: true, email: true } }),
    prisma.companyUser.findMany({
      where: { userId: tenant.userId, companyId: { in: tenant.companyIds } },
      select: {
        companyId: true,
        role: true,
        company: { select: { id: true, name: true, shortName: true } },
      },
    }),
  ]);

  if (networkIdParam) {
    const network = await loadNetworkForTenant(networkIdParam, tenant.companyIds);
    if (!network) return NextResponse.json({ error: 'Rede não encontrada.' }, { status: 404 });

    const companyIds = memberCompanyIds(network);

    const [openServiceTickets, completedRoadmapActions, pendingRoadmapActions, activeProjects, ventureStateRow] =
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
        prisma.project.count({
          where: { companyId: { in: companyIds }, isActive: true },
        }),
        prisma.nexusVentureState.findUnique({ where: { networkId: network.id } }),
      ]);

    const ventureStage = safeVentureStage(ventureStateRow?.stage);
    const quickNextSteps = buildNexusQuickSteps(ventureStage, networkIdParam);
    const showNexusWelcome =
      pendingRoadmapActions === 0 && completedRoadmapActions === 0 && openServiceTickets === 0;

    const rawScore = Math.max(
      0,
      Math.min(100, 22 + completedRoadmapActions * 4 + activeProjects * 2 - openServiceTickets * 1.5)
    );
    const maturityScore = Math.round(rawScore);
    const maturityLevel = levelFromScore(maturityScore);

    const recommendations: string[] = [];
    if (pendingRoadmapActions === 0) recommendations.push('Definir ações de rota para as empresas da rede.');
    if (openServiceTickets < 1) recommendations.push('Abrir tickets de serviço internos para acelerar execução.');
    if (completedRoadmapActions < 3) recommendations.push('Fechar ações de melhoria em cascata (mãe + filiais).');
    if (!network.siepProjectId && !network.members.some((m: { siepProjectId: string | null }) => m.siepProjectId)) {
      recommendations.push('Opcional: vincular um projeto SIEP à rede ou a membros para contextualizar o acompanhamento.');
    }
    if (recommendations.length === 0) recommendations.push('Manter revisão mensal da rede e sincronizar metas entre membros.');

    return NextResponse.json({
      mode: 'network',
      networkId: network.id,
      network: {
        id: network.id,
        name: network.name,
        kind: network.kind,
        anchorCompany: network.anchorCompany,
        siepProject: network.siepProject,
        members: network.members,
      },
      companyIds,
      maturityScore,
      maturityLevel,
      metrics: {
        activeProjects,
        openServiceTickets,
        completedRoadmapActions,
        pendingRoadmapActions,
      },
      userContext: {
        user,
        activeCompanyId: network.anchorCompanyId,
        activeRole: roles.find((r) => r.companyId === network.anchorCompanyId)?.role || null,
        inferredPersona: inferPersona(roles.find((r) => r.companyId === network.anchorCompanyId)?.role),
        companyRoles: roles,
      },
      recommendations,
      ventureStage,
      quickNextSteps,
      showNexusWelcome,
    });
  }

  const companyId =
    companyIdParam && tenant.companyIds.includes(companyIdParam)
      ? companyIdParam
      : tenant.companyIds[0] || null;
  if (!companyId) return NextResponse.json({ error: 'Sem empresa associada.' }, { status: 400 });

  const [openServiceTickets, completedRoadmapActions, pendingRoadmapActions, activeProjects, ventureStateRow] =
    await Promise.all([
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
      prisma.project.count({
        where: { companyId, isActive: true },
      }),
      prisma.nexusVentureState.findUnique({ where: { companyId } }),
    ]);

  const ventureStage = safeVentureStage(ventureStateRow?.stage);
  const quickNextSteps = buildNexusQuickSteps(ventureStage, null);
  const showNexusWelcome =
    pendingRoadmapActions === 0 && completedRoadmapActions === 0 && openServiceTickets === 0;

  const rawScore = Math.max(
    0,
    Math.min(100, 22 + completedRoadmapActions * 4 + activeProjects * 2 - openServiceTickets * 1.5)
  );
  const maturityScore = Math.round(rawScore);
  const maturityLevel = levelFromScore(maturityScore);

  const recommendations: string[] = [];
  if (pendingRoadmapActions === 0) recommendations.push('Criar ações de rota para os próximos 30 dias.');
  if (openServiceTickets < 1) recommendations.push('Abrir 1 ticket de serviço para acelerar execução com IA/híbrido.');
  if (completedRoadmapActions < 3) recommendations.push('Fechar pelo menos 3 ações de melhoria para subir o nível de maturidade.');
  if (recommendations.length === 0) recommendations.push('Manter ritmo semanal e revisar diagnóstico a cada 30 dias.');

  return NextResponse.json({
    mode: 'company',
    companyId,
    maturityScore,
    maturityLevel,
    metrics: {
      activeProjects,
      openServiceTickets,
      completedRoadmapActions,
      pendingRoadmapActions,
    },
    userContext: {
      user,
      activeCompanyId: companyId,
      activeRole: roles.find((r) => r.companyId === companyId)?.role || null,
      inferredPersona: inferPersona(roles.find((r) => r.companyId === companyId)?.role),
      companyRoles: roles,
    },
    recommendations,
    ventureStage,
    quickNextSteps,
    showNexusWelcome,
  });
}
