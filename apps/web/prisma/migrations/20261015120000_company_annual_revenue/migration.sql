-- Faturamento anual da empresa. Não faz parte do perfil FundHub visível à equipa.
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "annualRevenueJson" JSONB;
