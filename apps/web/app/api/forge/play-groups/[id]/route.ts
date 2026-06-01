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
    const group = await getForgeDb().forgePlayGroup.findFirst({
      where: { id, course: { companyId: { in: tenant.companyIds } } },
      select: {
        id: true,
        name: true,
        mode: true,
        courseId: true,
        liveSessionId: true,
      },
    });
    if (!group) return NextResponse.json({ error: 'Grupo não encontrado' }, { status: 404 });

    return NextResponse.json({ group });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
