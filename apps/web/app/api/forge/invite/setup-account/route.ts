export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getForgeDb } from '@/lib/forge/db';
import { findEnrollmentByMagicToken } from '@/lib/forge/invite-auth';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { token?: string; password?: string };
  const token = body.token?.trim();
  const password = body.password ?? '';
  if (!token || password.length < 8) {
    return NextResponse.json({ error: 'Token y contraseña (mín. 8) requeridos' }, { status: 400 });
  }

  const enrollment = await findEnrollmentByMagicToken(token);
  if (!enrollment) {
    return NextResponse.json({ error: 'Invitación no válida o expirada' }, { status: 404 });
  }

  const hash = await bcrypt.hash(password, 10);
  await getForgeDb().user.update({
    where: { id: enrollment.userId },
    data: { password: hash },
  });

  await getForgeDb().forgeEnrollment.update({
    where: { id: enrollment.id },
    data: {
      passwordSetAt: new Date(),
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  return NextResponse.json({
    ok: true,
    email: enrollment.user.email,
    courseId: enrollment.courseId,
    redirect: `/hub/forge/cursos/${enrollment.courseId}`,
  });
}
