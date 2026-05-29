export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getForgeDb } from '@/lib/forge/db';
import { ensureLearnerJourney } from '@/lib/forge/learner-journey';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Inicia sesión para aceptar la invitación' }, { status: 401 });
  }

  const body = (await req.json()) as { token?: string };
  const token = body.token?.trim();
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

  const email = session.user.email.toLowerCase();
  const user = await getForgeDb().user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  const enrollment = await getForgeDb().forgeEnrollment.findFirst({
    where: { inviteToken: token },
    include: { course: { select: { id: true, title: true } } },
  });

  if (!enrollment) {
    return NextResponse.json({ error: 'Invitación no válida' }, { status: 404 });
  }

  if (enrollment.inviteExpiresAt && enrollment.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: 'Invitación expirada' }, { status: 410 });
  }

  if (enrollment.userId !== user.id) {
    return NextResponse.json(
      { error: 'Esta invitación es para otro email. Usa la cuenta correcta.' },
      { status: 403 }
    );
  }

  await getForgeDb().forgeEnrollment.update({
    where: { id: enrollment.id },
    data: {
      status: 'active',
      inviteToken: null,
      inviteExpiresAt: null,
    },
  });

  await ensureLearnerJourney(enrollment.courseId, user.id);

  return NextResponse.json({
    ok: true,
    courseId: enrollment.course.id,
    courseTitle: enrollment.course.title,
    redirect: `/hub/forge/cursos/${enrollment.course.id}`,
  });
}
