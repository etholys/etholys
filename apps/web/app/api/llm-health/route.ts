export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { DEFAULT_LLM_MODEL, getLlmModel, hasLlmApiKey } from '@/lib/llm-client';

/** Verifica se a chave LLM está configurada e responde a um ping. */
export async function GET() {
  const model = (() => {
    try {
      return getLlmModel();
    } catch {
      return (process.env.LLM_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_LLM_MODEL).trim();
    }
  })();

  if (!hasLlmApiKey()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'O serviço de IA não está disponível neste momento.',
      },
      { status: 502 },
    );
  }

  const key = (
    process.env.ANTHROPIC_API_KEY ||
    process.env.CLAUDE_API_KEY ||
    process.env.LLM_API_KEY ||
    ''
  ).trim();

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 16,
        messages: [{ role: 'user', content: 'ping' }],
      }),
      cache: 'no-store',
    });

    const detail = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          modelConfigured: model,
          error: `HTTP ${res.status}`,
          detail: detail.slice(0, 400),
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      modelConfigured: model,
      hint: 'IA operacional.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        modelConfigured: model,
        error: msg,
      },
      { status: 502 },
    );
  }
}
