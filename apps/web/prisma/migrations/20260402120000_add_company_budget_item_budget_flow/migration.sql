-- Planificación ATLAS: gasto vs ingreso planificado por ítem
ALTER TABLE "CompanyBudgetItem" ADD COLUMN IF NOT EXISTS "budgetFlow" TEXT NOT NULL DEFAULT 'EXPENSE';
