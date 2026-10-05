export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { isMeetTranscribeConfigured } from '@/lib/meet/transcribe';
import { normalizeFundhubLocale } from '@/lib/agents/fundhub-proposal-prompt';

/**
 * POST multipart: file=audio — transcrição curta para o chat de propostas.
 * Reutiliza Whisper (OpenAI-compatible) ou Gemini se configurado no Meet.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  if (!isMeetTranscribeConfigured()) {
    return NextResponse.json(
      { error: 'Transcrição não configurada neste ambiente.' },
      { status: 503 },
    );
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size < 64) {
    return NextResponse.json({ error: 'Áudio em falta.' }, { status: 400 });
  }
  if (file.size > 12 * 1024 * 1024) {
    return NextResponse.json({ error: 'Áudio demasiado grande (máx. 12 MB).' }, { status: 400 });
  }

  const locale = normalizeFundhubLocale(form.get('locale'));
  const langHint = locale === 'en' ? 'en' : locale === 'es' ? 'es' : 'pt';
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || 'audio/webm';
  const ext = mime.includes('mp4') || mime.includes('m4a') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm';

  const openAiKey = (
    process.env.MEET_TRANSCRIBE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim();

  try {
    if (openAiKey) {
      const baseUrl = (
        process.env.MEET_TRANSCRIBE_BASE_URL ||
        process.env.OPENAI_BASE_URL ||
        'https://api.openai.com/v1'
      )
        .trim()
        .replace(/\/$/, '');
      const model = (process.env.MEET_TRANSCRIBE_MODEL || 'whisper-1').trim();
      const fd = new FormData();
      fd.append('file', new Blob([buf], { type: mime }), `voice.${ext}`);
      fd.append('model', model);
      fd.append('language', langHint);
      const res = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${openAiKey}` },
        body: fd,
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        console.error('[proposals/transcribe] whisper', res.status, t.slice(0, 200));
        return NextResponse.json({ error: 'Falha na transcrição.' }, { status: 502 });
      }
      const data = (await res.json()) as { text?: string };
      const text = String(data.text || '').trim();
      if (text.length < 2) {
        return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 422 });
      }
      return NextResponse.json({ text: text.slice(0, 8000) });
    }

    // Gemini fallback
    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const model = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim().replace(/^models\//, '');
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mime,
                    data: buf.toString('base64'),
                  },
                },
                {
                  text: `Transcribe this short voice note to plain text in ${langHint}. Output only the transcript, no commentary.`,
                },
              ],
            },
          ],
        }),
      },
    );
    if (!res.ok) {
      return NextResponse.json({ error: 'Falha na transcrição.' }, { status: 502 });
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = String(data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    if (text.length < 2) {
      return NextResponse.json({ error: 'Transcrição vazia.' }, { status: 422 });
    }
    return NextResponse.json({ text: text.slice(0, 8000) });
  } catch (e) {
    console.error('[proposals/transcribe]', e);
    return NextResponse.json({ error: 'Erro ao transcrever.' }, { status: 500 });
  }
}
