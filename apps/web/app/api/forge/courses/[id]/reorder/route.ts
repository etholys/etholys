export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

type ReorderBody = {
  modules?: {
    id: string;
    sortOrder: number;
    activities?: { id: string; sortOrder: number }[];
  }[];
};

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: courseId } = await ctx.params;
    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const access = await getForgeCourseAccess(
      tenant.userId,
      course.companyId,
      course.id,
      course.createdById
    );
    if (!access.canFacilitate) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }

    const body = (await req.json()) as ReorderBody;
    const modules = body.modules;
    if (!Array.isArray(modules) || modules.length === 0) {
      return NextResponse.json({ error: 'modules é obrigatório' }, { status: 400 });
    }

    const db = getForgeDb();
    const existing = await db.forgeModule.findMany({
      where: { courseId },
      include: { activities: { select: { id: true } } },
    });
    const moduleIds = new Set(existing.map((m) => m.id));
    const activityIds = new Set(existing.flatMap((m) => m.activities.map((a) => a.id)));

    for (const mod of modules) {
      if (!moduleIds.has(mod.id)) {
        return NextResponse.json({ error: 'Módulo inválido' }, { status: 400 });
      }
      for (const act of mod.activities ?? []) {
        if (!activityIds.has(act.id)) {
          return NextResponse.json({ error: 'Atividade inválida' }, { status: 400 });
        }
      }
    }

    await db.$transaction(async (tx) => {
      for (const mod of modules) {
        await tx.forgeModule.update({
          where: { id: mod.id },
          data: { sortOrder: mod.sortOrder },
        });
        for (const act of mod.activities ?? []) {
          await tx.forgeLearningActivity.update({
            where: { id: act.id },
            data: { sortOrder: act.sortOrder },
          });
        }
      }
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
