export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { BookingError, createBookingRequest, getPublicAgenda } from '@/lib/meet/booking';
import { getUserCompanyIds } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { publicAgendaViewer } from '@/lib/meet/agenda-viewer';

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { code } = await ctx.params;
    const publicCode = code || '';
    const tenant = await getUserCompanyIds();
    if (tenant) {
      const owned = await prisma.meetBookingPage.findUnique({
        where: { publicCode },
        select: { ownerId: true, companyId: true },
      });
      if (publicAgendaViewer(owned, tenant) === 'owner' && owned) {
        return NextResponse.json({ viewer: 'owner', companyId: owned.companyId });
      }
    }
    const agenda = await getPublicAgenda(publicCode);
    if (!agenda) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ viewer: 'guest', ...agenda });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[chorus/agenda/public]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const { code } = await ctx.params;
    const body = (await req.json()) as {
      name?: string;
      email?: string;
      mode?: string;
      startsAt?: string;
      endsAt?: string;
      note?: string;
      locationText?: string;
      guests?: unknown;
      locale?: string;
    };
    const created = await createBookingRequest({
      code: code || '',
      name: body.name || '',
      email: body.email || '',
      mode: body.mode || '',
      startsAt: body.startsAt || '',
      endsAt: body.endsAt || '',
      note: body.note,
      locationText: body.locationText,
      guests: body.guests,
      locale: body.locale,
    });
    return NextResponse.json(created);
  } catch (error) {
    if (error instanceof BookingError) {
      const status = error.code === 'not_found' ? 404 : 400;
      return NextResponse.json({ error: error.code }, { status });
    }
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[chorus/agenda/public]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
