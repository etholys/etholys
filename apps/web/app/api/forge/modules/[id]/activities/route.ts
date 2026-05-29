export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { isForgeActivityType } from '@/lib/forge/types';
import { requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: moduleId } = await ctx.params;
    const mod = await getForgeDb().forgeModule.findFirst({
      where: {
        id: moduleId,
        course: { companyId: { in: tenant.companyIds } },
      },
    });
    if (!mod) return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 });

    const body = (await req.json()) as {
      type?: string;
      title?: string;
      config?: Record<string, unknown>;
      gameSpecId?: string;
      xpWeight?: number;
      sortOrder?: number;
    };

    const type = typeof body.type === 'string' ? body.type : 'lesson';
    if (!isForgeActivityType(type)) {
      return NextResponse.json({ error: 'type inválido' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });

    if (type === 'game' && body.gameSpecId) {
      const spec = await getForgeDb().forgeGameSpec.findFirst({
        where: { id: body.gameSpecId, companyId: { in: tenant.companyIds } },
      });
      if (!spec) return NextResponse.json({ error: 'GameSpec não encontrado' }, { status: 404 });
    }

    const count = await getForgeDb().forgeLearningActivity.count({ where: { moduleId } });
    const activity = await getForgeDb().forgeLearningActivity.create({
      data: {
        moduleId,
        type,
        title: title.slice(0, 300),
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : count,
        config: body.config ?? {},
        gameSpecId: type === 'game' ? body.gameSpecId ?? null : null,
        xpWeight: typeof body.xpWeight === 'number' ? body.xpWeight : 1,
      },
      include: { gameSpec: true },
    });

    return NextResponse.json({ activity });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
