export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { completeForgeActivity } from '@/lib/forge/progress';
import { loadActivityForTenant, requireForgeTenant } from '@/lib/forge/tenant';

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      activityId?: string;
      score?: number;
      payload?: Record<string, unknown>;
    };

    const activityId = typeof body.activityId === 'string' ? body.activityId : '';
    if (!activityId) return NextResponse.json({ error: 'activityId é obrigatório' }, { status: 400 });

    const activity = await loadActivityForTenant(activityId, tenant);
    if (!activity) return NextResponse.json({ error: 'Atividade não encontrada' }, { status: 404 });

    const result = await completeForgeActivity({
      userId: tenant.userId,
      activityId,
      score: typeof body.score === 'number' ? body.score : null,
      payload: body.payload,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
