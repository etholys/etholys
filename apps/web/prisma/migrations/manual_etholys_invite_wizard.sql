-- Convite unificado Etholys: tipo de vínculo, cargo, validade de acesso, permissões SIEP empresa
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "inviteKind" TEXT NOT NULL DEFAULT 'employee';
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "accessUntil" TIMESTAMP(3);
ALTER TABLE "Invitation" ADD COLUMN IF NOT EXISTS "companySiepPermissions" JSONB;

ALTER TABLE "CompanyUser" ADD COLUMN IF NOT EXISTS "jobTitle" TEXT;
ALTER TABLE "CompanyUser" ADD COLUMN IF NOT EXISTS "inviteKind" TEXT;
ALTER TABLE "CompanyUser" ADD COLUMN IF NOT EXISTS "accessUntil" TIMESTAMP(3);
