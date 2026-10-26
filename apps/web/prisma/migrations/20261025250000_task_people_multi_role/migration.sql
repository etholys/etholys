-- Multi-pessoa por papel (executor / responsável / revisor-supervisor).
-- roleMemberIds Json funciona mesmo antes/sem TaskPerson; join é complementar.
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "roleMemberIds" JSONB;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskPersonRole') THEN
    CREATE TYPE "TaskPersonRole" AS ENUM ('EXECUTOR', 'RESPONSIBLE', 'REVIEWER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "TaskPerson" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TaskPersonRole" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskPerson_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TaskPerson_taskId_userId_role_key" ON "TaskPerson"("taskId", "userId", "role");
CREATE INDEX IF NOT EXISTS "TaskPerson_userId_role_idx" ON "TaskPerson"("userId", "role");
CREATE INDEX IF NOT EXISTS "TaskPerson_taskId_role_idx" ON "TaskPerson"("taskId", "role");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskPerson_taskId_fkey'
  ) THEN
    ALTER TABLE "TaskPerson"
      ADD CONSTRAINT "TaskPerson_taskId_fkey"
      FOREIGN KEY ("taskId") REFERENCES "Task"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskPerson_userId_fkey'
  ) THEN
    ALTER TABLE "TaskPerson"
      ADD CONSTRAINT "TaskPerson_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Migrar IDs legados → TaskPerson (sem perda).
INSERT INTO "TaskPerson" ("id", "taskId", "userId", "role", "sortOrder", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || t.id || t."assigneeId"),
  t.id,
  t."assigneeId",
  'EXECUTOR'::"TaskPersonRole",
  0,
  COALESCE(t."createdAt", CURRENT_TIMESTAMP)
FROM "Task" t
WHERE t."assigneeId" IS NOT NULL
ON CONFLICT ("taskId", "userId", "role") DO NOTHING;

INSERT INTO "TaskPerson" ("id", "taskId", "userId", "role", "sortOrder", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || t.id || collab.uid),
  t.id,
  collab.uid,
  'EXECUTOR'::"TaskPersonRole",
  1 + collab.ord,
  COALESCE(t."createdAt", CURRENT_TIMESTAMP)
FROM "Task" t
CROSS JOIN LATERAL (
  SELECT elem::text AS uid, (ord - 1) AS ord
  FROM jsonb_array_elements_text(
    CASE
      WHEN t."collaboratorIds" IS NULL THEN '[]'::jsonb
      WHEN jsonb_typeof(t."collaboratorIds"::jsonb) = 'array' THEN t."collaboratorIds"::jsonb
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS x(elem, ord)
) collab
WHERE collab.uid IS NOT NULL
  AND collab.uid <> ''
  AND (t."assigneeId" IS NULL OR collab.uid <> t."assigneeId")
ON CONFLICT ("taskId", "userId", "role") DO NOTHING;

INSERT INTO "TaskPerson" ("id", "taskId", "userId", "role", "sortOrder", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || t.id || t."responsibleId"),
  t.id,
  t."responsibleId",
  'RESPONSIBLE'::"TaskPersonRole",
  0,
  COALESCE(t."createdAt", CURRENT_TIMESTAMP)
FROM "Task" t
WHERE t."responsibleId" IS NOT NULL
ON CONFLICT ("taskId", "userId", "role") DO NOTHING;

INSERT INTO "TaskPerson" ("id", "taskId", "userId", "role", "sortOrder", "createdAt")
SELECT
  md5(random()::text || clock_timestamp()::text || t.id || t."reviewerId"),
  t.id,
  t."reviewerId",
  'REVIEWER'::"TaskPersonRole",
  0,
  COALESCE(t."createdAt", CURRENT_TIMESTAMP)
FROM "Task" t
WHERE t."reviewerId" IS NOT NULL
ON CONFLICT ("taskId", "userId", "role") DO NOTHING;

-- Espelhar multi em roleMemberIds (fonte fiável para API/UI mesmo sem join).
UPDATE "Task" t
SET "roleMemberIds" = COALESCE(
  (
    SELECT jsonb_build_object(
      'executor', COALESCE(
        (
          SELECT jsonb_agg(p."userId" ORDER BY p."sortOrder")
          FROM "TaskPerson" p
          WHERE p."taskId" = t.id AND p.role = 'EXECUTOR'
        ),
        '[]'::jsonb
      ),
      'responsible', COALESCE(
        (
          SELECT jsonb_agg(p."userId" ORDER BY p."sortOrder")
          FROM "TaskPerson" p
          WHERE p."taskId" = t.id AND p.role = 'RESPONSIBLE'
        ),
        '[]'::jsonb
      ),
      'reviewer', COALESCE(
        (
          SELECT jsonb_agg(p."userId" ORDER BY p."sortOrder")
          FROM "TaskPerson" p
          WHERE p."taskId" = t.id AND p.role = 'REVIEWER'
        ),
        '[]'::jsonb
      )
    )
  ),
  '{}'::jsonb
)
WHERE t."roleMemberIds" IS NULL;
