export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { getCourseAnalytics } from '@/lib/forge/course-analytics';
import { notifyAtRiskLearners, notifyInactiveLearners } from '@/lib/forge/notify-learners';
import { notifyFacilitatorsAtRisk } from '@/lib/forge/notify-facilitators';

export async function POST(req: NextRequest) {
  const secret = process.env.FORGE_CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const courses = await getForgeDb().forgeCourse.findMany({
    where: { status: 'published' },
    select: { id: true, title: true, companyId: true },
  });

  let atRisk = 0;
  let inactive = 0;

  for (const c of courses) {
    const analytics = await getCourseAnalytics(c.id);
    if (analytics.atRisk.length > 0) {
      const r = await notifyAtRiskLearners(c.id, c.title, analytics);
      atRisk += r.length;
      await notifyFacilitatorsAtRisk(c.companyId, c.id, c.title, analytics);
    }
    const inact = await notifyInactiveLearners(c.id, c.title, 7);
    inactive += inact.length;
  }

  return NextResponse.json({ ok: true, courses: courses.length, atRisk, inactive });
}
