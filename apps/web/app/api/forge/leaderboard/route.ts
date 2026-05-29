export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { requireForgeTenant, resolveForgeCompanyId } from '@/lib/forge/tenant';

export async function GET(req: NextRequest) {
  try {
    const tenant = await requireForgeTenant();
    if (!tenant) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

    const companyId = resolveForgeCompanyId(tenant, req.nextUrl.searchParams.get('companyId'));
    const courseId = req.nextUrl.searchParams.get('courseId');
    if (!companyId) return NextResponse.json({ error: 'Sem empresa' }, { status: 400 });

    const profiles = await getForgeDb().forgeLearnerProfile.findMany({
      where: {
        course: {
          companyId,
          ...(courseId ? { id: courseId } : {}),
        },
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        course: { select: { id: true, title: true, coverEmoji: true } },
      },
      orderBy: { xp: 'desc' },
      take: 25,
    });

    return NextResponse.json({
      leaderboard: profiles.map((p, i) => ({
        rank: i + 1,
        userId: p.userId,
        name: p.user.name,
        avatar: p.user.avatar,
        courseId: p.courseId,
        courseTitle: p.course.title,
        coverEmoji: p.course.coverEmoji,
        xp: p.xp,
        level: p.level,
        badges: p.badges,
        isYou: p.userId === tenant.userId,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro' }, { status: 500 });
  }
}
