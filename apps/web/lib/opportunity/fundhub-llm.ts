import 'server-only';

import { geminiCompleteJsonText, hasGeminiApiKey } from '@/lib/gemini-client';
import { llmCompleteJsonText } from '@/lib/llm-client';

/**
 * Custo da varredura FundHub.
 * Scout (web_search) = Sonnet. Estrutura JSON = Gemini Flash se disponível, senão Haiku.
 * Fable só com FUNDHUB_USE_FABLE=1.
 */
export const FUNDHUB_DISCOVERY_MODEL = 'claude-sonnet-4-6';
export const FUNDHUB_STRUCTURE_MODEL = 'claude-haiku-4-5';
export const FUNDHUB_SCAN_FALLBACK_MODEL = 'claude-sonnet-4-6';
export const FUNDHUB_PREMIUM_MODEL = 'claude-fable-5-1';

export function fundhubScoutModel(): string {
  const wantFable = process.env.FUNDHUB_USE_FABLE?.trim() === '1';
  return wantFable ? FUNDHUB_PREMIUM_MODEL : FUNDHUB_DISCOVERY_MODEL;
}

/** Estruturar candidatos: Gemini (barato) → Haiku → Sonnet. */
export async function fundhubStructureJsonText(
  system: string,
  user: string,
  opts?: { maxOutputTokens?: number; allowTruncated?: boolean },
): Promise<{ text: string; via: 'gemini' | 'haiku' | 'sonnet' }> {
  const maxOutputTokens = opts?.maxOutputTokens ?? 16000;

  if (hasGeminiApiKey() && process.env.FUNDHUB_STRUCTURE_GEMINI !== '0') {
    try {
      const text = await geminiCompleteJsonText(system, user, { maxOutputTokens });
      return { text, via: 'gemini' };
    } catch (e) {
      console.warn('[fundhub] Gemini structure failed, falling back to Claude:', e);
    }
  }

  try {
    const text = await llmCompleteJsonText(system, user, {
      maxOutputTokens,
      model: FUNDHUB_STRUCTURE_MODEL,
      allowTruncated: opts?.allowTruncated,
    });
    return { text, via: 'haiku' };
  } catch (e) {
    console.warn('[fundhub] Haiku structure failed, Sonnet fallback:', e);
    const text = await llmCompleteJsonText(system, user, {
      maxOutputTokens,
      model: FUNDHUB_DISCOVERY_MODEL,
      allowTruncated: opts?.allowTruncated,
    });
    return { text, via: 'sonnet' };
  }
}
