/**
 * Cliente Google Gemini (REST v1beta) — LLM único na aplicação Next.js.
 * @see https://ai.google.dev/gemini-api/docs/models
 */

const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Modelos alternativos (Jun 2026). Evitar gemini-2.0-* e gemini-1.5-* — descontinuados na API.
 * @see https://ai.google.dev/gemini-api/docs/changelog
 */
export const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-2.5-pro',
] as const;

export function getGeminiModelCandidates(): string[] {
  const preferred = getGeminiModel();
  const fromEnv = (process.env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = fromEnv.length > 0 ? fromEnv : [...GEMINI_FALLBACK_MODELS];
  const seen = new Set<string>();
  const list: string[] = [];
  for (const m of [preferred, ...pool]) {
    if (!seen.has(m)) {
      seen.add(m);
      list.push(m);
    }
  }
  return list;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableGeminiError(status: number, body: string): boolean {
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  return /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|try again later/i.test(body);
}

function isModelNotFoundError(body: string): boolean {
  return /NOT_FOUND|not found|is not found|is not supported for generateContent|invalid model/i.test(body);
}

function shouldRetrySameModel(status: number, body: string): boolean {
  if (isModelNotFoundError(body)) return false;
  return isRetryableGeminiError(status, body);
}

function shouldTryNextModel(status: number, body: string): boolean {
  if (status === 404) return true;
  return isModelNotFoundError(body) || isRetryableGeminiError(status, body);
}

function isAuthGeminiError(status: number, body: string): boolean {
  if ([401, 403].includes(status)) return true;
  return /API key|PERMISSION_DENIED|invalid.*key/i.test(body);
}

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
  /** Grounding with Google Search — pesquisa web em tempo real. */
  googleSearch?: boolean;
  /** Força um modelo específico (ex.: gemini-2.5-pro para redacção SIEP). */
  model?: string;
};

export type GeminiGenerateResult = {
  text: string;
  finishReason?: string;
  searchQueries?: string[];
};

export async function geminiGenerateContent(opts: GeminiGenerateOptions): Promise<GeminiGenerateResult> {
  const models = opts.model
    ? [opts.model]
    : getGeminiModelCandidates();
  const failures: string[] = [];
  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await geminiGenerateContentWithModel(opts, model);
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        lastError = err;
        if (/API key|PERMISSION_DENIED|invalid.*key/i.test(err.message)) throw err;

        failures.push(err.message.slice(0, 200));

        if (isModelNotFoundError(err.message)) break;

        if (shouldRetrySameModel(0, err.message) && attempt < 2) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  const summary = failures.length
    ? `Modelos tentados: ${models.join(', ')}\n${failures.map((f, i) => `${i + 1}. ${f}`).join('\n')}`
    : `Modelos tentados: ${models.join(', ')}`;

  throw new Error(
    lastError
      ? `Gemini API: todos os modelos falharam.\n${summary}\nÚltimo erro: ${lastError.message.slice(0, 400)}`
      : `Gemini API: falha após tentativas com todos os modelos.\n${summary}`,
  );
}

async function geminiGenerateContentWithModel(
  opts: GeminiGenerateOptions,
  model: string,
): Promise<GeminiGenerateResult> {
  const key = getGeminiApiKey();
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

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.systemInstruction }] },
    contents: [{ role: 'user', parts }],
    generationConfig,
  };
  if (opts.googleSearch) {
    body.tools = [{ google_search: {} }];
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    if (isAuthGeminiError(response.status, errText)) {
      throw new Error(`Gemini API (${model}): ${errText.slice(0, 800)}`);
    }
    if (shouldTryNextModel(response.status, errText)) {
      throw new Error(`Gemini API (${model}): ${errText.slice(0, 800)}`);
    }
    throw new Error(`Gemini API (${model}): ${errText.slice(0, 800)}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
      groundingMetadata?: {
        webSearchQueries?: string[];
        searchEntryPoint?: { renderedContent?: string };
      };
    }>;
    error?: { message?: string; code?: number; status?: string };
  };

  if (data.error?.message) {
    const msg = JSON.stringify(data.error);
    if (isAuthGeminiError(data.error.code ?? 0, msg)) {
      throw new Error(`Gemini API (${model}): ${data.error.message}`);
    }
    throw new Error(`Gemini API (${model}): ${msg.slice(0, 800)}`);
  }

  const cand = data.candidates?.[0];
  const p = cand?.content?.parts;
  if (!p?.length) {
    const reason = cand?.finishReason || 'sem candidates';
    throw new Error(`Gemini API (${model}): resposta vazia (${reason})`);
  }

  const text = p.map((x) => x.text ?? '').join('');
  const searchQueries = cand?.groundingMetadata?.webSearchQueries;
  return { text, finishReason: cand?.finishReason, searchQueries };
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

/** Pesquisa web via Google Search grounding (sem JSON mode). */
export async function geminiCompleteWithWebSearch(
  systemInstruction: string,
  userText: string,
  options?: { maxOutputTokens?: number; temperature?: number },
): Promise<{ text: string; searchQueries: string[] }> {
  const models = getGeminiModelCandidates().filter((m) =>
    /gemini-2\.|gemini-3\./.test(m),
  );
  const pool = models.length > 0 ? models : getGeminiModelCandidates();
  let lastError: Error | null = null;

  for (const model of pool) {
    try {
      const { text, searchQueries } = await geminiGenerateContentWithModel(
        {
          systemInstruction,
          userText,
          maxOutputTokens: options?.maxOutputTokens ?? 16384,
          temperature: options?.temperature ?? 0.2,
          googleSearch: true,
        },
        model,
      );
      return { text, searchQueries: searchQueries ?? [] };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (/API key|PERMISSION_DENIED|invalid.*key/i.test(lastError.message)) throw lastError;
    }
  }

  throw lastError ?? new Error('Gemini web search: todos os modelos falharam');
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
