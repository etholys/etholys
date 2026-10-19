export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { parseCalendarWrite } from '@/lib/calendar/payload';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: params.id },
      select: { companyId: true },
    });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    }
    const parsed = parseCalendarWrite(await req.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: parsed.status });
    await prisma.calendarEvent.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[calendar/events] PATCH', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    const { id } = params;
    const existing = await prisma.calendarEvent.findUnique({ where: { id }, select: { companyId: true } });
    if (!existing || !tenant.companyIds.includes(existing.companyId)) {
      return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    }
    await prisma.calendarEvent.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[calendar/events] DELETE', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
