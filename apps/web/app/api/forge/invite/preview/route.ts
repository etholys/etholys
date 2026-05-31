export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getForgeDb } from '@/lib/forge/db';
import { maskEmail } from '@/lib/forge/invite-token';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')?.trim();
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

  const now = new Date();
  const enrollment = await getForgeDb().forgeEnrollment.findFirst({
    where: {
      OR: [
        { inviteToken: token, inviteExpiresAt: { gt: now } },
        { inviteToken: token, inviteExpiresAt: null },
        { magicLoginToken: token, magicLoginExpiresAt: { gt: now } },
      ],
    },
    include: {
      course: { select: { id: true, title: true, coverEmoji: true, status: true, deliveryMode: true } },
      user: { select: { email: true } },
    },
  });

  if (!enrollment) {
    return NextResponse.json({ valid: false, error: 'Invitación no válida' }, { status: 404 });
  }

  if (enrollment.inviteExpiresAt && enrollment.inviteExpiresAt < new Date()) {
    return NextResponse.json({ valid: false, error: 'Invitación expirada' }, { status: 410 });
  }

  return NextResponse.json({
    valid: true,
    courseId: enrollment.course.id,
    courseTitle: enrollment.course.title,
    coverEmoji: enrollment.course.coverEmoji,
    emailHint: enrollment.user.email ? maskEmail(enrollment.user.email) : null,
    /** Solo con token válido — para login mágico en /activar */
    loginEmail: enrollment.user.email ?? null,
    deliveryMode: enrollment.course.deliveryMode,
  });
}
