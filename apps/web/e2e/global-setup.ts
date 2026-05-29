import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { generateForgeInviteToken, forgeInviteExpiresAt } from '../lib/forge/invite-token';

function generateMagicLoginToken(): string {
  return randomBytes(32).toString('base64url');
}

function magicLoginExpiresAt(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 48);
  return d;
}

const OUT = path.join(__dirname, '.seed-state.json');

export default async function globalSetup() {
  execSync('npx prisma generate', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

  const db = new PrismaClient();
  try {
    await db.$connect();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      '\n[E2E FORGE] Não foi possível ligar ao Postgres.\n' +
        '  1) Abra o Docker Desktop (Engine running)\n' +
        '  2) cd infra && docker compose up -d postgres\n' +
        '  3) Confirme DATABASE_URL em apps/web/.env (porta 5433)\n' +
        `  Erro: ${msg}\n`
    );
    throw e;
  }

  const stamp = Date.now();
  const password = 'E2eTest123!';
  const hash = await bcrypt.hash(password, 10);

  try {
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

    const pwdLearner = await db.user.create({
      data: {
        email: `e2e-forge-pwd-${stamp}@etholys.test`,
        name: 'E2E Learner Pwd',
        password: hash,
        isActive: true,
      },
    });
    const inviteTokenPassword = generateForgeInviteToken();
    await db.forgeEnrollment.create({
      data: {
        courseId: course.id,
        userId: pwdLearner.id,
        status: 'active',
        accessScope: 'course_only',
        invitedById: facilitator.id,
        inviteToken: inviteTokenPassword,
        inviteExpiresAt: forgeInviteExpiresAt(),
        magicLoginToken: generateMagicLoginToken(),
        magicLoginExpiresAt: magicLoginExpiresAt(),
      },
    });
    await db.forgeLearnerProfile.create({
      data: { courseId: course.id, userId: pwdLearner.id },
    });

    const multiEmail = `e2e-forge-multi-${stamp}@etholys.test`;
    const multiUser = await db.user.create({
      data: { email: multiEmail, name: 'E2E Multi', password: hash, isActive: true },
    });
    const companyA = await db.company.create({
      data: { name: `E2E Org A ${stamp}`, shortName: 'E2E-A', color: '#3b82f6' },
    });
    const companyB = await db.company.create({
      data: { name: `E2E Org B ${stamp}`, shortName: 'E2E-B', color: '#10b981' },
    });
    await db.companyUser.createMany({
      data: [
        { userId: multiUser.id, companyId: companyA.id, role: 'ADMIN', isDefault: true },
        { userId: multiUser.id, companyId: companyB.id, role: 'ADMIN', isDefault: false },
      ],
    });
    const courseA = await db.forgeCourse.create({
      data: {
        companyId: companyA.id,
        title: `Curso A ${stamp}`,
        status: 'published',
        createdById: multiUser.id,
      },
    });
    const courseB = await db.forgeCourse.create({
      data: {
        companyId: companyB.id,
        title: `Curso B ${stamp}`,
        status: 'published',
        createdById: multiUser.id,
      },
    });

    fs.writeFileSync(
      OUT,
      JSON.stringify({
        invite: {
          email,
          password,
          inviteToken,
          courseId: course.id,
          courseTitle: course.title,
        },
        invitePassword: {
          email: pwdLearner.email,
          password,
          inviteToken: inviteTokenPassword,
          courseId: course.id,
          courseTitle: course.title,
        },
        multiOrg: {
          email: multiEmail,
          password,
          companyA: companyA.id,
          companyB: companyB.id,
          courseA: { id: courseA.id, title: courseA.title },
          courseB: { id: courseB.id, title: courseB.title },
        },
      })
    );
  } finally {
    await db.$disconnect();
  }
}
