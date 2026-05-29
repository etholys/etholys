export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

async function loadModuleWithAccess(moduleId: string, tenant: { userId: string; companyIds: string[] }) {
  const mod = await getForgeDb().forgeModule.findFirst({
    where: {
      id: moduleId,
      course: { companyId: { in: tenant.companyIds } },
    },
    include: { course: true },
  });
  if (!mod) return null;
  const access = await getForgeCourseAccess(
    tenant.userId,
    mod.course.companyId,
    mod.course.id,
    mod.course.createdById
  );
  if (!access.canFacilitate) return null;
  return mod;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const mod = await loadModuleWithAccess(id, tenant);
    if (!mod) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    const body = (await req.json()) as { title?: string; sortOrder?: number };
    const data: { title?: string; sortOrder?: number } = {};
    if (typeof body.title === 'string') {
      const t = body.title.trim();
      if (!t) return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });
      data.title = t.slice(0, 300);
    }
    if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;

    const updated = await getForgeDb().forgeModule.update({ where: { id }, data });
    return NextResponse.json({ module: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const mod = await loadModuleWithAccess(id, tenant);
    if (!mod) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    await getForgeDb().forgeModule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
