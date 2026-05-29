export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { serializeLiveSession } from '@/lib/forge/serialize-live-session';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';

type Ctx = { params: Promise<{ sessionId: string }> };

async function loadSession(sessionId: string, tenant: { userId: string; companyIds: string[] }) {
  const row = await getForgeDb().forgeLiveSession.findUnique({
    where: { id: sessionId },
    include: { focusActivity: { select: { title: true } }, course: true },
  });
  if (!row) return null;
  const access = await loadCourseForTenant(row.courseId, tenant);
  if (!access) return null;
  return row;
}

async function canFacilitateSession(
  tenant: { userId: string; companyIds: string[] },
  course: { id: string; companyId: string; createdById: string | null }
) {
  const access = await getForgeCourseAccess(
    tenant.userId,
    course.companyId,
    course.id,
    course.createdById
  );
  return access.canFacilitate;
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { sessionId } = await ctx.params;
    const existing = await loadSession(sessionId, tenant);
    if (!existing) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    if (!(await canFacilitateSession(tenant, existing.course))) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (typeof body.title === 'string') data.title = body.title.trim().slice(0, 200);
    if (body.startsAt != null) {
      const d = new Date(String(body.startsAt));
      if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Início inválido' }, { status: 400 });
      data.startsAt = d;
    }
    if (body.endsAt !== undefined) {
      if (body.endsAt === null || body.endsAt === '') data.endsAt = null;
      else {
        const d = new Date(String(body.endsAt));
        if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'Fim inválido' }, { status: 400 });
        data.endsAt = d;
      }
    }
    if (typeof body.meetingUrl === 'string') data.meetingUrl = body.meetingUrl.trim().slice(0, 500) || null;
    if (typeof body.facilitatorNotes === 'string') {
      data.facilitatorNotes = body.facilitatorNotes.slice(0, 2000);
    }
    if (typeof body.recordingUrl === 'string') {
      data.recordingUrl = body.recordingUrl.trim().slice(0, 500) || null;
    }
    if (typeof body.recordingNotes === 'string') {
      data.recordingNotes = body.recordingNotes.slice(0, 2000);
    }
    if (body.activityId === null) data.activityId = null;
    if (typeof body.activityId === 'string' && body.activityId) {
      const act = await getForgeDb().forgeLearningActivity.findFirst({
        where: { id: body.activityId, module: { courseId: existing.courseId } },
      });
      if (!act) return NextResponse.json({ error: 'Atividade inválida' }, { status: 400 });
      data.activityId = act.id;
    }

    const row = await getForgeDb().forgeLiveSession.update({
      where: { id: sessionId },
      data,
      include: { focusActivity: { select: { title: true } } },
    });

    return NextResponse.json({ session: serializeLiveSession(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { sessionId } = await ctx.params;
    const existing = await loadSession(sessionId, tenant);
    if (!existing) return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    if (!(await canFacilitateSession(tenant, existing.course))) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    await getForgeDb().forgeLiveSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
