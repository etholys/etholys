export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  BookingError,
  addBookingBlock,
  getOrganizerAgenda,
  removeBookingBlock,
  updateBookingPage,
} from '@/lib/meet/booking';
import { MEET_TIMEZONE_OPTIONS } from '@/lib/meet/timezone';

function fail(error: unknown) {
  if (error instanceof BookingError) {
    const status = error.code === 'not_found' ? 404 : 400;
    return NextResponse.json({ error: error.code }, { status });
  }
  const msg = error instanceof Error ? error.message : 'Error interno';
  console.error('[chorus/agenda]', error);
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
    const companyId = new URL(req.url).searchParams.get('companyId');
    const gate = await tenantCompany(companyId);
    if ('error' in gate && gate.error) return gate.error;
    const agenda = await getOrganizerAgenda(gate.companyId, gate.tenant.userId);
    return NextResponse.json({ ...agenda, timeZones: MEET_TIMEZONE_OPTIONS });
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      title?: string;
      description?: string | null;
      timeZone?: string;
      slotMinutes?: number;
      locationText?: string | null;
      allowVirtual?: boolean;
      allowInPerson?: boolean;
      windows?: { weekday: number; startMin: number; endMin: number }[];
      holidayCountries?: unknown;
      locale?: string;
    };
    const gate = await tenantCompany(body.companyId);
    if ('error' in gate && gate.error) return gate.error;
    const agenda = await updateBookingPage({
      companyId: gate.companyId,
      ownerId: gate.tenant.userId,
      title: body.title || '',
      description: body.description,
      timeZone: body.timeZone || '',
      slotMinutes: Number(body.slotMinutes || 30),
      locationText: body.locationText,
      allowVirtual: Boolean(body.allowVirtual),
      allowInPerson: Boolean(body.allowInPerson),
      windows: Array.isArray(body.windows) ? body.windows : [],
      holidayCountries: body.holidayCountries,
      locale: body.locale,
    });
    return NextResponse.json(agenda);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      companyId?: string;
      action?: string;
      blockId?: string;
      startsAt?: string;
      endsAt?: string;
    };
    const gate = await tenantCompany(body.companyId);
    if ('error' in gate && gate.error) return gate.error;
    if (body.action === 'remove-block') {
      const agenda = await removeBookingBlock(gate.companyId, gate.tenant.userId, body.blockId || '');
      return NextResponse.json(agenda);
    }
    const agenda = await addBookingBlock({
      companyId: gate.companyId,
      ownerId: gate.tenant.userId,
      startsAt: body.startsAt || '',
      endsAt: body.endsAt || '',
    });
    return NextResponse.json(agenda);
  } catch (error) {
    return fail(error);
  }
}
