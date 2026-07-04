export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { effectiveEditionStatus } from '@/lib/forge/course-editions';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { buildPlayGroupInviteUrl } from '@/lib/forge/play-group-invite';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string; editionId: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id: courseId, editionId } = await ctx.params;
    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const access = await getForgeCourseAccess(
      tenant.userId,
      course.companyId,
      course.id,
      course.createdById
    );
    if (!access.canFacilitate) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const edition = await getForgeDb().forgeCourseEdition.findFirst({
      where: { id: editionId, courseId },
      include: {
        playGroups: {
          orderBy: { createdAt: 'asc' },
          include: {
            _count: { select: { enrollments: true } },
            liveSession: { select: { id: true, title: true, startsAt: true } },
          },
        },
      },
    });
    if (!edition) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });

    const sessions = await getForgeDb().forgeLiveSession.findMany({
      where: { courseId },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, title: true, startsAt: true, endsAt: true },
    });

    return NextResponse.json({
      edition: {
        id: edition.id,
        name: edition.name,
        status: edition.status,
        effectiveStatus: effectiveEditionStatus(edition.status, edition.startsAt, edition.endsAt),
        startsAt: edition.startsAt?.toISOString() ?? null,
        endsAt: edition.endsAt?.toISOString() ?? null,
        notes: edition.notes,
        createdAt: edition.createdAt.toISOString(),
      },
      groups: edition.playGroups.map((g) => ({
        id: g.id,
        name: g.name,
        mode: g.mode,
        memberCount: g._count.enrollments,
        liveSessionId: g.liveSessionId,
        liveSessionTitle: g.liveSession?.title,
        inviteUrl: g.inviteToken ? buildPlayGroupInviteUrl(g.inviteToken) : null,
      })),
      courseSessions: sessions.map((s) => ({
        id: s.id,
        title: s.title,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id: courseId, editionId } = await ctx.params;
    const course = await loadCourseForTenant(courseId, tenant);
    if (!course) return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 });

    const access = await getForgeCourseAccess(
      tenant.userId,
      course.companyId,
      course.id,
      course.createdById
    );
    if (!access.canFacilitate) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });
    }

    const existing = await getForgeDb().forgeCourseEdition.findFirst({
      where: { id: editionId, courseId },
    });
    if (!existing) return NextResponse.json({ error: 'Turma não encontrada' }, { status: 404 });

    const body = (await req.json()) as {
      name?: string;
      status?: string;
      startsAt?: string | null;
      endsAt?: string | null;
      notes?: string | null;
    };

    const data: {
      name?: string;
      status?: string;
      startsAt?: Date | null;
      endsAt?: Date | null;
      notes?: string | null;
    } = {};

    if (body.name?.trim()) data.name = body.name.trim();
    if (
      body.status === 'preparation' ||
      body.status === 'running' ||
      body.status === 'finished' ||
      body.status === 'archived'
    ) {
      data.status = body.status;
    }
    if (body.startsAt !== undefined) {
      data.startsAt = body.startsAt ? new Date(body.startsAt) : null;
    }
    if (body.endsAt !== undefined) {
      data.endsAt = body.endsAt ? new Date(body.endsAt) : null;
    }
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

    const edition = await getForgeDb().forgeCourseEdition.update({
      where: { id: editionId },
      data,
    });

    return NextResponse.json({
      edition: {
        id: edition.id,
        name: edition.name,
        status: edition.status,
        startsAt: edition.startsAt?.toISOString() ?? null,
        endsAt: edition.endsAt?.toISOString() ?? null,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
