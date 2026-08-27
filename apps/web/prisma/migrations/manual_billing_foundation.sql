-- Billing foundation (additive) — company entitlements antes de Stripe/checkout
CREATE TABLE IF NOT EXISTS "BillingPlan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "systems" JSONB NOT NULL DEFAULT '[]',
  "maxSeats" INTEGER,
  "stripePriceId" TEXT,
  "interval" TEXT NOT NULL DEFAULT 'MONTH',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPlan_code_key" ON "BillingPlan"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPlan_stripePriceId_key" ON "BillingPlan"("stripePriceId");

CREATE TABLE IF NOT EXISTS "CompanyBillingAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "stripeCustomerId" TEXT,
  "billingEmail" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyBillingAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyBillingAccount_companyId_key" ON "CompanyBillingAccount"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyBillingAccount_stripeCustomerId_key" ON "CompanyBillingAccount"("stripeCustomerId");

CREATE TABLE IF NOT EXISTS "CompanySubscription" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "planId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'INCOMPLETE',
  "licensedSystems" JSONB NOT NULL DEFAULT '[]',
  "maxSeats" INTEGER,
  "stripeSubscriptionId" TEXT,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "trialEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanySubscription_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanySubscription_stripeSubscriptionId_key" ON "CompanySubscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "CompanySubscription_companyId_status_idx" ON "CompanySubscription"("companyId", "status");

DO $$ BEGIN
  ALTER TABLE "CompanyBillingAccount" ADD CONSTRAINT "CompanyBillingAccount_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CompanySubscription" ADD CONSTRAINT "CompanySubscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
