import 'server-only';

import { hasMeetLlmAvailable } from '@/lib/meet/meet-llm';

/**
 * Camada B (IA) — upgrade silencioso.
 * Anthropic OU Gemini (mesma chave do STT). Depois: créditos da empresa.
 */
export function canUseMeetAiEnhancement(_opts?: { companyId?: string }): boolean {
  return hasMeetLlmAvailable();
}
