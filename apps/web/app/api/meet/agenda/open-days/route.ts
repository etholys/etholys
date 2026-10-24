export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  BookingError,
  createBookingOpenDay,
  deactivateBookingOpenDay,
  getOrganizerAgenda,
} from '@/lib/meet/booking';

function fail(error: unknown) {
  if (error instanceof BookingError) {
    const status = error.code === 'not_found' ? 404 : 400;
    return NextResponse.json({ error: error.code }, { status });
  }
  const msg = error instanceof Error ? error.message : 'Error interno';
  console.error('[chorus/agenda/open-days]', error);
  return NextResponse.json({ error: msg }, { status: 500 });
}

async function tenantCompany(companyId: string | null | undefined) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  const id = companyId?.trim() || '';
  if (!id || !tenant.companyIds.includes(id)) {
    return { error: NextResponse.json({ error: 'companyId inválido' }, { status: 400 }) };
  }
  return { tenant, companyId: id };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const gate = await tenantCompany(url.searchParams.get('companyId'));
    if ('error' in gate && gate.error) return gate.error;
    const agenda = await getOrganizerAgenda(gate.companyId, gate.tenant.userId, {
      from: url.searchParams.get('from'),
      to: url.searchParams.get('to'),
    });
    return NextResponse.json({ openDays: agenda.openDays || [] });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      dayYmd?: string;
      title?: string | null;
      description?: string | null;
      locationText?: string | null;
      slotMinutes?: number;
      startMin?: number;
      endMin?: number;
      allowVirtual?: boolean;
      allowInPerson?: boolean;
      from?: string | null;
      to?: string | null;
    };
    const gate = await tenantCompany(body.companyId);
    if ('error' in gate && gate.error) return gate.error;
    const agenda = await createBookingOpenDay({
      companyId: gate.companyId,
      ownerId: gate.tenant.userId,
      dayYmd: body.dayYmd || '',
      title: body.title,
      description: body.description,
      locationText: body.locationText,
      slotMinutes: body.slotMinutes,
      startMin: body.startMin,
      endMin: body.endMin,
      allowVirtual: body.allowVirtual,
      allowInPerson: body.allowInPerson,
      from: body.from,
      to: body.to,
    });
    return NextResponse.json(agenda);
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(req: Request) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      openDayId?: string;
      from?: string | null;
      to?: string | null;
    };
    const gate = await tenantCompany(body.companyId);
    if ('error' in gate && gate.error) return gate.error;
    const agenda = await deactivateBookingOpenDay(
      gate.companyId,
      gate.tenant.userId,
      body.openDayId || '',
      { from: body.from, to: body.to },
    );
    return NextResponse.json(agenda);
  } catch (error) {
    return fail(error);
  }
}
