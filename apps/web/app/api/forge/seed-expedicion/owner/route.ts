export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { isExpedicionOwnerUserId } from '@/lib/forge/expedicion-owner';
import { seedExpedicionForOwner } from '@/lib/forge/seed-expedicion-for-owner';
import { requireForgeTenant } from '@/lib/forge/tenant';

/** Republica el curso en todas las empresas del titular (Tiago / Rural Commerce). */
export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    if (!(await isExpedicionOwnerUserId(tenant.userId))) {
      return NextResponse.json(
        { error: 'Solo el titular del programa puede republicar La Expedición en todas sus empresas.' },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as { replace?: boolean };
    const result = await seedExpedicionForOwner({ replace: body.replace !== false });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
