export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { llmStreamAsOpenAICompatibleSSE } from '@/lib/llm-client';
import { requireAnvilAccess } from '@/lib/lab-anvil/access';
import { implementMuseSuggestionToAnvil } from '@/lib/muse/implement-to-anvil';
import {
  LAB_ANVIL_RELATIONS,
  LAB_ANVIL_WORKSPACE_KINDS,
} from '@/lib/lab-anvil/types';

async function requireLabAccess(userId: string, email: string, role: string) {
  if (role === 'ADMIN') return true;
  const invite = await prisma.labInvite.findFirst({
    where: { OR: [{ userId, status: 'ACCEPTED' }, { email, status: 'ACCEPTED' }] },
  });
  return !!invite;
}

// GET: fetch saved suggestions
export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { id: true, role: true, email: true },
    });
    if (!user) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
    if (!(await requireLabAccess(user.id, user.email, user.role))) {
      return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const categoryFilter = searchParams.get('category');

    const where: any = {};
    if (tenant.companyIds.length > 0) {
      where.OR = [{ companyId: { in: tenant.companyIds } }, { companyId: null }];
    }
    if (statusFilter) where.status = statusFilter;
    if (categoryFilter) where.category = categoryFilter;

    const suggestions = await prisma.museSuggestion.findMany({
      where,
      include: {
        createdBy: { select: { id: true, name: true } },
        company: { select: { id: true, shortName: true } },
        project: { select: { id: true, name: true } },
        anvilProject: { select: { id: true, slug: true, name: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('MUSE GET error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST: generate analysis via LLM or save / update / delete / implement
export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user = await prisma.user.findUnique({
      where: { id: tenant.userId },
      select: { id: true, role: true, email: true },
    });
    if (!user) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
    if (!(await requireLabAccess(user.id, user.email, user.role))) {
      return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
    }

    const body = await req.json();

    if (body.action === 'save') {
      const suggestion = await prisma.museSuggestion.create({
        data: {
          title: body.title || 'Sin t\u00edtulo',
          category: body.category || 'improvement',
          description: body.description || '',
          rationale: body.rationale || '',
          priority: body.priority || 'MEDIUM',
          status: body.status || 'NEW',
          source: body.source || 'manual',
          createdById: tenant.userId,
          companyId: body.companyId || null,
          projectId: body.projectId || null,
        },
      });
      return NextResponse.json({ suggestion });
    }

    if (body.action === 'update' && body.id) {
      const suggestion = await prisma.museSuggestion.update({
        where: { id: body.id },
        data: {
          ...(body.status && { status: body.status }),
          ...(body.priority && { priority: body.priority }),
          ...(body.title && { title: body.title }),
        },
      });
      return NextResponse.json({ suggestion });
    }

    if (body.action === 'delete' && body.id) {
      await prisma.museSuggestion.delete({ where: { id: body.id } });
      return NextResponse.json({ success: true });
    }

    // Pipeline MUSE → ANVIL
    if (body.action === 'implement' && body.id) {
      const anvil = await requireAnvilAccess();
      if (!anvil?.hasAccess) {
        return NextResponse.json(
          {
            error:
              'Precisa de acesso ANVIL para implementar. Peça convite a um owner do Lab ANVIL.',
          },
          { status: 403 },
        );
      }
      if (!anvil.isOwner) {
        return NextResponse.json(
          { error: 'Só owners ANVIL podem criar projetos a partir do MUSE.' },
          { status: 403 },
        );
      }

      const relation = body.relation;
      const workspaceKind = body.workspaceKind;
      if (relation && !LAB_ANVIL_RELATIONS.includes(relation)) {
        return NextResponse.json({ error: 'relation inválida' }, { status: 400 });
      }
      if (workspaceKind && !LAB_ANVIL_WORKSPACE_KINDS.includes(workspaceKind)) {
        return NextResponse.json({ error: 'workspaceKind inválido' }, { status: 400 });
      }

      try {
        const result = await implementMuseSuggestionToAnvil({
          suggestionId: body.id,
          userId: anvil.userId,
          email: anvil.email,
          relation,
          workspaceKind,
        });
        return NextResponse.json({
          suggestion: result.suggestion,
          project: {
            id: result.project.id,
            slug: result.project.slug,
            name: result.project.name,
          },
          sessionId: 'sessionId' in result ? result.sessionId : undefined,
          created: result.created,
          href: `/lab/anvil/${result.project.id}`,
        });
      } catch (e: unknown) {
        const status = (e as { status?: number })?.status || 500;
        const message = e instanceof Error ? e.message : 'Erro ao implementar';
        return NextResponse.json({ error: message }, { status });
      }
    }

    const companyIds = tenant.companyIds;
    const [projects, tasks, risks, transactions, objectives] = await Promise.all([
      prisma.project.findMany({
        where: { companyId: { in: companyIds }, isActive: true },
        select: {
          id: true,
          name: true,
          status: true,
          budget: true,
          spent: true,
          progress: true,
          startDate: true,
          endDate: true,
          donorName: true,
          country: true,
        },
      }),
      prisma.task.findMany({
        where: {
          OR: [{ project: { companyId: { in: companyIds } } }, { companyId: { in: companyIds } }],
        },
        select: { id: true, status: true, priority: true, title: true },
        take: 200,
      }),
      prisma.risk.findMany({
        where: { project: { companyId: { in: companyIds } } },
        select: { id: true, title: true, level: true, status: true },
        take: 100,
      }),
      prisma.transaction.findMany({
        where: { companyId: { in: companyIds } },
        select: { id: true, type: true, amount: true, category: true },
        take: 200,
      }),
      prisma.objective.findMany({
        where: { project: { companyId: { in: companyIds } } },
        select: {
          id: true,
          title: true,
          type: true,
          target: true,
          actual: true,
          status: true,
        },
        take: 100,
      }),
    ]);

    const prevSuggestions = await prisma.museSuggestion.findMany({
      where: { OR: [{ companyId: { in: companyIds } }, { companyId: null }] },
      select: { title: true, category: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const systemContext = {
      projects: projects.map((p) => ({
        name: p.name,
        status: p.status,
        budget: p.budget,
        spent: p.spent,
        progress: p.progress,
        startDate: p.startDate,
        endDate: p.endDate,
        donorName: p.donorName,
        country: p.country,
      })),
      taskSummary: {
        total: tasks.length,
        byStatus: tasks.reduce((acc: any, t) => {
          acc[t.status] = (acc[t.status] || 0) + 1;
          return acc;
        }, {}),
      },
      riskSummary: {
        total: risks.length,
        byLevel: risks.reduce((acc: any, r) => {
          acc[r.level] = (acc[r.level] || 0) + 1;
          return acc;
        }, {}),
        openHighCritical: risks.filter(
          (r) => (r.level === 'HIGH' || r.level === 'CRITICAL') && r.status === 'open',
        ).length,
      },
      financeSummary: {
        totalIncome: transactions
          .filter((t) => t.type === 'INCOME')
          .reduce((s, t) => s + (t.amount || 0), 0),
        totalExpense: transactions
          .filter((t) => t.type === 'EXPENSE')
          .reduce((s, t) => s + (t.amount || 0), 0),
      },
      objectivesSummary: {
        total: objectives.length,
        withTarget: objectives.filter((o) => o.target).length,
        withActual: objectives.filter((o) => o.actual).length,
      },
      previousSuggestions: prevSuggestions,
    };

    const userPrompt =
      body.prompt || 'Analiza los datos del sistema y genera sugerencias estrat\u00e9gicas.';

    const systemPrompt = `Eres MUSE (Motor Universal de Sugerencias Estrat\u00e9gicas), un director de innovaci\u00f3n de IA integrado en el sistema ERP ETHOLYS/ATLAS.

Tu misi\u00f3n es observar los datos del sistema, identificar patrones, brechas, oportunidades y problemas recurrentes, y proponer:
- Nuevos sistemas de software que podr\u00edan beneficiar a la organizaci\u00f3n
- Mejoras a sistemas existentes
- Evoluci\u00f3n de hardware (ej: deshidratador solar v1\u2192v2\u2192v3)
- Nuevas metodolog\u00edas de trabajo
- Optimizaciones de procesos
- Integraciones estrat\u00e9gicas

CONTEXTO DEL SISTEMA:
${JSON.stringify(systemContext, null, 2)}

INSTRUCCIONES:
- Responde siempre en espa\u00f1ol
- S\u00e9 concreto y accionable
- Prioriza sugerencias por impacto
- Considera el contexto multi-sector del ecosistema Etholys (institucional, empresarial, cooperación, formación, MIPYMEs)
- No repitas sugerencias previamente generadas (ver previousSuggestions)
- Formato: responde en texto libre, claro y bien estructurado con secciones y puntos clave`;

    const stream = llmStreamAsOpenAICompatibleSSE(systemPrompt, userPrompt);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('MUSE POST error:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
