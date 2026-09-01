export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import {
  buildAtlasTransactionTemplateCsv,
  buildAtlasTransactionTemplateXlsx,
} from '@/lib/atlas/transaction-import';

export async function GET(req: Request) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') || 'xlsx').toLowerCase();
  const localeRaw = (url.searchParams.get('locale') || 'es').toLowerCase();
  const locale = localeRaw === 'pt' || localeRaw === 'en' ? localeRaw : 'es';

  if (format === 'csv') {
    const csv = '\uFEFF' + buildAtlasTransactionTemplateCsv();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ATLAS-transacciones.csv"',
        'Cache-Control': 'no-store',
      },
    });
  }

  const buf = buildAtlasTransactionTemplateXlsx(locale);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="ATLAS-transacciones.xlsx"',
      'Cache-Control': 'no-store',
    },
  });
}
