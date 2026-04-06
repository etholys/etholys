export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { geminiStreamAsOpenAICompatibleSSE } from '@/lib/gemini-client';

// GET: fetch saved suggestions
export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    // Check lab access: ADMIN or accepted invite
    const user = await prisma.user.findUnique({ where: { id: tenant.userId }, select: { id: true, role: true, email: true } });
    if (!user) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

    if (user.role !== 'ADMIN') {
      const invite = await prisma.labInvite.findFirst({
        where: { OR: [{ userId: user.id, status: 'ACCEPTED' }, { email: user.email, status: 'ACCEPTED' }] },
      });
      if (!invite) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
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

// POST: generate analysis via LLM or save a suggestion
export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: tenant.userId }, select: { id: true, role: true, email: true } });
    if (!user) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });

    if (user.role !== 'ADMIN') {
      const invite = await prisma.labInvite.findFirst({
        where: { OR: [{ userId: user.id, status: 'ACCEPTED' }, { email: user.email, status: 'ACCEPTED' }] },
      });
      if (!invite) return NextResponse.json({ error: 'Acceso restringido' }, { status: 403 });
    }

    const body = await req.json();

    // Action: save a suggestion
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

    // Action: update suggestion status
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

    // Action: delete suggestion
    if (body.action === 'delete' && body.id) {
      await prisma.museSuggestion.delete({ where: { id: body.id } });
      return NextResponse.json({ success: true });
    }

    // Default action: analyze - gather system data and call LLM
    const companyIds = tenant.companyIds;
    const [projects, tasks, risks, transactions, objectives] = await Promise.all([
      prisma.project.findMany({
        where: { companyId: { in: companyIds }, isActive: true },
        select: { id: true, name: true, status: true, budget: true, spent: true, progress: true, startDate: true, endDate: true, donorName: true, country: true },
      }),
      prisma.task.findMany({
        where: { OR: [{ project: { companyId: { in: companyIds } } }, { companyId: { in: companyIds } }] },
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
        select: { id: true, title: true, type: true, target: true, actual: true, status: true },
        take: 100,
      }),
    ]);

    // Previous MUSE suggestions for context
    const prevSuggestions = await prisma.museSuggestion.findMany({
      where: { OR: [{ companyId: { in: companyIds } }, { companyId: null }] },
      select: { title: true, category: true, status: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const systemContext = {
      projects: projects.map(p => ({
        name: p.name, status: p.status, budget: p.budget, spent: p.spent,
        progress: p.progress, startDate: p.startDate, endDate: p.endDate,
        donorName: p.donorName, country: p.country,
      })),
      taskSummary: {
        total: tasks.length,
        byStatus: tasks.reduce((acc: any, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {}),
      },
      riskSummary: {
        total: risks.length,
        byLevel: risks.reduce((acc: any, r) => { acc[r.level] = (acc[r.level] || 0) + 1; return acc; }, {}),
        openHighCritical: risks.filter(r => (r.level === 'HIGH' || r.level === 'CRITICAL') && r.status === 'open').length,
      },
      financeSummary: {
        totalIncome: transactions.filter(t => t.type === 'INCOME').reduce((s, t) => s + (t.amount || 0), 0),
        totalExpense: transactions.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + (t.amount || 0), 0),
      },
      objectivesSummary: {
        total: objectives.length,
        withTarget: objectives.filter(o => o.target).length,
        withActual: objectives.filter(o => o.actual).length,
      },
      previousSuggestions: prevSuggestions,
    };

    const userPrompt = body.prompt || 'Analiza los datos del sistema y genera sugerencias estrat\u00e9gicas.';

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
- Considera el contexto de desarrollo rural y comercio
- No repitas sugerencias previamente generadas (ver previousSuggestions)
- Formato: responde en texto libre, claro y bien estructurado con secciones y puntos clave`;

    const stream = geminiStreamAsOpenAICompatibleSSE(systemPrompt, userPrompt);

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
