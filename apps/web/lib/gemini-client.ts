import 'server-only';

import { extractFirstJsonObject } from '@/lib/extract-json-object';

/** Gemini Flash — etapas baratas (estruturar JSON). Sem web_search nativo aqui. */
export function hasGeminiApiKey(): boolean {
  return Boolean((process.env.GEMINI_API_KEY || '').trim());
}

export async function geminiCompleteJsonText(
  system: string,
  user: string,
  opts?: { maxOutputTokens?: number; model?: string },
): Promise<string> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY em falta');

  const candidates = [
    opts?.model,
    process.env.GEMINI_MODEL,
    'gemini-3.8-flash',
    'gemini-2.5-flash',
    'gemini-flash-latest',
  ]
    .map((m) => (m || '').trim().replace(/^models\//, ''))
    .filter(Boolean);
  const models = [...new Set(candidates)];

  // Gemini 3.x may spend a large share of maxOutputTokens on "thoughts"; keep a floor.
  const maxOut = Math.min(Math.max(opts?.maxOutputTokens ?? 8192, 1024), 65536);
  let lastErr: Error | null = null;

  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: maxOut,
              responseMimeType: 'application/json',
            },
          }),
          signal: AbortSignal.timeout(120_000),
        },
      );
      const raw = await res.text();
      if (!res.ok) {
        lastErr = new Error(`Gemini ${res.status}: ${raw.slice(0, 240)}`);
        continue;
      }
      const data = JSON.parse(raw) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = (data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '').trim();
      if (!text) {
        lastErr = new Error(`Gemini empty (${model})`);
        continue;
      }
      return extractFirstJsonObject(text) ?? text;
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastErr ?? new Error('Gemini unavailable');
}
