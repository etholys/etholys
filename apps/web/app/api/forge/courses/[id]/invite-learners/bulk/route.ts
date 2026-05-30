export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { parseBulkInviteInput } from '@/lib/forge/bulk-invite';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { parseForgeEmailLocale } from '@/lib/forge/email-templates';
import { inviteOneLearner } from '@/lib/forge/invite-learner-core';
import { loadCourseForTenant, requireForgeTenant } from '@/lib/forge/tenant';

type Ctx = { params: Promise<{ id: string }> };

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

    const body = (await req.json()) as { csv?: string; locale?: string };
    const locale = parseForgeEmailLocale(body.locale);
    const rows = parseBulkInviteInput(body.csv ?? '');
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV vacío (email por línea)' }, { status: 400 });
    }

    const inviter = await getForgeDb().user.findUnique({
      where: { id: tenant.userId },
      select: { name: true },
    });

    const results: Awaited<ReturnType<typeof inviteOneLearner>>[] = [];
    for (const row of rows) {
      results.push(
        await inviteOneLearner({
          courseId,
          courseTitle: course.title,
          email: row.email,
          name: row.name,
          invitedById: tenant.userId,
          inviterName: inviter?.name,
          locale,
        })
      );
    }

    return NextResponse.json({
      total: results.length,
      ok: results.filter((r) => r.ok).length,
      results: rows.map((r, i) => ({ email: r.email, ...results[i] })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
