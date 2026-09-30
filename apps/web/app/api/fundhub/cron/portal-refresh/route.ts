export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { runPortalRefreshBatch } from '@/lib/opportunity/portal-refresh';

/**
 * Cron: refresh leve da base permanente de portais + sync watch reopen.
 * Authorization: Bearer {FUNDHUB_CRON_SECRET|FORGE_CRON_SECRET}
 *
 * Body opcional: { companyId?, limitCompanies? }
 */
export async function POST(req: NextRequest) {
  const secret =
    process.env.FUNDHUB_CRON_SECRET?.trim() || process.env.FORGE_CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'CRON secret no configurado' }, { status: 503 });
  }
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    companyId?: string;
    limitCompanies?: number;
  };

  const result = await runPortalRefreshBatch({
    companyId: body.companyId?.trim() || undefined,
    limitCompanies: body.limitCompanies,
  });

  const fetched = result.results.reduce((n, r) => n + r.fetched, 0);
  const notified = result.results.reduce((n, r) => n + r.watchNotified, 0);

  return NextResponse.json({
    ok: true,
    companies: result.companies,
    fetched,
    watchNotified: notified,
    results: result.results,
  });
}
