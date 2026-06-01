export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { ensureLearnerJourney } from '@/lib/forge/learner-journey';
import { forgeCourseEntryPath } from '@/lib/forge/course-entry-path';
import { generateMagicLoginToken, magicLoginExpiresAt } from '@/lib/forge/invite-auth';

/** Unirse a un grupo/empresa con el enlace compartido (varios jugadores, un tablero). */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { token?: string; email?: string; name?: string };
  const token = body.token?.trim();
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  if (!token || !email) {
    return NextResponse.json({ error: 'Token y email requeridos' }, { status: 400 });
  }

  const now = new Date();
  const group = await getForgeDb().forgePlayGroup.findFirst({
    where: {
      inviteToken: token,
      OR: [{ inviteExpiresAt: null }, { inviteExpiresAt: { gt: now } }],
    },
    include: { course: { select: { id: true, title: true, deliveryMode: true } } },
  });
  if (!group) {
    return NextResponse.json({ error: 'Enlace de grupo no válido' }, { status: 404 });
  }

  let user = await getForgeDb().user.findUnique({ where: { email } });
  if (!user) {
    user = await getForgeDb().user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        role: 'user',
        isActive: true,
      },
    });
  }

  const existing = await getForgeDb().forgeEnrollment.findUnique({
    where: { courseId_userId: { courseId: group.courseId, userId: user.id } },
  });

  const magic = generateMagicLoginToken();
  if (existing) {
    await getForgeDb().forgeEnrollment.update({
      where: { id: existing.id },
      data: {
        playGroupId: group.id,
        status: 'active',
        magicLoginToken: magic,
        magicLoginExpiresAt: magicLoginExpiresAt(),
      },
    });
  } else {
    await getForgeDb().forgeEnrollment.create({
      data: {
        courseId: group.courseId,
        userId: user.id,
        status: 'active',
        accessScope: 'course_only',
        playGroupId: group.id,
        magicLoginToken: magic,
        magicLoginExpiresAt: magicLoginExpiresAt(),
      },
    });
  }

  await ensureLearnerJourney(group.courseId, user.id);

  const sala = forgeCourseEntryPath(group.courseId, group.course.deliveryMode);
  const qs = new URLSearchParams({ group: group.id });
  if (group.liveSessionId) qs.set('session', group.liveSessionId);

  return NextResponse.json({
    ok: true,
    courseId: group.courseId,
    playGroupId: group.id,
    redirect: `${sala}?${qs.toString()}`,
    magicLoginToken: magic,
  });
}
