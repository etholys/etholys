export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { syncGoogleCalendarBidirectional } from '@/lib/meet/calendar-google-sync';

/**
 * Sync Google Calendar primary ↔ CHORUS (incremental; sem janela curta).
 * POST { companyId }
 */
export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = (await req.json()) as { companyId?: string; forceFull?: boolean };
    const companyId = body.companyId?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const result = await syncGoogleCalendarBidirectional({
      companyId,
      userId: tenant.userId,
      // forceFull: apanha convites meet.etholys.com que o incremental já tinha saltado
      forceFull: body.forceFull !== false,
    });

    return NextResponse.json({
      ok: true,
      imported: result.imported,
      updated: result.updated,
      cancelled: result.cancelled,
      skipped: result.skipped,
      mode: result.mode,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    console.error('[meet/calendar/import]', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
