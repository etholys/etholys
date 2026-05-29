-- FORGE EAD: cursos, módulos, atividades, jogos, gamificação

CREATE TABLE "ForgeProgram" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeCourse" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "programId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "coverEmoji" TEXT NOT NULL DEFAULT '📚',
    "gamification" JSONB,
    "estimatedHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeCourse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeModule" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeModule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeGameSpec" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeGameSpec_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeLearningActivity" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "gameSpecId" TEXT,
    "xpWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeLearningActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeGameSession" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "score" DOUBLE PRECISION,
    "insights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeGameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeEnrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ForgeEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeActivityProgress" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "score" DOUBLE PRECISION,
    "payload" JSONB,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeActivityProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeLearnerProfile" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "badges" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeLearnerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForgeGamificationEvent" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForgeGamificationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ForgeEnrollment_courseId_userId_key" ON "ForgeEnrollment"("courseId", "userId");
CREATE UNIQUE INDEX "ForgeActivityProgress_activityId_userId_key" ON "ForgeActivityProgress"("activityId", "userId");
CREATE UNIQUE INDEX "ForgeLearnerProfile_courseId_userId_key" ON "ForgeLearnerProfile"("courseId", "userId");

CREATE INDEX "ForgeProgram_companyId_idx" ON "ForgeProgram"("companyId");
CREATE INDEX "ForgeCourse_companyId_status_idx" ON "ForgeCourse"("companyId", "status");
CREATE INDEX "ForgeCourse_programId_idx" ON "ForgeCourse"("programId");
CREATE INDEX "ForgeModule_courseId_sortOrder_idx" ON "ForgeModule"("courseId", "sortOrder");
CREATE INDEX "ForgeLearningActivity_moduleId_sortOrder_idx" ON "ForgeLearningActivity"("moduleId", "sortOrder");
CREATE INDEX "ForgeLearningActivity_gameSpecId_idx" ON "ForgeLearningActivity"("gameSpecId");
CREATE INDEX "ForgeGameSpec_companyId_status_idx" ON "ForgeGameSpec"("companyId", "status");
CREATE INDEX "ForgeGameSession_activityId_userId_idx" ON "ForgeGameSession"("activityId", "userId");
CREATE INDEX "ForgeGameSession_userId_status_idx" ON "ForgeGameSession"("userId", "status");
CREATE INDEX "ForgeEnrollment_userId_idx" ON "ForgeEnrollment"("userId");
CREATE INDEX "ForgeActivityProgress_userId_status_idx" ON "ForgeActivityProgress"("userId", "status");
CREATE INDEX "ForgeGamificationEvent_companyId_createdAt_idx" ON "ForgeGamificationEvent"("companyId", "createdAt");
CREATE INDEX "ForgeGamificationEvent_userId_courseId_idx" ON "ForgeGamificationEvent"("userId", "courseId");

ALTER TABLE "ForgeProgram" ADD CONSTRAINT "ForgeProgram_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeCourse" ADD CONSTRAINT "ForgeCourse_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeCourse" ADD CONSTRAINT "ForgeCourse_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ForgeProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ForgeCourse" ADD CONSTRAINT "ForgeCourse_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ForgeModule" ADD CONSTRAINT "ForgeModule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeGameSpec" ADD CONSTRAINT "ForgeGameSpec_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeLearningActivity" ADD CONSTRAINT "ForgeLearningActivity_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "ForgeModule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeLearningActivity" ADD CONSTRAINT "ForgeLearningActivity_gameSpecId_fkey" FOREIGN KEY ("gameSpecId") REFERENCES "ForgeGameSpec"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ForgeGameSession" ADD CONSTRAINT "ForgeGameSession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ForgeLearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeGameSession" ADD CONSTRAINT "ForgeGameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeEnrollment" ADD CONSTRAINT "ForgeEnrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeEnrollment" ADD CONSTRAINT "ForgeEnrollment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeActivityProgress" ADD CONSTRAINT "ForgeActivityProgress_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "ForgeLearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeActivityProgress" ADD CONSTRAINT "ForgeActivityProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeLearnerProfile" ADD CONSTRAINT "ForgeLearnerProfile_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeLearnerProfile" ADD CONSTRAINT "ForgeLearnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeGamificationEvent" ADD CONSTRAINT "ForgeGamificationEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgeGamificationEvent" ADD CONSTRAINT "ForgeGamificationEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
