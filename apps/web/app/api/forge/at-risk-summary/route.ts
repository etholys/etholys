export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getCourseAnalytics } from '@/lib/forge/course-analytics';
import { getForgeDb } from '@/lib/forge/db';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const companyId = resolveForgeCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const courses = await getForgeDb().forgeCourse.findMany({
      where: { companyId, status: 'published' },
      select: { id: true, title: true },
      take: 20,
    });

    const items: { courseId: string; title: string; count: number }[] = [];
    let total = 0;

    for (const c of courses) {
      const analytics = await getCourseAnalytics(c.id);
      if (analytics.atRisk.length > 0) {
        items.push({ courseId: c.id, title: c.title, count: analytics.atRisk.length });
        total += analytics.atRisk.length;
      }
    }

    return NextResponse.json({ total, items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
