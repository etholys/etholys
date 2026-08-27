-- Billing commerce: add-ons, licenses, platform invoices, commissions
-- Additive on top of manual_billing_foundation.sql

ALTER TABLE "BillingPlan" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'plan';
ALTER TABLE "BillingPlan" ADD COLUMN IF NOT EXISTS "priceCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BillingPlan" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';

ALTER TABLE "CompanySubscription" ADD COLUMN IF NOT EXISTS "interval" TEXT NOT NULL DEFAULT 'MONTH';

CREATE TABLE IF NOT EXISTS "CompanyEntitlement" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "skuCode" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "autoRenew" BOOLEAN NOT NULL DEFAULT true,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "unitPriceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyEntitlement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyEntitlement_companyId_skuCode_key" ON "CompanyEntitlement"("companyId", "skuCode");
CREATE INDEX IF NOT EXISTS "CompanyEntitlement_companyId_status_idx" ON "CompanyEntitlement"("companyId", "status");
CREATE INDEX IF NOT EXISTS "CompanyEntitlement_skuCode_idx" ON "CompanyEntitlement"("skuCode");

CREATE TABLE IF NOT EXISTS "PlatformInvoice" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "subtotalCents" INTEGER NOT NULL DEFAULT 0,
  "taxCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL DEFAULT 0,
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformInvoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformInvoice_companyId_number_key" ON "PlatformInvoice"("companyId", "number");
CREATE INDEX IF NOT EXISTS "PlatformInvoice_companyId_status_idx" ON "PlatformInvoice"("companyId", "status");
CREATE INDEX IF NOT EXISTS "PlatformInvoice_dueDate_idx" ON "PlatformInvoice"("dueDate");

CREATE TABLE IF NOT EXISTS "PlatformInvoiceLine" (
  "id" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "skuCode" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPriceCents" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  CONSTRAINT "PlatformInvoiceLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlatformInvoiceLine_invoiceId_idx" ON "PlatformInvoiceLine"("invoiceId");

CREATE TABLE IF NOT EXISTS "BillingCommissionEvent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "skuCode" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "baseAmountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "rateBps" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACCRUED',
  "invoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingCommissionEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCommissionEvent_source_key"
  ON "BillingCommissionEvent"("companyId", "skuCode", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "BillingCommissionEvent_companyId_status_idx" ON "BillingCommissionEvent"("companyId", "status");

DO $$ BEGIN
  ALTER TABLE "CompanyEntitlement" ADD CONSTRAINT "CompanyEntitlement_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformInvoice" ADD CONSTRAINT "PlatformInvoice_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "PlatformInvoiceLine" ADD CONSTRAINT "PlatformInvoiceLine_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BillingCommissionEvent" ADD CONSTRAINT "BillingCommissionEvent_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "BillingCommissionEvent" ADD CONSTRAINT "BillingCommissionEvent_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "PlatformInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
