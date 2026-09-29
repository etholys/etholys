-- CreateTable
CREATE TABLE IF NOT EXISTS "RadarSiteLayout" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "layoutJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RadarSiteLayout_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RadarSiteLayout_companyId_key" ON "RadarSiteLayout"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RadarSiteLayout_companyId_fkey'
  ) THEN
    ALTER TABLE "RadarSiteLayout"
      ADD CONSTRAINT "RadarSiteLayout_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
