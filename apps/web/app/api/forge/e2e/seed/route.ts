export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getForgeDb } from '@/lib/forge/db';
import { generateForgeInviteToken, forgeInviteExpiresAt } from '@/lib/forge/invite-token';
import { generateMagicLoginToken, magicLoginExpiresAt } from '@/lib/forge/invite-auth';

function assertE2e(req: NextRequest): boolean {
  const secret = process.env.FORGE_E2E_SECRET?.trim();
  if (!secret || process.env.NODE_ENV === 'production') return false;
  const auth = req.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

/** Seed data for Playwright — only when FORGE_E2E_SECRET is set and not production. */
export async function POST(req: NextRequest) {
  if (!assertE2e(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
  const body = (await req.json()) as { scenario?: string };
  const db = getForgeDb();
  const stamp = Date.now();

  if (body.scenario === 'multi-org') {
    const password = 'E2eTest123!';
    const hash = await bcrypt.hash(password, 10);
    const email = `e2e-forge-multi-${stamp}@etholys.test`;

    const user = await db.user.create({
      data: { email, name: 'E2E Multi', password: hash, isActive: true },
    });

    const companyA = await db.company.create({
      data: { name: `E2E Org A ${stamp}`, shortName: 'E2E-A', color: '#3b82f6' },
    });
    const companyB = await db.company.create({
      data: { name: `E2E Org B ${stamp}`, shortName: 'E2E-B', color: '#10b981' },
    });

    await db.companyUser.createMany({
      data: [
        { userId: user.id, companyId: companyA.id, role: 'ADMIN', isDefault: true },
        { userId: user.id, companyId: companyB.id, role: 'ADMIN', isDefault: false },
      ],
    });

    const courseA = await db.forgeCourse.create({
      data: {
        companyId: companyA.id,
        title: `Curso A ${stamp}`,
        status: 'published',
        createdById: user.id,
      },
    });
    const courseB = await db.forgeCourse.create({
      data: {
        companyId: companyB.id,
        title: `Curso B ${stamp}`,
        status: 'published',
        createdById: user.id,
      },
    });

    return NextResponse.json({
      email,
      password,
      companyA: companyA.id,
      companyB: companyB.id,
      courseA: { id: courseA.id, title: courseA.title },
      courseB: { id: courseB.id, title: courseB.title },
    });
  }

  // default: invite + magic login
  const password = 'E2eTest123!';
  const hash = await bcrypt.hash(password, 10);
  const email = `e2e-forge-${stamp}@etholys.test`;

  const company = await db.company.create({
    data: { name: `E2E Forge ${stamp}`, shortName: 'E2E', color: '#6366f1' },
  });

  const facilitator = await db.user.create({
    data: {
      email: `e2e-facil-${stamp}@etholys.test`,
      name: 'E2E Facilitator',
      password: hash,
      isActive: true,
    },
  });
  await db.companyUser.create({
    data: { userId: facilitator.id, companyId: company.id, role: 'ADMIN', isDefault: true },
  });

  const learner = await db.user.create({
    data: { email, name: 'E2E Learner', password: hash, isActive: true },
  });

  const course = await db.forgeCourse.create({
    data: {
      companyId: company.id,
      title: `E2E Curso Invitación ${stamp}`,
      status: 'published',
      createdById: facilitator.id,
    },
  });

  const inviteToken = generateForgeInviteToken();
  const magicLoginToken = generateMagicLoginToken();

  await db.forgeEnrollment.create({
    data: {
      courseId: course.id,
      userId: learner.id,
      status: 'active',
      accessScope: 'course_only',
      invitedById: facilitator.id,
      inviteToken,
      inviteExpiresAt: forgeInviteExpiresAt(),
      magicLoginToken,
      magicLoginExpiresAt: magicLoginExpiresAt(),
    },
  });

  await db.forgeLearnerProfile.create({
    data: { courseId: course.id, userId: learner.id },
  });

  const base = process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';

  return NextResponse.json({
    email,
    password,
    inviteToken,
    magicLoginToken,
    courseId: course.id,
    courseTitle: course.title,
    activarUrl: `${base}/hub/forge/activar?token=${inviteToken}`,
    entrarUrl: `${base}/hub/forge/entrar?token=${inviteToken}`,
  });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[forge/e2e/seed]', e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
