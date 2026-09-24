export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { ingestOfficialEdital } from '@/lib/opportunity/ingest-edital';
import { isSafePublicHttpUrl } from '@/lib/opportunity/call-evidence';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { url?: string };
  const url = String(body.url ?? '').trim();
  if (!isSafePublicHttpUrl(url)) {
    return NextResponse.json({ error: 'URL oficial inválida' }, { status: 400 });
  }

  try {
    const edital = await ingestOfficialEdital(url);
    return NextResponse.json({ edital });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Não foi possível ler o edital' },
      { status: 502 },
    );
  }
}
