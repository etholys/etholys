export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const spec = await getForgeDb().forgeGameSpec.findFirst({
      where: { id, companyId: { in: tenant.companyIds } },
    });
    if (!spec) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    return NextResponse.json({ gameSpec: spec });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const existing = await getForgeDb().forgeGameSpec.findFirst({
      where: { id, companyId: { in: tenant.companyIds } },
    });
    if (!existing) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

    const body = (await req.json()) as { status?: string; title?: string };
    const data: { status?: string; title?: string } = {};
    if (body.status === 'draft' || body.status === 'published') data.status = body.status;
    if (typeof body.title === 'string') data.title = body.title.slice(0, 300);

    const spec = await getForgeDb().forgeGameSpec.update({ where: { id }, data });
    return NextResponse.json({ gameSpec: spec });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
