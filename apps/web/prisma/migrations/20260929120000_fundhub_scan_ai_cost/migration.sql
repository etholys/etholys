-- FundHub: custo IA por varredura (system admin / rentabilidade)
ALTER TABLE "FundhubDiscoveryRun" ADD COLUMN IF NOT EXISTS "estimatedCostUsd" DOUBLE PRECISION;
ALTER TABLE "FundhubDiscoveryRun" ADD COLUMN IF NOT EXISTS "inputTokens" INTEGER;
ALTER TABLE "FundhubDiscoveryRun" ADD COLUMN IF NOT EXISTS "outputTokens" INTEGER;
ALTER TABLE "FundhubDiscoveryRun" ADD COLUMN IF NOT EXISTS "webSearchRequests" INTEGER;
ALTER TABLE "FundhubDiscoveryRun" ADD COLUMN IF NOT EXISTS "llmCalls" INTEGER;
CREATE INDEX IF NOT EXISTS "FundhubDiscoveryRun_startedAt_idx" ON "FundhubDiscoveryRun"("startedAt");
