export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { serializeLiveSession } from '@/lib/forge/serialize-live-session';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { ensureMeetForForgeLiveSession } from '@/lib/meet/forge-bridge';

type Ctx = { params: Promise<{ sessionId: string }> };

/** Provisiona / reutiliza Etholys Meet para uma sessão live FORGE existente. */
export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { sessionId } = await ctx.params;
    const row = await getForgeDb().forgeLiveSession.findUnique({
      where: { id: sessionId },
      include: {
        course: true,
        focusActivity: { select: { title: true } },
        meetSessions: { select: { id: true }, take: 1 },
      },
    });
    if (!row) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });

    const access = await loadCourseForTenant(row.courseId, tenant);
    if (!access) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const fac = await getForgeCourseAccess(
      tenant.userId,
      row.course.companyId,
      row.course.id,
      row.course.createdById,
    );
    if (!fac.canFacilitate) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const meet = await ensureMeetForForgeLiveSession({
      companyId: row.course.companyId,
      createdById: tenant.userId,
      live: {
        id: row.id,
        title: row.title,
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        meetingUrl: row.meetingUrl,
        courseId: row.courseId,
      },
      courseTitle: row.course.title,
    });

    const updated = await getForgeDb().forgeLiveSession.findUnique({
      where: { id: sessionId },
      include: {
        focusActivity: { select: { title: true } },
        meetSessions: { select: { id: true }, take: 1, orderBy: { createdAt: 'asc' } },
      },
    });

    return NextResponse.json({
      meetSessionId: meet.meetSessionId,
      meetingUrl: meet.meetingUrl,
      created: meet.created,
      session: updated ? serializeLiveSession(updated) : null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    console.error('[forge/live-sessions/ensure-meet]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
