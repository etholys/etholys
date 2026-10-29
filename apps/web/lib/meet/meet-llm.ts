import 'server-only';

/**
 * Completions JSON para Meet: Anthropic se existir; senão Gemini (mesma chave do STT).
 * Camada B silenciosa — o utilizador não escolhe provider.
 */

import { hasLlmApiKey, llmCompleteJsonText } from '@/lib/llm-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';

export function hasMeetLlmAvailable(): boolean {
  if (hasLlmApiKey()) return true;
  return Boolean((process.env.GEMINI_API_KEY || '').trim());
}

export async function meetCompleteJsonText(
  system: string,
  user: string,
  opts?: { maxOutputTokens?: number },
): Promise<string> {
  if (hasLlmApiKey()) {
    return llmCompleteJsonText(system, user, opts);
  }
  return geminiCompleteJsonText(system, user, opts);
}

async function geminiCompleteJsonText(
  system: string,
  user: string,
  opts?: { maxOutputTokens?: number },
): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('LLM Meet indisponível');

  const model = (
    process.env.MEET_LLM_MODEL ||
    process.env.GEMINI_MODEL ||
    'gemini-3.8-flash'
  )
    .trim()
    .replace(/^models\//, '');

  const maxOut = Math.min(Math.max(opts?.maxOutputTokens ?? 4096, 256), 8192);
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: maxOut,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini Meet LLM ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '')
    .trim();
  if (!text) throw new Error('Gemini Meet LLM vazio');
  return extractFirstJsonObject(text) ?? text;
}
