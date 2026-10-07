export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getUserCompanyIds } from '@/lib/tenant';
import { prisma } from '@/lib/prisma';
import { assertMeetPrismaReady } from '@/lib/meet/create-session';
import { meetHubJoinPath } from '@/lib/meet/types';

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Resolve um slug de sala de vídeo (links antigos meet.etholys.com/…) → Hub CHORUS.
 */
export async function GET(req: Request, ctx: Ctx) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const { slug: rawSlug } = await ctx.params;
    const slug = decodeURIComponent(rawSlug || '').trim();
    if (!slug) return NextResponse.json({ error: 'slug inválido' }, { status: 400 });

    assertMeetPrismaReady();
    const companyFilter = new URL(req.url).searchParams.get('companyId')?.trim();
    const companyIds = companyFilter
      ? tenant.companyIds.includes(companyFilter)
        ? [companyFilter]
        : []
      : tenant.companyIds;
    if (companyIds.length === 0) {
      return NextResponse.json({ error: 'companyId inválido' }, { status: 400 });
    }

    const session = await prisma.meetSession.findFirst({
      where: {
        companyId: { in: companyIds },
        OR: [{ roomSlug: slug }, { meetingUrl: { contains: slug } }, { id: slug }],
        status: { not: 'cancelled' },
      },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, companyId: true, title: true, roomSlug: true },
    });
    if (!session) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    return NextResponse.json({
      session,
      joinPath: meetHubJoinPath(session.id, session.companyId),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
