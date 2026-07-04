export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { forgeT } from '@/lib/forge/i18n';
import type { Locale } from '@/lib/i18n';
import { isValidLocale, rejoinFeriaParticipant } from '@/lib/forge/feria-kiosk';

function localeFromReq(body: { locale?: string }): Locale {
  return isValidLocale(body.locale) ? body.locale : 'es';
}

type RejoinBody = {
  roomCode?: string;
  email?: string;
  accessCode?: string;
  locale?: string;
};

/** Reentrada na feira — email + código pessoal (um por email). */
export async function POST(req: NextRequest) {
  let body: RejoinBody = {};
  try {
    body = (await req.json()) as RejoinBody;
    const result = await rejoinFeriaParticipant({
      roomCode: body.roomCode ?? '',
      email: body.email ?? '',
      accessCode: body.accessCode ?? '',
    });

    return NextResponse.json(result);
  } catch (e) {
    const locale = localeFromReq(body);
    const key = e instanceof Error ? e.message : 'forge.general.error';
    const message = key.startsWith('forge.') ? forgeT(key, locale) : key;
    const status =
      key === 'forge.feria.invalidRoom' || key === 'forge.feria.invalidCredentials' ? 404 : 400;
    return NextResponse.json({ error: message, errorKey: key.startsWith('forge.') ? key : undefined }, { status });
  }
}
