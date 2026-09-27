-- AlterTable
ALTER TABLE "NexusFieldEntry" ALTER COLUMN "authorUserId" DROP NOT NULL;
ALTER TABLE "NexusFieldEntry" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'app';
ALTER TABLE "NexusFieldEntry" ADD COLUMN IF NOT EXISTS "fromPhone" TEXT;

CREATE INDEX IF NOT EXISTS "NexusFieldEntry_channel_createdAt_idx" ON "NexusFieldEntry"("channel", "createdAt");

-- CreateTable
CREATE TABLE IF NOT EXISTS "NexusWhatsappLink" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "displayName" TEXT,
    "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastAlertHash" TEXT,
    "pendingCommandKind" TEXT,
    "pendingCommandAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NexusWhatsappLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NexusWhatsappLink_phoneE164_key" ON "NexusWhatsappLink"("phoneE164");
CREATE INDEX IF NOT EXISTS "NexusWhatsappLink_companyId_idx" ON "NexusWhatsappLink"("companyId");

-- CreateTable
CREATE TABLE IF NOT EXISTS "NexusOpsRule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB,
    "lastCommandAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NexusOpsRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "NexusOpsRule_companyId_kind_key" ON "NexusOpsRule"("companyId", "kind");
CREATE INDEX IF NOT EXISTS "NexusOpsRule_companyId_idx" ON "NexusOpsRule"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NexusWhatsappLink_companyId_fkey'
  ) THEN
    ALTER TABLE "NexusWhatsappLink"
      ADD CONSTRAINT "NexusWhatsappLink_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NexusOpsRule_companyId_fkey'
  ) THEN
    ALTER TABLE "NexusOpsRule"
      ADD CONSTRAINT "NexusOpsRule_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
