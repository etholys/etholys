/**
 * Cliente Google Gemini (REST v1beta) — LLM único na aplicação Next.js.
 * @see https://ai.google.dev/gemini-api/docs/models
 */

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/** Limite por defeito alto para JSON grande (importação SIEP, extratos). */
export const DEFAULT_GEMINI_MAX_OUTPUT = 65536;

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key?.trim()) {
    throw new Error('Falta GEMINI_API_KEY ou GOOGLE_GENERATIVE_AI_API_KEY no .env');
  }
  return key.trim();
}

export function getGeminiModel(): string {
  return (process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL).trim();
}

function clampMaxTokens(n: number): number {
  return Math.min(Math.max(n, 256), 65536);
}

export function getGeminiMaxOutputTokens(override?: number): number {
  const fromEnv = parseInt(process.env.GEMINI_MAX_OUTPUT_TOKENS || '', 10);
  const base = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_GEMINI_MAX_OUTPUT;
  return clampMaxTokens(override ?? base);
}

export type GeminiPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};

export type GeminiGenerateOptions = {
  systemInstruction: string;
  userText?: string;
  userParts?: GeminiPart[];
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: 'application/json' | 'text/plain';
};

export type GeminiGenerateResult = {
  text: string;
  finishReason?: string;
};

export async function geminiGenerateContent(opts: GeminiGenerateOptions): Promise<GeminiGenerateResult> {
  const key = getGeminiApiKey();
  const model = getGeminiModel();
  const maxOut = clampMaxTokens(opts.maxOutputTokens ?? getGeminiMaxOutputTokens());

  let parts: GeminiPart[];
  if (opts.userParts?.length) {
    parts = opts.userParts;
  } else {
    parts = [{ text: opts.userText ?? '' }];
  }

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: maxOut,
    temperature: opts.temperature ?? 0.1,
  };
  if (opts.responseMimeType) {
    generationConfig.responseMimeType = opts.responseMimeType;
  }

  const url = `${GEMINI_API_ROOT}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.systemInstruction }] },
      contents: [{ role: 'user', parts }],
      generationConfig,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API: ${errText.slice(0, 800)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    error?: { message?: string };
  };

  if (data.error?.message) {
    throw new Error(`Gemini API: ${data.error.message}`);
  }

  const cand = data.candidates?.[0];
  const p = cand?.content?.parts;
  if (!p?.length) {
    const reason = cand?.finishReason || 'sem candidates';
    throw new Error(`Gemini API: resposta vazia (${reason})`);
  }

  const text = p.map((x) => x.text ?? '').join('');
  return { text, finishReason: cand?.finishReason };
}

export async function geminiCompleteText(
  systemInstruction: string,
  userText: string,
  options?: { maxOutputTokens?: number; temperature?: number }
): Promise<string> {
  const { text } = await geminiGenerateContent({
    systemInstruction,
    userText,
    maxOutputTokens: options?.maxOutputTokens ?? 8192,
    temperature: options?.temperature ?? 0.2,
  });
  return text;
}

export async function geminiCompleteJsonText(
  systemInstruction: string,
  userText: string,
  options?: { maxOutputTokens?: number }
): Promise<string> {
  const { text, finishReason } = await geminiGenerateContent({
    systemInstruction,
    userText,
    maxOutputTokens: options?.maxOutputTokens ?? getGeminiMaxOutputTokens(),
    temperature: 0.1,
    responseMimeType: 'application/json',
  });
  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      'Gemini cortou a resposta (limite de saída). Aumente GEMINI_MAX_OUTPUT_TOKENS no .env (até 65536), divida o ficheiro em partes menores, ou reduza linhas no Excel/CSV.'
    );
  }
  return text;
}

export async function geminiCompleteVision(
  systemInstruction: string,
  userText: string,
  imageBase64: string,
  imageMimeType: string,
  options?: { maxOutputTokens?: number }
): Promise<string> {
  const { text, finishReason } = await geminiGenerateContent({
    systemInstruction,
    userParts: [{ text: userText }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }],
    maxOutputTokens: options?.maxOutputTokens ?? getGeminiMaxOutputTokens(),
    temperature: 0.1,
    responseMimeType: 'application/json',
  });
  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      'Gemini cortou a resposta (limite de saída). Aumente GEMINI_MAX_OUTPUT_TOKENS no .env (até 65536) e reinicie o servidor.'
    );
  }
  return text;
}

/** PDF como documento nativo (extratos digitalizados / sem camada de texto útil para pdf-parse). */
export async function geminiCompleteJsonWithPdf(
  systemInstruction: string,
  userText: string,
  pdfBase64: string,
  options?: { maxOutputTokens?: number }
): Promise<string> {
  const { text, finishReason } = await geminiGenerateContent({
    systemInstruction,
    userParts: [{ text: userText }, { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } }],
    maxOutputTokens: options?.maxOutputTokens ?? getGeminiMaxOutputTokens(),
    temperature: 0.1,
    responseMimeType: 'application/json',
  });
  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      'Gemini cortou a resposta (limite de saída). Aumente GEMINI_MAX_OUTPUT_TOKENS no .env (até 65536), ou use um PDF mais curto.'
    );
  }
  return text;
}

/** MIME simples a partir da extensão do ficheiro. */
export function imageMimeFromFilename(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Stream no formato SSE que o MUSE já espera (OpenAI-like).
 * Implementação: gera texto completo e envia em fatias (evita complexidade do stream nativo).
 */
export function geminiStreamAsOpenAICompatibleSSE(systemInstruction: string, userContent: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const text = await geminiCompleteText(systemInstruction, userContent, {
          maxOutputTokens: 8192,
          temperature: 0.2,
        });
        const step = 32;
        for (let i = 0; i < text.length; i += step) {
          const slice = text.slice(i, i + step);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: slice } }] })}\n\n`)
          );
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: `Erro Gemini: ${msg.slice(0, 400)}` } }] })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });
}
