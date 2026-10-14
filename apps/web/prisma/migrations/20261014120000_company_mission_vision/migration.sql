-- Missão e visão no registo da empresa (administração Etholys + espelho FundHub).
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "mission" TEXT;
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "vision" TEXT;
