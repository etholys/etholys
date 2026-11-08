export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { ingestOfficialEdital } from '@/lib/opportunity/ingest-edital';
import { isSafePublicHttpUrl } from '@/lib/opportunity/call-evidence';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import { normalizeFundhubLocale } from '@/lib/agents/fundhub-proposal-prompt';

function apiMsg(locale: unknown, es: string, pt: string, en: string): string {
  const L = normalizeFundhubLocale(locale);
  if (L === 'pt') return pt;
  if (L === 'en') return en;
  return es;
}

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  const body = (await req.json().catch(() => ({}))) as { url?: string; locale?: unknown };
  if (!ctx) {
    return NextResponse.json(
      {
        error: apiMsg(body.locale, 'No autorizado', 'Não autorizado', 'Unauthorized'),
      },
      { status: 401 },
    );
  }

  const url = String(body.url ?? '').trim();
  if (!isSafePublicHttpUrl(url)) {
    return NextResponse.json(
      {
        error: apiMsg(body.locale, 'URL oficial inválida', 'URL oficial inválida', 'Invalid official URL'),
      },
      { status: 400 },
    );
  }

  try {
    const edital = await ingestOfficialEdital(url, { locale: body.locale });
    return NextResponse.json({ edital });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : apiMsg(
                body.locale,
                'No se pudo leer el edital',
                'Não foi possível ler o edital',
                'Could not read the call',
              ),
      },
      { status: 502 },
    );
  }
}
