export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { forgeT } from '@/lib/forge/i18n';
import type { Locale } from '@/lib/i18n';
import {
  isValidLocale,
  normalizeRoomCode,
  registerFeriaParticipant,
} from '@/lib/forge/feria-kiosk';

function localeFromReq(body: { locale?: string }): Locale {
  return isValidLocale(body.locale) ? body.locale : 'es';
}

type RegisterBody = {
  roomCode?: string;
  email?: string;
  name?: string;
  ageRange?: string;
  gender?: string;
  locale?: string;
  consent?: boolean;
};

/** Inscrição na feira — email obrigatório, agrupamento aleatório, código pessoal por email. */
export async function POST(req: NextRequest) {
  let body: RegisterBody = {};
  try {
    body = (await req.json()) as RegisterBody;
    const locale = localeFromReq(body);

    const result = await registerFeriaParticipant({
      roomCode: body.roomCode ?? '',
      email: body.email ?? '',
      name: body.name ?? '',
      ageRange: body.ageRange,
      gender: body.gender,
      locale,
      consent: body.consent === true,
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

/** Valida código da sala (público, sem dados sensíveis). */
export async function GET(req: NextRequest) {
  const roomCode = normalizeRoomCode(req.nextUrl.searchParams.get('roomCode') ?? '');
  const locale = localeFromReq({ locale: req.nextUrl.searchParams.get('locale') ?? undefined });

  if (!roomCode) {
    return NextResponse.json(
      { error: forgeT('forge.feria.roomRequired', locale) },
      { status: 400 }
    );
  }

  const { getForgeDb } = await import('@/lib/forge/db');
  const session = await getForgeDb().forgeFeriaSession.findFirst({
    where: { roomCode, active: true },
    include: { course: { select: { title: true } } },
  });

  if (!session) {
    return NextResponse.json(
      { error: forgeT('forge.feria.invalidRoom', locale), errorKey: 'forge.feria.invalidRoom' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    roomCode: session.roomCode,
    title: session.title ?? session.course.title,
    teamSize: session.teamSize,
  });
}
