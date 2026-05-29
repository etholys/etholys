export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getForgeAccessContext } from '@/lib/forge/access-context';

export async function GET() {
  try {
    const ctx = await getForgeAccessContext();
    if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    return NextResponse.json(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
