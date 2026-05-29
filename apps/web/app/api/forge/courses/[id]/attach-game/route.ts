export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: courseId } = await ctx.params;
    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const body = (await req.json()) as {
      gameSpecId?: string;
      moduleId?: string;
      title?: string;
      moduleTitle?: string;
    };

    const gameSpecId = typeof body.gameSpecId === 'string' ? body.gameSpecId : '';
    if (!gameSpecId) return NextResponse.json({ error: 'gameSpecId obrigatório' }, { status: 400 });

    const spec = await getForgeDb().forgeGameSpec.findFirst({
      where: { id: gameSpecId, companyId: course.companyId },
    });
    if (!spec) return NextResponse.json({ error: 'GameSpec não encontrado' }, { status: 404 });

    let moduleId = body.moduleId;
    if (!moduleId) {
      const mod = await getForgeDb().forgeModule.create({
        data: {
          courseId,
          title: (body.moduleTitle ?? 'Jogos e prática').slice(0, 300),
          sortOrder: await getForgeDb().forgeModule.count({ where: { courseId } }),
        },
      });
      moduleId = mod.id;
    }

    const count = await getForgeDb().forgeLearningActivity.count({ where: { moduleId } });
    const activity = await getForgeDb().forgeLearningActivity.create({
      data: {
        moduleId,
        type: 'game',
        title: (body.title ?? spec.title).slice(0, 300),
        sortOrder: count,
        gameSpecId: spec.id,
        xpWeight: 2,
        config: {},
      },
      include: { gameSpec: true },
    });

    await getForgeDb().forgeGameSpec.update({
      where: { id: spec.id },
      data: { status: 'published' },
    });

    return NextResponse.json({ activity, moduleId, courseId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
