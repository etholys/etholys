export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadCalendarFeed } from '@/lib/calendar/feed';
import { prisma } from '@/lib/prisma';

function parseRange(searchParams: URLSearchParams) {
  const from = new Date(searchParams.get('from') || '');
  const to = new Date(searchParams.get('to') || '');
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return null;
  return { from, to };
}

export async function GET(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId')?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    const range = parseRange(searchParams);
    if (!range) return NextResponse.json({ error: 'from/to inválidos' }, { status: 400 });

    const feed = await loadCalendarFeed(companyId, range.from, range.to);
    return NextResponse.json(feed);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[calendar/events] GET', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      companyId?: string;
      title?: string;
      description?: string;
      startsAt?: string;
      endsAt?: string | null;
      allDay?: boolean;
    };
    const companyId = body.companyId?.trim();
    const title = body.title?.trim();
    const startsAt = new Date(body.startsAt || '');
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }
    if (!title) return NextResponse.json({ error: 'title requerido' }, { status: 400 });
    if (!Number.isFinite(startsAt.getTime())) {
      return NextResponse.json({ error: 'startsAt inválido' }, { status: 400 });
    }
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (endsAt && !Number.isFinite(endsAt.getTime())) {
      return NextResponse.json({ error: 'endsAt inválido' }, { status: 400 });
    }

    const created = await prisma.calendarEvent.create({
      data: {
        companyId,
        createdById: tenant.userId,
        title: title.slice(0, 200),
        description: body.description?.trim()?.slice(0, 2000) || null,
        startsAt,
        endsAt,
        allDay: Boolean(body.allDay),
      },
    });
    return NextResponse.json({ id: created.id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[calendar/events] POST', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
