export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { forgeCourseInclude } from '@/lib/forge/queries';
import { serializeForgeCourse } from '@/lib/forge/serialize';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import { getForgeCourseAccess } from '@/lib/forge/facilitator-access';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companyId = resolveForgeCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const status = req.nextUrl.searchParams.get('status');
    const courses = await getForgeDb().forgeCourse.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
      },
      include: forgeCourseInclude,
      orderBy: { updatedAt: 'desc' },
    });

    const enrollmentSet = new Set(
      (
        await getForgeDb().forgeEnrollment.findMany({
          where: { userId: tenant.userId, courseId: { in: courses.map((c) => c.id) } },
          select: { courseId: true },
        })
      ).map((e) => e.courseId)
    );

    const canFacilitateCompany = await getForgeCourseAccess(tenant.userId, companyId);

    const visible = courses.filter((c) => {
      if (c.cohortMode !== 'invite_only') return true;
      if (canFacilitateCompany.canFacilitate) return true;
      return enrollmentSet.has(c.id);
    });

    const withProgress = await Promise.all(
      visible.map(async (c) => {
        const progressPercent = await getCourseProgressPercent(c.id, tenant.userId);
        const profile = await getForgeDb().forgeLearnerProfile.findUnique({
          where: { courseId_userId: { courseId: c.id, userId: tenant.userId } },
        });
        return serializeForgeCourse(c, {
          progressPercent,
          xp: profile?.xp,
          level: profile?.level,
        });
      })
    );

    return NextResponse.json({ companyId, courses: withProgress });
  } catch (e) {
    console.error('[GET /api/forge/courses]', e);
    const msg = e instanceof Error ? e.message : 'Erro';
    const status =
      msg.includes('findMany') || msg.includes('forgeCourse') || msg.includes('Forge')
        ? 503
        : 500;
    const hint =
      status === 503
        ? ' Abra /api/forge/health e execute: cd apps/web && npm run dev:clean'
        : '';
    return NextResponse.json({ error: msg + hint }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const body = (await req.json()) as {
      companyId?: string;
      title?: string;
      description?: string;
      status?: string;
      coverEmoji?: string;
    };

    const companyId = resolveForgeCompanyId(tenant, body.companyId ?? null);
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (!title) return NextResponse.json({ error: 'title é obrigatório' }, { status: 400 });

    const course = await getForgeDb().forgeCourse.create({
      data: {
        companyId,
        createdById: tenant.userId,
        title: title.slice(0, 300),
        description: typeof body.description === 'string' ? body.description.slice(0, 5000) : null,
        status: body.status === 'published' ? 'published' : 'draft',
        coverEmoji: typeof body.coverEmoji === 'string' ? body.coverEmoji.slice(0, 8) : '📚',
        cohortMode: 'invite_only',
      },
      include: forgeCourseInclude,
    });

    return NextResponse.json({ course: serializeForgeCourse(course) });
  } catch (e) {
    console.error('[POST /api/forge/courses]', e);
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
