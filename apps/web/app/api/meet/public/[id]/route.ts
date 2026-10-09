export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { assertMeetPrismaReady } from '@/lib/meet/create-session';

type Ctx = { params: Promise<{ id: string }> };

/** Dados mínimos para um convidado entrar no browser, sem conta Etholys. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const sessionId = id?.trim();
    if (!sessionId) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

    assertMeetPrismaReady();
    const session = await prisma.meetSession.findFirst({
      where: { id: sessionId, status: { not: 'cancelled' } },
      select: {
        id: true,
        companyId: true,
        title: true,
        meetingUrl: true,
        status: true,
      },
    });
    if (!session?.meetingUrl) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }
    return NextResponse.json({ session });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
