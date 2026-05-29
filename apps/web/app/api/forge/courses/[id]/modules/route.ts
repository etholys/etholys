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

    const body = (await req.json()) as { title?: string; sortOrder?: number };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });

    const count = await getForgeDb().forgeModule.count({ where: { courseId } });
    const mod = await getForgeDb().forgeModule.create({
      data: {
        courseId,
        title: title.slice(0, 300),
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : count,
      },
    });

    return NextResponse.json({ module: mod });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
