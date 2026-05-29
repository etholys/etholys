export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ sessionId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { sessionId } = await ctx.params;
  const rows = await getForgeDb().forgeLiveAttendance.findMany({
    where: { liveSessionId: sessionId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: 'desc' },
  });

  return NextResponse.json({
    attendees: rows.map((r) => ({
      userId: r.userId,
      name: r.user.name,
      email: r.user.email,
      joinedAt: r.joinedAt.toISOString(),
      leftAt: r.leftAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const tenant = await requireForgeTenant();
  if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { sessionId } = await ctx.params;
  const session = await getForgeDb().forgeLiveSession.findUnique({
    where: { id: sessionId },
    select: { id: true, courseId: true },
  });
  if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });

  const row = await getForgeDb().forgeLiveAttendance.upsert({
    where: {
      liveSessionId_userId: { liveSessionId: sessionId, userId: tenant.userId },
    },
    create: { liveSessionId: sessionId, userId: tenant.userId },
    update: { joinedAt: new Date() },
  });

  return NextResponse.json({
    ok: true,
    joinedAt: row.joinedAt.toISOString(),
    courseId: session.courseId,
  });
}
