export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { serializeLiveSession } from '@/lib/forge/serialize-live-session';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: courseId } = await ctx.params;
    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const rows = await getForgeDb().forgeLiveSession.findMany({
      where: { courseId },
      orderBy: { startsAt: 'asc' },
      include: { focusActivity: { select: { title: true } } },
    });

    return NextResponse.json({
      sessions: rows.map((r) => serializeLiveSession(r)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const { id: courseId } = await ctx.params;
    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const body = (await req.json()) as Record<string, unknown>;
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
    if (!title) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 });

    const startsAt = body.startsAt ? new Date(String(body.startsAt)) : null;
    if (!startsAt || Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'Data/hora de início inválida' }, { status: 400 });
    }

    const endsAt = body.endsAt ? new Date(String(body.endsAt)) : null;
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: 'Data/hora de fim inválida' }, { status: 400 });
    }

    let activityId: string | null = null;
    if (typeof body.activityId === 'string' && body.activityId) {
      const act = await getForgeDb().forgeLearningActivity.findFirst({
        where: { id: body.activityId, module: { courseId } },
      });
      if (!act) return NextResponse.json({ error: 'Atividade inválida' }, { status: 400 });
      activityId = act.id;
    }

    const row = await getForgeDb().forgeLiveSession.create({
      data: {
        courseId,
        title,
        startsAt,
        endsAt: endsAt && !Number.isNaN(endsAt.getTime()) ? endsAt : null,
        meetingUrl:
          typeof body.meetingUrl === 'string' && body.meetingUrl.trim()
            ? body.meetingUrl.trim().slice(0, 500)
            : null,
        activityId,
        facilitatorNotes:
          typeof body.facilitatorNotes === 'string'
            ? body.facilitatorNotes.slice(0, 2000)
            : null,
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
      },
      include: { focusActivity: { select: { title: true } } },
    });

    return NextResponse.json({ session: serializeLiveSession(row) }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
