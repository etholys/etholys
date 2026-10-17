export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getBookingIcs } from '@/lib/meet/booking';

type Ctx = { params: Promise<{ code: string; token: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { code, token } = await ctx.params;
  const ics = await getBookingIcs(code || '', token || '');
  if (!ics) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="chorus-agenda.ics"',
    },
  });
}
