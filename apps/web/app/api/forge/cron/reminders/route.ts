export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { notifyInactiveLearners } from '@/lib/forge/notify-learners';

/**
 * Recordatorios automáticos (cron externo o manual).
 * Header: Authorization: Bearer {FORGE_CRON_SECRET}
 */
export async function POST(req: NextRequest) {
  const secret = process.env.FORGE_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'FORGE_CRON_SECRET no configurado' }, { status: 503 });
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const published = await getForgeDb().forgeCourse.findMany({
    where: { status: 'published' },
    select: { id: true, title: true },
  });

  let total = 0;
  const perCourse: { courseId: string; count: number }[] = [];

  for (const c of published) {
    const results = await notifyInactiveLearners(c.id, c.title, 7);
    if (results.length > 0) {
      perCourse.push({ courseId: c.id, count: results.length });
      total += results.length;
    }
  }

  return NextResponse.json({ ok: true, total, perCourse });
}
