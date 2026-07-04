export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { collectEditionAttention, listEditionSummaries } from '@/lib/forge/course-editions';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id: courseId } = await ctx.params;
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

    const editions = await listEditionSummaries(courseId);
    const attention = await collectEditionAttention(courseId, editions);

    return NextResponse.json({ editions, attention });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    const { id: courseId } = await ctx.params;
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

    const body = (await req.json()) as {
      name?: string;
      status?: string;
      startsAt?: string | null;
      endsAt?: string | null;
      notes?: string | null;
    };
    const name = body.name?.trim();
    if (!name) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

    const status =
      body.status === 'running' ||
      body.status === 'finished' ||
      body.status === 'archived' ||
      body.status === 'preparation'
        ? body.status
        : 'preparation';

    const startsAt = body.startsAt ? new Date(body.startsAt) : null;
    const endsAt = body.endsAt ? new Date(body.endsAt) : null;
    if (startsAt && Number.isNaN(startsAt.getTime())) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
    }
    if (endsAt && Number.isNaN(endsAt.getTime())) {
      return NextResponse.json({ error: 'Fecha inválida' }, { status: 400 });
    }

    const edition = await getForgeDb().forgeCourseEdition.create({
      data: {
        courseId,
        name,
        status,
        startsAt,
        endsAt,
        notes: body.notes?.trim() || null,
      },
    });

    return NextResponse.json(
      {
        edition: {
          id: edition.id,
          name: edition.name,
          status: edition.status,
          startsAt: edition.startsAt?.toISOString() ?? null,
          endsAt: edition.endsAt?.toISOString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
