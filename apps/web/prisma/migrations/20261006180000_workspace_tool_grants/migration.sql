-- Etholys Tools per-user grants (alongside systems on IntegratedWorkspaceAccess)
ALTER TABLE "IntegratedWorkspaceAccess" ADD COLUMN IF NOT EXISTS "tools" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Invitation payload may include tools
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "tools" JSONB;

-- Grandfather existing enabled grants: keep Studio/Work (and Advisor/Chorus) usable until admins re-save
UPDATE "IntegratedWorkspaceAccess"
SET "tools" = '["ADVISOR","STUDIO","WORK","CHORUS"]'::jsonb
WHERE "enabled" = true
  AND (
    "tools" IS NULL
    OR "tools"::text = '[]'
    OR "tools"::text = 'null'
  );
