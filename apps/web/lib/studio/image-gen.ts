/**
 * Geração de imagens Studio — OpenAI DALL·E / Replicate Flux / fallback SVG (LLM).
 */
import { llmGenerateContent } from '@/lib/llm-client';
import type { StudioBrandKit } from '@/lib/studio/export';
import {
  buildImageSvgSystemPrompt,
  extractSvgFromLlm,
  svgToDataUrl,
} from '@/lib/studio/design-media-ai';

export type StudioImageProvider = 'openai' | 'replicate' | 'svg';

export type StudioImageGenResult = {
  imageUrl: string;
  provider: StudioImageProvider;
};

export type StudioImageGenOptions = {
  prompt: string;
  brand: StudioBrandKit;
  /** square | landscape (16:9) | portrait (9:16) */
  aspect?: 'square' | 'landscape' | 'portrait';
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function brandPromptSuffix(brand: StudioBrandKit): string {
  const parts = [
    brand.orgName ? `Brand: ${brand.orgName}` : '',
    `Primary color ${brand.primaryColor}`,
    brand.secondaryColor ? `Secondary ${brand.secondaryColor}` : '',
    'Professional, clean, modern design',
  ].filter(Boolean);
  return parts.join('. ');
}

export function resolveStudioImageProvider(): StudioImageProvider | 'auto' {
  const raw = (process.env.STUDIO_IMAGE_PROVIDER || 'auto').trim().toLowerCase();
  if (raw === 'openai' || raw === 'replicate' || raw === 'svg') return raw;
  return 'auto';
}

function openAiKey(): string | null {
  return (
    process.env.STUDIO_IMAGE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.MEET_TRANSCRIBE_API_KEY ||
    ''
  ).trim() || null;
}

function replicateToken(): string | null {
  return (process.env.REPLICATE_API_TOKEN || process.env.STUDIO_REPLICATE_TOKEN || '').trim() || null;
}

function openAiSize(aspect: StudioImageGenOptions['aspect']): string {
  if (aspect === 'landscape') return '1792x1024';
  if (aspect === 'portrait') return '1024x1792';
  return '1024x1024';
}

async function generateOpenAiImage(
  prompt: string,
  aspect?: StudioImageGenOptions['aspect'],
): Promise<string | null> {
  const key = openAiKey();
  if (!key) return null;
  const base =
    process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, '') || 'https://api.openai.com/v1';
  const model = process.env.STUDIO_OPENAI_IMAGE_MODEL?.trim() || 'dall-e-3';
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      prompt: prompt.slice(0, 4000),
      n: 1,
      size: openAiSize(aspect),
      response_format: 'b64_json',
      quality: process.env.STUDIO_OPENAI_IMAGE_QUALITY === 'hd' ? 'hd' : 'standard',
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.warn('[studio image-gen] OpenAI failed', res.status, body.slice(0, 200));
    return null;
  }
  const data = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return null;
  return `data:image/png;base64,${b64}`;
}

async function generateReplicateFluxImage(prompt: string): Promise<string | null> {
  const token = replicateToken();
  if (!token) return null;
  const model =
    process.env.STUDIO_REPLICATE_MODEL?.trim() || 'black-forest-labs/flux-schnell';

  const create = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=60',
    },
    body: JSON.stringify({
      input: {
        prompt: prompt.slice(0, 4000),
        num_outputs: 1,
        aspect_ratio: '16:9',
        output_format: 'png',
        output_quality: 90,
      },
    }),
  });
  if (!create.ok) {
    const body = await create.text().catch(() => '');
    console.warn('[studio image-gen] Replicate create failed', create.status, body.slice(0, 200));
    return null;
  }

  let pred = (await create.json()) as {
    id?: string;
    status?: string;
    output?: string | string[] | null;
    error?: string | null;
  };

  const deadline = Date.now() + 90_000;
  while (pred.status && !['succeeded', 'failed', 'canceled'].includes(pred.status)) {
    if (Date.now() > deadline) break;
    await sleep(1500);
    if (!pred.id) break;
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!poll.ok) break;
    pred = (await poll.json()) as typeof pred;
  }

  if (pred.status !== 'succeeded') {
    console.warn('[studio image-gen] Replicate ended', pred.status, pred.error);
    return null;
  }

  const out = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  if (typeof out !== 'string' || !out.startsWith('http')) return null;

  const imgRes = await fetch(out);
  if (!imgRes.ok) return null;
  const buf = Buffer.from(await imgRes.arrayBuffer());
  const b64 = buf.toString('base64');
  const mime = imgRes.headers.get('content-type')?.includes('jpeg') ? 'image/jpeg' : 'image/png';
  return `data:${mime};base64,${b64}`;
}

async function generateSvgFallback(prompt: string, brand: StudioBrandKit): Promise<string | null> {
  try {
    const { text } = await llmGenerateContent({
      systemInstruction: buildImageSvgSystemPrompt(brand),
      userText: prompt,
      maxOutputTokens: 4096,
      temperature: 0.45,
    });
    const svg = extractSvgFromLlm(text);
    return svg ? svgToDataUrl(svg) : null;
  } catch (e) {
    console.warn('[studio image-gen] SVG fallback failed', e);
    return null;
  }
}

/** Gera imagem — tenta providers na ordem configurada. */
export async function generateStudioImage(
  opts: StudioImageGenOptions,
): Promise<StudioImageGenResult | null> {
  const fullPrompt = `${opts.prompt.trim()}. ${brandPromptSuffix(opts.brand)}`.trim();
  const mode = resolveStudioImageProvider();

  const tryOpenAi = mode === 'auto' || mode === 'openai';
  const tryReplicate = mode === 'auto' || mode === 'replicate';
  const trySvg = mode === 'auto' || mode === 'svg';

  if (tryOpenAi && mode !== 'svg') {
    const url = await generateOpenAiImage(fullPrompt, opts.aspect);
    if (url) return { imageUrl: url, provider: 'openai' };
    if (mode === 'openai') return null;
  }

  if (tryReplicate && mode !== 'svg' && mode !== 'openai') {
    const url = await generateReplicateFluxImage(fullPrompt);
    if (url) return { imageUrl: url, provider: 'replicate' };
    if (mode === 'replicate') return null;
  }

  if (trySvg) {
    const url = await generateSvgFallback(fullPrompt, opts.brand);
    if (url) return { imageUrl: url, provider: 'svg' };
  }

  return null;
}

export function hasStudioImageProviderConfigured(): boolean {
  const mode = resolveStudioImageProvider();
  if (mode === 'svg') return true;
  if (mode === 'openai') return Boolean(openAiKey());
  if (mode === 'replicate') return Boolean(replicateToken());
  return Boolean(openAiKey() || replicateToken());
}
