export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getCourseProgressPercent } from '@/lib/forge/progress';
import { requireForgeTenant } from '@/lib/forge/tenant';

export async function GET() {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const enrollments = await getForgeDb().forgeEnrollment.findMany({
      where: { userId: tenant.userId },
      include: {
        course: { select: { id: true, title: true, coverEmoji: true, status: true, deliveryMode: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    const courses = await Promise.all(
      enrollments.map(async (e) => ({
        enrollmentId: e.id,
        status: e.status,
        enrolledAt: e.enrolledAt.toISOString(),
        completedAt: e.completedAt?.toISOString() ?? null,
        course: e.course,
        progressPercent: await getCourseProgressPercent(e.courseId, tenant.userId),
      }))
    );

    const user = await getForgeDb().user.findUnique({
      where: { id: tenant.userId },
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json({ user, courses });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
