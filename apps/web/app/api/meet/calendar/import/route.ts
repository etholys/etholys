export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { importGoogleCalendarIntoMeet } from '@/lib/meet/calendar-google-import';

/**
 * Puxa eventos do Google Calendar do utilizador para MeetSession (captura/transcrição).
 * POST { companyId, daysBack?: number, daysForward?: number }
 */
export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      companyId?: string;
      daysBack?: number;
      daysForward?: number;
    };
    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const daysBack = Math.min(30, Math.max(0, Number(body.daysBack ?? 7) || 7));
    const daysForward = Math.min(60, Math.max(1, Number(body.daysForward ?? 21) || 21));
    const timeMin = new Date(Date.now() - daysBack * 86_400_000);
    const timeMax = new Date(Date.now() + daysForward * 86_400_000);

    const result = await importGoogleCalendarIntoMeet({
      companyId,
      userId: tenant.userId,
      timeMin,
      timeMax,
    });

    return NextResponse.json({
      ok: true,
      ...result,
      window: { timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString() },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/calendar/import]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
