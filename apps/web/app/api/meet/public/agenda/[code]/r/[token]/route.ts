export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { BookingError, bookerRespond, getBookingStatus } from '@/lib/meet/booking';

type Ctx = { params: Promise<{ code: string; token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { code, token } = await ctx.params;
    const status = await getBookingStatus(code || '', token || '');
    if (!status) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json(status);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { code, token } = await ctx.params;
    const body = (await req.json()) as { action?: string; locale?: string };
    const status = await bookerRespond({
      code: code || '',
      token: token || '',
      action: body.action || '',
      locale: body.locale,
    });
    return NextResponse.json(status);
  } catch (error) {
    if (error instanceof BookingError) {
      const status = error.code === 'not_found' ? 404 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[chorus/agenda/status]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
