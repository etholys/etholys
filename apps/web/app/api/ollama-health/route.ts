export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

/**
 * Compat: URL antiga /api/ollama-health — hoje verifica Google Gemini.
 * Teste: abra /api/ollama-health no browser (mesmo host da app).
 */
export async function GET() {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim();

  if (!key?.trim()) {
    return NextResponse.json(
      {
        ok: false,
        provider: 'gemini',
        error: 'Falta GEMINI_API_KEY (ou GOOGLE_GENERATIVE_AI_API_KEY) no .env',
        hint: 'https://aistudio.google.com/apikey',
      },
      { status: 502 }
    );
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key.trim())}&pageSize=8`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          provider: 'gemini',
          modelConfigured: model,
          error: `HTTP ${res.status}`,
          detail: typeof data === 'object' ? JSON.stringify(data).slice(0, 400) : '',
        },
        { status: 502 }
      );
    }

    const names = ((data as { models?: { name?: string }[] }).models || [])
      .map((m) => (m.name || '').replace(/^models\//, ''))
      .filter(Boolean)
      .slice(0, 24);

    return NextResponse.json({
      ok: true,
      provider: 'gemini',
      modelConfigured: model,
      modelsSample: names,
      hint: 'A importação SIEP e outras IAs usam GEMINI_MODEL e GEMINI_MAX_OUTPUT_TOKENS.',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        ok: false,
        provider: 'gemini',
        modelConfigured: model,
        error: msg,
      },
      { status: 502 }
    );
  }
}
