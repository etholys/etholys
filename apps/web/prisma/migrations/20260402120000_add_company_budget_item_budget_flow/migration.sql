-- Planificación ATLAS: gasto vs ingreso planificado por ítem (no-op se BD ainda não tem ATLAS)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'CompanyBudgetItem'
  ) THEN
    ALTER TABLE "CompanyBudgetItem" ADD COLUMN IF NOT EXISTS "budgetFlow" TEXT NOT NULL DEFAULT 'EXPENSE';
  END IF;
END $$;
