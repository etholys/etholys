-- ForgeCourseEdition: turma/edição do curso
CREATE TABLE "ForgeCourseEdition" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'preparation',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForgeCourseEdition_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ForgePlayGroup" ADD COLUMN "editionId" TEXT;

CREATE INDEX "ForgeCourseEdition_courseId_status_idx" ON "ForgeCourseEdition"("courseId", "status");
CREATE INDEX "ForgeCourseEdition_courseId_startsAt_idx" ON "ForgeCourseEdition"("courseId", "startsAt");
CREATE INDEX "ForgePlayGroup_editionId_idx" ON "ForgePlayGroup"("editionId");

ALTER TABLE "ForgeCourseEdition" ADD CONSTRAINT "ForgeCourseEdition_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "ForgeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForgePlayGroup" ADD CONSTRAINT "ForgePlayGroup_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "ForgeCourseEdition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
