import type { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { buildExpedicionLiveConfig } from '../lib/forge/expedicion-live';
import { EXPEDICION_PRESENTATION_SLIDES } from '../lib/forge/expedicion-presentacion-slides';

export type ExpedicionV2E2ESeed = {
  facilitatorEmail: string;
  learnerEmail: string;
  password: string;
  courseId: string;
  courseTitle: string;
  playGroupId: string;
  gameActivityId: string;
  companyId: string;
};

/** Curso mínimo La Expedición V2 para Playwright. */
export async function seedExpedicionV2E2E(
  db: PrismaClient,
  stamp: number,
  passwordHash: string
): Promise<ExpedicionV2E2ESeed> {
  const password = 'E2eTest123!';
  const company = await db.company.create({
    data: { name: `E2E Expedición ${stamp}`, shortName: 'E2E-EXP', color: '#1B5E4B' },
  });

  const facilitatorEmail = `e2e-exp-fac-${stamp}@etholys.test`;
  const learnerEmail = `e2e-exp-learner-${stamp}@etholys.test`;

  const facilitator = await db.user.create({
    data: { email: facilitatorEmail, name: 'E2E Facilitador EXP', password: passwordHash, isActive: true },
  });
  const learner = await db.user.create({
    data: { email: learnerEmail, name: 'E2E Alumno EXP', password: passwordHash, isActive: true },
  });

  await db.companyUser.create({
    data: { userId: facilitator.id, companyId: company.id, role: 'ADMIN', isDefault: true },
  });

  const liveConfig = {
    ...buildExpedicionLiveConfig({
      companyId: company.id,
      companyName: company.name,
      shortName: company.shortName ?? 'E2E',
    }),
    sessionFormat: 'presencial' as const,
    videoEnabled: false,
  };

  const gameSpec = await db.forgeGameSpec.create({
    data: {
      companyId: company.id,
      engine: 'board',
      title: 'E2E Expedición — 20 casillas',
      status: 'published',
      definition: {
        schemaVersion: 1,
        engine: 'board',
        expedicionV2: true,
        locale: 'es',
        title: 'La Expedición Sostenible — E2E',
        learningObjectives: ['Validar sala V2'],
        board: { spaces: 20, loops: true, startSpace: 0, goalSpace: 19 },
        cards: [
          {
            id: 'e2e-c1',
            type: 'challenge',
            prompt: 'Describe tu propósito sostenible en una frase.',
          },
        ],
        rules: { minInsights: 1, maxTurns: 30 },
      },
    },
  });

  const courseTitle = `E2E La Expedición V2 ${stamp}`;
  const course = await db.forgeCourse.create({
    data: {
      companyId: company.id,
      title: courseTitle,
      status: 'published',
      deliveryMode: 'live',
      gamePlayMode: 'shared_live',
      presentationSlides: EXPEDICION_PRESENTATION_SLIDES as object,
      liveConfig,
      createdById: facilitator.id,
      modules: {
        create: [
          {
            title: 'Taller E2E',
            sortOrder: 0,
            activities: {
              create: [
                {
                  type: 'game',
                  title: 'Tablero La Expedición',
                  sortOrder: 0,
                  xpWeight: 1,
                  gameSpecId: gameSpec.id,
                  config: {},
                },
              ],
            },
          },
        ],
      },
    },
    include: { modules: { include: { activities: true } } },
  });

  const gameActivity = course.modules[0]?.activities.find((a) => a.type === 'game');
  if (!gameActivity) throw new Error('E2E seed: actividad game no creada');

  await db.forgeCourseFacilitator.create({
    data: { courseId: course.id, userId: facilitator.id, role: 'lead' },
  });

  const inviteToken = randomBytes(24).toString('base64url');
  const playGroup = await db.forgePlayGroup.create({
    data: {
      courseId: course.id,
      name: `Mesa E2E ${stamp}`,
      mode: 'live_team',
      inviteToken,
      inviteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  await db.forgeEnrollment.createMany({
    data: [
      {
        courseId: course.id,
        userId: facilitator.id,
        status: 'active',
        playGroupId: playGroup.id,
      },
      {
        courseId: course.id,
        userId: learner.id,
        status: 'active',
        accessScope: 'course_only',
        playGroupId: playGroup.id,
        invitedById: facilitator.id,
      },
    ],
  });

  await db.forgeLearnerProfile.create({
    data: { courseId: course.id, userId: learner.id },
  });

  return {
    facilitatorEmail,
    learnerEmail,
    password,
    courseId: course.id,
    courseTitle,
    playGroupId: playGroup.id,
    gameActivityId: gameActivity.id,
    companyId: company.id,
  };
}
