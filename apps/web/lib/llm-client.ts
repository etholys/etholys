/**
 * Cliente LLM — único provider de modelo na aplicação Next.js.
 */

const ANTHROPIC_API_ROOT = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';
/** Evita pedidos pendurados que o proxy fecha com HTML 502. */
const LLM_FETCH_TIMEOUT_MS = Number(process.env.LLM_FETCH_TIMEOUT_MS || 90_000);

/** Modelo por defeito (2026). Sobrescrever com LLM_MODEL / ANTHROPIC_MODEL. */
export const DEFAULT_LLM_MODEL = 'claude-sonnet-4-6';

export const LLM_FALLBACK_MODELS = [
  'claude-sonnet-4-6',
  'claude-haiku-4-5',
  'claude-opus-4-6',
] as const;

export function getLlmModelCandidates(): string[] {
  const preferred = getLlmModel();
  const fromEnv = (process.env.LLM_FALLBACK_MODELS || process.env.ANTHROPIC_FALLBACK_MODELS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const pool = fromEnv.length > 0 ? fromEnv : [...LLM_FALLBACK_MODELS];
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

function isRetryableLlmError(status: number, body: string): boolean {
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  return /overloaded|rate.?limit|try again|temporarily unavailable|capacity/i.test(body);
}

function isModelNotFoundError(body: string): boolean {
  if (/not_found_error/i.test(body) && /model/i.test(body)) return true;
  return /model[:\s].*not found|invalid model|does not exist/i.test(body);
}

function shouldRetrySameModel(status: number, body: string): boolean {
  if (isModelNotFoundError(body)) return false;
  return isRetryableLlmError(status, body);
}

function shouldTryNextModel(status: number, body: string): boolean {
  if (status === 404) return true;
  return isModelNotFoundError(body) || isRetryableLlmError(status, body);
}

function isAuthLlmError(status: number, body: string): boolean {
  if ([401, 403].includes(status)) return true;
  return /authentication_error|invalid.?api.?key|permission/i.test(body);
}

function isBillingLlmError(body: string): boolean {
  return /credit balance|insufficient.?quota|billing|purchase credits|payment required|LLM_BILLING/i.test(
    body,
  );
}

/** Mensagem pública — nunca expor provider, créditos ou consolas internas ao cliente. */
export const PUBLIC_LLM_UNAVAILABLE =
  'O serviço de IA está temporariamente indisponível. Tente novamente mais tarde.';

export type LlmErrorCode = 'billing' | 'auth' | 'unavailable' | 'provider';

/**
 * Erro tipado do cliente LLM. `message` é sempre seguro para UI/API;
 * `providerDetail` fica só para logs de servidor.
 */
export class LlmProviderError extends Error {
  readonly code: LlmErrorCode;
  readonly providerDetail?: string;
  readonly httpStatus?: number;

  constructor(
    code: LlmErrorCode,
    opts?: { providerDetail?: string; httpStatus?: number; message?: string },
  ) {
    super(opts?.message ?? PUBLIC_LLM_UNAVAILABLE);
    this.name = 'LlmProviderError';
    this.code = code;
    this.providerDetail = opts?.providerDetail;
    this.httpStatus = opts?.httpStatus;
  }
}

export function isLlmBillingError(err: unknown): boolean {
  if (err instanceof LlmProviderError) return err.code === 'billing';
  const msg = err instanceof Error ? err.message : String(err);
  return isBillingLlmError(msg);
}

/** Converte qualquer falha LLM numa mensagem segura para o cliente. */
export function publicLlmErrorMessage(err: unknown): string {
  if (err instanceof LlmProviderError) return err.message;
  const msg = err instanceof Error ? err.message : String(err);

  // Mensagens de produto já redigidas (truncamento, etc.)
  if (
    /cortou a resposta|documento mais curto|PDF mais curto|demorou demasiado|não está disponível neste momento/i.test(
      msg,
    )
  ) {
    return msg;
  }

  if (
    isBillingLlmError(msg) ||
    /Anthropic|console\.anthropic|OpenAI|API key|authentication_error|invalid.?api.?key|Modelos tentados|^LLM\s*\(/i.test(
      msg,
    )
  ) {
    return PUBLIC_LLM_UNAVAILABLE;
  }

  // Qualquer outro erro de infraestrutura LLM → genérico
  if (/^LLM[:\s]/i.test(msg) || /serviço de IA/i.test(msg)) {
    return msg.includes('indisponível') ? msg : PUBLIC_LLM_UNAVAILABLE;
  }

  return PUBLIC_LLM_UNAVAILABLE;
}

function logLlmProviderFailure(
  kind: LlmErrorCode,
  model: string,
  status: number,
  body: string,
): void {
  console.error('[llm] provider failure', {
    kind,
    model,
    status,
    detail: body.slice(0, 600),
  });
}

/** Limite alto para JSON grande (importação SIEP, extratos). */
export const DEFAULT_LLM_MAX_OUTPUT = 32000;

export function getLlmApiKey(): string {
  const key =
    process.env.ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY ||
    process.env.LLM_API_KEY;
  if (!key?.trim()) {
    throw new LlmProviderError('auth', {
      message: PUBLIC_LLM_UNAVAILABLE,
      providerDetail: 'missing API key',
    });
  }
  return key.trim();
}

export function hasLlmApiKey(): boolean {
  return Boolean(
    (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || process.env.LLM_API_KEY || '').trim(),
  );
}

export function getLlmModel(): string {
  return (
    process.env.LLM_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    process.env.CLAUDE_MODEL ||
    DEFAULT_LLM_MODEL
  ).trim();
}

function clampMaxTokens(n: number): number {
  return Math.min(Math.max(n, 256), 64000);
}

export function getLlmMaxOutputTokens(override?: number): number {
  const fromEnv = parseInt(
    process.env.LLM_MAX_OUTPUT_TOKENS || process.env.ANTHROPIC_MAX_OUTPUT_TOKENS || '',
    10,
  );
  const base = Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_LLM_MAX_OUTPUT;
  return clampMaxTokens(override ?? base);
}

/** Parte multimodal (texto / imagem / documento). */
export type LlmPart = {
  text?: string;
  inlineData?: { mimeType: string; data: string };
};

export type LlmChatMessage = { role: 'user' | 'assistant'; content: string };

export type LlmGenerateOptions = {
  systemInstruction: string;
  userText?: string;
  userParts?: LlmPart[];
  /** Histórico nativo user/assistant (preferir em chats multi-turno). */
  chatMessages?: LlmChatMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  responseMimeType?: 'application/json' | 'text/plain';
  /** Pesquisa web via tool do provider (web_search). */
  webSearch?: boolean;
  /** Força um modelo específico (ex.: claude-opus-4-6 para redacção SIEP). */
  model?: string;
};

export type LlmGenerateResult = {
  text: string;
  finishReason?: string;
  searchQueries?: string[];
};

type AnthropicContentBlock =
  | { type: 'text'; text: string }
  | {
      type: 'image';
      source: { type: 'base64'; media_type: string; data: string };
    }
  | {
      type: 'document';
      source: { type: 'base64'; media_type: 'application/pdf'; data: string };
    };

function partsToAnthropicContent(parts: LlmPart[]): AnthropicContentBlock[] {
  const out: AnthropicContentBlock[] = [];
  for (const part of parts) {
    if (part.text != null && part.text !== '') {
      out.push({ type: 'text', text: part.text });
      continue;
    }
    const inline = part.inlineData;
    if (!inline?.data) continue;
    const mime = (inline.mimeType || 'application/octet-stream').toLowerCase();
    if (mime.startsWith('image/')) {
      out.push({
        type: 'image',
        source: { type: 'base64', media_type: mime, data: inline.data },
      });
      continue;
    }
    if (mime === 'application/pdf') {
      out.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: inline.data },
      });
      continue;
    }
    out.push({
      type: 'text',
      text: `[Anexo binário omitido: tipo ${mime} não suportado nativamente pelo modelo. Preferir PDF, imagem ou texto extraído.]`,
    });
  }
  if (out.length === 0) {
    out.push({ type: 'text', text: '' });
  }
  return out;
}

function stripJsonFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1].trim() : t;
}

function mapStopReason(stop: string | undefined): string | undefined {
  if (!stop) return undefined;
  if (stop === 'max_tokens') return 'MAX_TOKENS';
  return stop;
}

function extractTextAndQueries(data: {
  content?: Array<Record<string, unknown>>;
  stop_reason?: string;
}): { text: string; searchQueries: string[] } {
  const blocks = data.content || [];
  const texts: string[] = [];
  const searchQueries: string[] = [];

  for (const block of blocks) {
    if (block.type === 'text' && typeof block.text === 'string') {
      texts.push(block.text);
    }
    if (block.type === 'server_tool_use' && block.name === 'web_search') {
      const input = block.input as { query?: string } | undefined;
      if (input?.query) searchQueries.push(input.query);
    }
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const item of block.content as Array<{ type?: string; query?: string }>) {
        if (item?.type === 'web_search_result' && typeof (item as { title?: string }).title === 'string') {
          /* citations only — queries already from tool_use */
        }
      }
    }
  }

  return { text: texts.join(''), searchQueries };
}

export async function llmGenerateContent(opts: LlmGenerateOptions): Promise<LlmGenerateResult> {
  const models = opts.model ? [opts.model] : getLlmModelCandidates();
  const failures: string[] = [];
  let lastError: Error | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await llmGenerateContentWithModel(opts, model);
      } catch (e: unknown) {
        const err = e instanceof Error ? e : new Error(String(e));
        lastError = err;
        // Billing / auth: não há fallback útil — propaga (mensagem já pública).
        if (err instanceof LlmProviderError && (err.code === 'billing' || err.code === 'auth')) {
          throw err;
        }
        if (isLlmBillingError(err)) throw err;
        if (/API key|authentication_error|invalid.?api.?key/i.test(err.message)) throw err;

        const detail =
          err instanceof LlmProviderError
            ? err.providerDetail?.slice(0, 200) ?? err.code
            : err.message.slice(0, 200);
        failures.push(`${model}: ${detail}`);

        if (isModelNotFoundError(err.message) || isModelNotFoundError(detail)) break;

        if (shouldRetrySameModel(0, err.message) && attempt < 2) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        break;
      }
    }
  }

  console.error('[llm] all models failed', {
    models,
    failures: failures.slice(0, 8),
    last: lastError instanceof LlmProviderError ? lastError.code : lastError?.message?.slice(0, 200),
  });

  if (lastError instanceof LlmProviderError) throw lastError;
  throw new LlmProviderError('unavailable', {
    providerDetail: failures.join(' | ').slice(0, 800),
  });
}

