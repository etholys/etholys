export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getProgramAnalytics } from '@/lib/forge/program-analytics';
import { requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const program = await getForgeDb().forgeProgram.findUnique({
      where: { id },
      include: {
        courses: {
          select: { id: true, title: true, status: true, coverEmoji: true, programId: true },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });
    if (!program) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!tenant.companyIds.includes(program.companyId)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const analytics = await getProgramAnalytics(id);
    const allCourses = await getForgeDb().forgeCourse.findMany({
      where: { companyId: program.companyId, status: { not: 'archived' } },
      select: { id: true, title: true, coverEmoji: true, programId: true },
      orderBy: { title: 'asc' },
    });

    return NextResponse.json({ program, analytics, availableCourses: allCourses });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const program = await getForgeDb().forgeProgram.findUnique({ where: { id } });
    if (!program) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (!tenant.companyIds.includes(program.companyId)) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const body = (await req.json()) as {
      title?: string;
      description?: string;
      courseIds?: string[];
      enforceOrder?: boolean;
      courseSortOrders?: { courseId: string; sortOrder: number }[];
    };

    if (typeof body.title === 'string') {
      await getForgeDb().forgeProgram.update({
        where: { id },
        data: { title: body.title.trim().slice(0, 300) },
      });
    }
    if (typeof body.description === 'string') {
      await getForgeDb().forgeProgram.update({
        where: { id },
        data: { description: body.description.slice(0, 5000) },
      });
    }

    if (typeof body.enforceOrder === 'boolean') {
      await getForgeDb().forgeProgram.update({
        where: { id },
        data: { enforceOrder: body.enforceOrder },
      });
    }

    if (Array.isArray(body.courseSortOrders)) {
      for (const row of body.courseSortOrders) {
        if (!row.courseId) continue;
        await getForgeDb().forgeCourse.updateMany({
          where: { id: row.courseId, companyId: program.companyId },
          data: { programSortOrder: Number(row.sortOrder) || 0 },
        });
      }
    }

    if (Array.isArray(body.courseIds)) {
      const allowed = await getForgeDb().forgeCourse.findMany({
        where: { companyId: program.companyId, id: { in: body.courseIds } },
        select: { id: true },
      });
      const allowedIds = new Set(allowed.map((c) => c.id));

      await getForgeDb().forgeCourse.updateMany({
        where: { programId: id, companyId: program.companyId },
        data: { programId: null },
      });

      if (allowedIds.size > 0) {
        await getForgeDb().forgeCourse.updateMany({
          where: { id: { in: [...allowedIds] } },
          data: { programId: id },
        });
      }
    }

    const updated = await getForgeDb().forgeProgram.findUnique({
      where: { id },
      include: {
        courses: { select: { id: true, title: true, coverEmoji: true, status: true } },
      },
    });

    return NextResponse.json({ program: updated });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
