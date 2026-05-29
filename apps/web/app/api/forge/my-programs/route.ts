export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getMyForgePrograms } from '@/lib/forge/my-programs';
import { requireForgeTenant } from '@/lib/forge/tenant';

export async function GET() {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const programs = await getMyForgePrograms(tenant.userId);
    return NextResponse.json({ programs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
