export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companyId = resolveForgeCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const [courses, enrollments, gameSessions, certs] = await Promise.all([
      getForgeDb().forgeCourse.count({ where: { companyId, status: 'published' } }),
      getForgeDb().forgeEnrollment.count({
        where: { course: { companyId }, status: 'active' },
      }),
      getForgeDb().forgeGameSession.count({
        where: { activity: { module: { course: { companyId } } }, status: 'completed' },
      }),
      getForgeDb().forgeEnrollment.count({
        where: { course: { companyId }, status: 'completed' },
      }),
    ]);

    return NextResponse.json({
      companyId,
      stats: {
        publishedCourses: courses,
        activeEnrollments: enrollments,
        completedGameSessions: gameSessions,
        completedEnrollments: certs,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    const status =
      msg.includes('findMany') || msg.includes('forgeCourse') || msg.includes('Forge')
        ? 503
        : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
