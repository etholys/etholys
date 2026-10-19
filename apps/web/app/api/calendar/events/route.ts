export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { loadCalendarFeed } from '@/lib/calendar/feed';
import { parseCalendarWrite } from '@/lib/calendar/payload';
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

    const parsed = parseCalendarWrite(await req.json(), { companyRequired: true });
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    const companyId = parsed.companyId;
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const created = await prisma.calendarEvent.create({
      data: {
        companyId,
        createdById: tenant.userId,
        ...parsed.data,
      },
    });
    return NextResponse.json({ id: created.id });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[calendar/events] POST', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