async function llmGenerateContentWithModel(
  opts: LlmGenerateOptions,
  model: string,
): Promise<LlmGenerateResult> {
  const key = getLlmApiKey();
  const maxOut = clampMaxTokens(opts.maxOutputTokens ?? getLlmMaxOutputTokens());

  let parts: LlmPart[];
  if (opts.userParts?.length) {
    parts = opts.userParts;
  } else {
    parts = [{ text: opts.userText ?? '' }];
  }

  let system = opts.systemInstruction;
  if (opts.responseMimeType === 'application/json') {
    system +=
      '\n\nYou must respond with valid JSON only. Do not wrap in markdown code fences. No commentary before or after the JSON.';
  }

  const anthropicMessages: Array<{
    role: 'user' | 'assistant';
    content: string | AnthropicContentBlock[];
  }> = [];

  const attachmentBlocks = opts.userParts?.length ? partsToAnthropicContent(opts.userParts) : [];

  if (opts.chatMessages?.length) {
    const history = opts.chatMessages.slice(-24);
    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      const isLastUser = i === history.length - 1 && m.role === 'user' && attachmentBlocks.length > 0;
      if (isLastUser) {
        anthropicMessages.push({
          role: 'user',
          content: [...partsToAnthropicContent([{ text: m.content }]), ...attachmentBlocks],
        });
      } else {
        anthropicMessages.push({ role: m.role, content: m.content });
      }
    }
    if (attachmentBlocks.length && history[history.length - 1]?.role !== 'user') {
      anthropicMessages.push({ role: 'user', content: attachmentBlocks });
    }
  } else {
    anthropicMessages.push({ role: 'user', content: partsToAnthropicContent(parts) });
  }

  const body: Record<string, unknown> = {
    model,
    max_tokens: maxOut,
    temperature: opts.temperature ?? 0.1,
    system,
    messages: anthropicMessages,
  };

  if (opts.webSearch) {
    body.tools = [
      {
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 8,
      },
    ];
  }

  const response = await fetch(`${ANTHROPIC_API_ROOT}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_FETCH_TIMEOUT_MS),
  });

  const errText = await response.text();
  if (!response.ok) {
    if (isBillingLlmError(errText)) {
      logLlmProviderFailure('billing', model, response.status, errText);
      throw new LlmProviderError('billing', {
        httpStatus: response.status,
        providerDetail: errText.slice(0, 800),
      });
    }
    if (isAuthLlmError(response.status, errText)) {
      logLlmProviderFailure('auth', model, response.status, errText);
      throw new LlmProviderError('auth', {
        httpStatus: response.status,
        providerDetail: errText.slice(0, 800),
      });
    }
    const kind: LlmErrorCode = shouldTryNextModel(response.status, errText)
      ? 'provider'
      : 'unavailable';
    logLlmProviderFailure(kind, model, response.status, errText);
    throw new LlmProviderError(kind, {
      httpStatus: response.status,
      providerDetail: errText.slice(0, 800),
    });
  }

  let data: {
    content?: Array<Record<string, unknown>>;
    stop_reason?: string;
    error?: { message?: string; type?: string };
  };
  try {
    data = JSON.parse(errText) as typeof data;
  } catch {
    logLlmProviderFailure('provider', model, response.status, errText);
    throw new LlmProviderError('provider', {
      providerDetail: `invalid JSON response from ${model}`,
    });
  }

  if (data.error?.message) {
    const detail = data.error.message;
    if (isBillingLlmError(detail)) {
      logLlmProviderFailure('billing', model, response.status, detail);
      throw new LlmProviderError('billing', { providerDetail: detail.slice(0, 800) });
    }
    logLlmProviderFailure('provider', model, response.status, detail);
    throw new LlmProviderError('provider', { providerDetail: detail.slice(0, 800) });
  }

  const { text: rawText, searchQueries } = extractTextAndQueries(data);
  if (!rawText.trim() && !opts.webSearch) {
    const reason = data.stop_reason || 'sem content';
    throw new LlmProviderError('provider', {
      providerDetail: `empty response (${model}, ${reason})`,
    });
  }

  let text = rawText;
  if (opts.responseMimeType === 'application/json') {
    text = stripJsonFences(text);
  }

  return {
    text,
    finishReason: mapStopReason(data.stop_reason),
    searchQueries: searchQueries.length ? searchQueries : undefined,
  };
}

export async function llmCompleteText(
  systemInstruction: string,
  userText: string,
  options?: { maxOutputTokens?: number; temperature?: number },
): Promise<string> {
  const { text } = await llmGenerateContent({
    systemInstruction,
    userText,
    maxOutputTokens: options?.maxOutputTokens ?? 8192,
    temperature: options?.temperature ?? 0.2,
  });
  return text;
}

export async function llmCompleteJsonText(
  systemInstruction: string,
  userText: string,
  options?: { maxOutputTokens?: number },
): Promise<string> {
  const { text, finishReason } = await llmGenerateContent({
    systemInstruction,
    userText,
    maxOutputTokens: options?.maxOutputTokens ?? getLlmMaxOutputTokens(),
    temperature: 0.1,
    responseMimeType: 'application/json',
  });
  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      'A IA cortou a resposta. Tente um documento mais curto, ou divida o ficheiro em partes menores.',
    );
  }
  return text;
}

/** Pesquisa web via tool do provider. */
export async function llmCompleteWithWebSearch(
  systemInstruction: string,
  userText: string,
  options?: { maxOutputTokens?: number; temperature?: number },
): Promise<{ text: string; searchQueries: string[] }> {
  const models = getLlmModelCandidates();
  let lastError: Error | null = null;

  for (const model of models) {
    try {
      const { text, searchQueries } = await llmGenerateContentWithModel(
        {
          systemInstruction,
          userText,
          maxOutputTokens: options?.maxOutputTokens ?? 16384,
          temperature: options?.temperature ?? 0.2,
          webSearch: true,
        },
        model,
      );
      return { text, searchQueries: searchQueries ?? [] };
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (lastError instanceof LlmProviderError && (lastError.code === 'billing' || lastError.code === 'auth')) {
        throw lastError;
      }
      if (/API key|authentication_error|invalid.?api.?key/i.test(lastError.message)) throw lastError;
    }
  }

  if (lastError instanceof LlmProviderError) throw lastError;
  throw new LlmProviderError('unavailable', {
    providerDetail: lastError?.message?.slice(0, 400) ?? 'web search all models failed',
  });
}

export async function llmCompleteVision(
  systemInstruction: string,
  userText: string,
  imageBase64: string,
  imageMimeType: string,
  options?: { maxOutputTokens?: number },
): Promise<string> {
  const { text, finishReason } = await llmGenerateContent({
    systemInstruction,
    userParts: [{ text: userText }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }],
    maxOutputTokens: options?.maxOutputTokens ?? getLlmMaxOutputTokens(),
    temperature: 0.1,
    responseMimeType: 'application/json',
  });
  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      'A IA cortou a resposta. Tente de novo ou use um documento mais curto.',
    );
  }
  return text;
}

/** PDF como documento nativo (extratos digitalizados / OCR). */
export async function llmCompleteJsonWithPdf(
  systemInstruction: string,
  userText: string,
  pdfBase64: string,
  options?: { maxOutputTokens?: number },
): Promise<string> {
  const { text, finishReason } = await llmGenerateContent({
    systemInstruction,
    userParts: [
      { text: userText },
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
    ],
    maxOutputTokens: options?.maxOutputTokens ?? getLlmMaxOutputTokens(),
    temperature: 0.1,
    responseMimeType: 'application/json',
  });
  if (finishReason === 'MAX_TOKENS') {
    throw new Error(
      'A IA cortou a resposta. Tente um PDF mais curto.',
    );
  }
  return text;
}

export function imageMimeFromFilename(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.gif')) return 'image/gif';
  return 'image/jpeg';
}

/**
 * Stream no formato SSE que o MUSE já espera (OpenAI-like).
 * Gera texto completo e envia em fatias.
 */
export function llmStreamAsOpenAICompatibleSSE(
  systemInstruction: string,
  userContent: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        const text = await llmCompleteText(systemInstruction, userContent, {
          maxOutputTokens: 8192,
          temperature: 0.2,
        });
        const step = 32;
        for (let i = 0; i < text.length; i += step) {
          const slice = text.slice(i, i + step);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: slice } }] })}\n\n`),
          );
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (e: unknown) {
        console.error('[llm] stream failure', e);
        const msg = publicLlmErrorMessage(e);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ choices: [{ delta: { content: `Erro IA: ${msg}` } }] })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });
}
