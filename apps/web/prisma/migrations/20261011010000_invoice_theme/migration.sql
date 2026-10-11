-- Per-company invoice PDF theme + richer recipient block on invoices
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "invoiceThemeJson" JSONB;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "contactAddress" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "contactExtra" TEXT;
