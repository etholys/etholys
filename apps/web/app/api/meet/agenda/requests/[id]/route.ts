export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { BookingError, organizerAct } from '@/lib/meet/booking';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      companyId?: string;
      action?: string;
      proposedStartsAt?: string | null;
      proposedEndsAt?: string | null;
      locale?: string;
    };
    const companyId = body.companyId?.trim() || '';
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    const result = await organizerAct({
      companyId,
      ownerId: tenant.userId,
      requestId: id,
      action: body.action || '',
      proposedStartsAt: body.proposedStartsAt,
      proposedEndsAt: body.proposedEndsAt,
      locale: body.locale,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BookingError) {
      const status = error.code === 'not_found' ? 404 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[chorus/agenda/request]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
