export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { seedForgeDemoCourse } from '@/lib/forge/seed-demo';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as { companyId?: string };
    const companyId = resolveForgeCompanyId(tenant, body.companyId ?? null);
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const courseId = await seedForgeDemoCourse(companyId, tenant.userId);
    return NextResponse.json({ ok: true, courseId });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
