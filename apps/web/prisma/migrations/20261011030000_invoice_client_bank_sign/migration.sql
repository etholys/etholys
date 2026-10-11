ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "invoiceNumberingJson" JSONB;
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "extra" TEXT;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "clientId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "exchangeRateDate" TIMESTAMP(3);
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "exchangeRateSource" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "bankAccountId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "signatureId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "signatureImage" TEXT;

CREATE TABLE IF NOT EXISTS "CompanyBankAccount" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "bankAddress" TEXT,
  "accountLabel" TEXT NOT NULL DEFAULT 'IBAN / Account Number',
  "accountNumber" TEXT,
  "routingLabel" TEXT NOT NULL DEFAULT 'ABA / Routing Number',
  "routingNumber" TEXT,
  "currency" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyBankAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanyInvoiceSignature" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "title" TEXT,
  "companyLine" TEXT,
  "imageUrl" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyInvoiceSignature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CompanyBankAccount_companyId_idx" ON "CompanyBankAccount"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyInvoiceSignature_companyId_idx" ON "CompanyInvoiceSignature"("companyId");

DO $$ BEGIN
  ALTER TABLE "CompanyBankAccount" ADD CONSTRAINT "CompanyBankAccount_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "CompanyInvoiceSignature" ADD CONSTRAINT "CompanyInvoiceSignature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "CompanyInvoiceSignature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
