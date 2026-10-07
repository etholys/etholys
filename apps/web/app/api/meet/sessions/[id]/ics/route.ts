export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { getMeetSessionForCompany } from '@/lib/meet/create-session';
import { buildMeetIcs } from '@/lib/meet/ics';
import { meetPublicJoinUrl } from '@/lib/meet/types';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { id } = await ctx.params;
    const companyId = new URL(req.url).searchParams.get('companyId')?.trim();
    if (!companyId || !tenant.companyIds.includes(companyId)) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await getMeetSessionForCompany(id, companyId);
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    const starts = session.scheduledAt ?? session.createdAt;
    const ends = session.endsAt ?? new Date(starts.getTime() + 60 * 60 * 1000);
    const joinUrl = meetPublicJoinUrl(session.id, companyId);
    const ics = buildMeetIcs({
      uid: `${session.id}@etholys.meet`,
      title: session.title,
      description: [session.description, joinUrl].filter(Boolean).join('\n\n') || joinUrl,
      locationUrl: joinUrl,
      startsAt: starts,
      endsAt: ends,
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="etholys-meet-${session.id.slice(0, 8)}.ics"`,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
