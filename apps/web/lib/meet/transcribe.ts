import 'server-only';

import { prepareMeetAudioForStt } from '@/lib/meet/extract-audio';

export type WhisperTimedSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

/**
 * Transcrição automática (Whisper via API OpenAI-compatible, ou Gemini).
 * Requer OPENAI_API_KEY / MEET_TRANSCRIBE_API_KEY ou GEMINI_API_KEY.
 */
export function isMeetTranscribeConfigured(): boolean {
  const openAiKey = (
    process.env.MEET_TRANSCRIBE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim();
  if (openAiKey) return true;
  return Boolean((process.env.GEMINI_API_KEY || '').trim());
}

function getTranscribeConfig(): { apiKey: string; baseUrl: string; model: string } {
  const apiKey = (
    process.env.MEET_TRANSCRIBE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim();
  if (!apiKey) {
    throw new Error(
      'A transcrição automática não está disponível neste momento.',
    );
  }
  const baseUrl = (
    process.env.MEET_TRANSCRIBE_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    'https://api.openai.com/v1'
  )
    .trim()
    .replace(/\/$/, '');
  const model = (process.env.MEET_TRANSCRIBE_MODEL || 'whisper-1').trim();
  return { apiKey, baseUrl, model };
}

export type MeetWhisperResult = {
  text: string;
  model: string;
  segments: WhisperTimedSegment[];
};

/**
 * Whisper/Gemini com timestamps — base para diarização CHORUS pós-chamada.
 * Vídeos grandes: extrai áudio em disco (ffmpeg) antes do STT.
 */
export async function transcribeMeetRecording(opts: {
  recordingUrlOrKey: string;
  languageHint?: string;
  /** Nomes / glossário para Whisper melhorar reconhecimento */
  promptHint?: string;
}): Promise<MeetWhisperResult> {
  const openAiKey = (
    process.env.MEET_TRANSCRIBE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim();
  if (!openAiKey && (process.env.GEMINI_API_KEY || '').trim()) {
    return transcribeWithGemini(opts);
  }

  const { apiKey, baseUrl, model } = getTranscribeConfig();
  const prepared = await prepareMeetAudioForStt({
    recordingUrlOrKey: opts.recordingUrlOrKey,
  });

  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(prepared.buffer)], {
      type: prepared.contentType || 'application/octet-stream',
    }),
    `recording.${prepared.ext}`,
  );
  form.append('model', model);
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  if (opts.languageHint) form.append('language', opts.languageHint.slice(0, 8));
  if (opts.promptHint?.trim()) {
    form.append('prompt', opts.promptHint.trim().slice(0, 900));
  }

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 400 && /response_format|verbose|timestamp/i.test(body)) {
      return transcribePlainTextFallback({
        apiKey,
        baseUrl,
        model,
        buffer: prepared.buffer,
        contentType: prepared.contentType,
        ext: prepared.ext,
        languageHint: opts.languageHint,
      });
    }
    throw new Error(`Não foi possível transcrever a gravação.`);
  }

  const data = (await res.json()) as {
    text?: string;
    segments?: Array<{ id?: number; start?: number; end?: number; text?: string }>;
  };

  const text = (data.text || '').trim();
  if (text.length < 5) throw new Error('Transcrição vazia ou demasiado curta');

  const segments: WhisperTimedSegment[] = Array.isArray(data.segments)
    ? data.segments
        .map((s, i) => ({
          id: typeof s.id === 'number' ? s.id : i,
          start: Number(s.start) || 0,
          end: Number(s.end) || 0,
          text: String(s.text || '').trim(),
        }))
        .filter((s) => s.text.length > 0)
    : [{ id: 0, start: 0, end: 0, text }];

  return { text: text.slice(0, 100_000), model, segments };
}

async function transcribeWithGemini(opts: {
  recordingUrlOrKey: string;
  languageHint?: string;
  promptHint?: string;
}): Promise<MeetWhisperResult> {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('A transcrição automática não está disponível neste momento.');
  }
  const model = (
    process.env.MEET_TRANSCRIBE_MODEL ||
    process.env.GEMINI_MODEL ||
    'gemini-2.0-flash'
  )
    .trim()
    .replace(/^models\//, '');
  const prepared = await prepareMeetAudioForStt({
    recordingUrlOrKey: opts.recordingUrlOrKey,
  });

  const lang = (opts.languageHint || 'pt').slice(0, 8);
  const prompt = [
    `Transcreva este áudio de reunião em ${lang}.`,
    'Produza um DIÁLOGO limpo e profissional (nível acta de reunião).',
    'Separe turnos por interlocutor. Prefira NOMES reais se o contexto os indicar.',
    'Formato obrigatório, uma fala por linha:',
    '[m:ss] Nome: frase completa com pontuação.',
    'Exemplo: [0:12] Thiago: Hola, ¿cómo estás?',
    'Se não souber o nome, use Falante 1 / Falante 2 de forma consistente — mas prefira nomes do contexto.',
    'Corrija pontuação; evite muletas vazias (eh, este este); não invente conteúdo.',
    'Não acrescente comentários fora da transcrição.',
    opts.promptHint?.trim() ? `Contexto (participantes/título): ${opts.promptHint.trim().slice(0, 500)}` : '',
  ]
    .filter(Boolean)
    .join(' ');

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
                  mime_type: prepared.contentType || 'audio/mpeg',
                  data: prepared.buffer.toString('base64'),
                },
              },
              { text: prompt },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) {
    await res.text().catch(() => '');
    throw new Error('Não foi possível transcrever a gravação.');
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '')
    .trim();
  if (text.length < 5) throw new Error('Transcrição vazia ou demasiado curta');

  return {
    text: text.slice(0, 100_000),
    model: `gemini:${model}`,
    segments: [{ id: 0, start: 0, end: 0, text }],
  };
}

async function transcribePlainTextFallback(opts: {
  apiKey: string;
  baseUrl: string;
  model: string;
  buffer: Buffer;
  contentType: string;
  ext: string;
  languageHint?: string;
}): Promise<MeetWhisperResult> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(opts.buffer)], {
      type: opts.contentType || 'application/octet-stream',
    }),
    `recording.${opts.ext}`,
  );
  form.append('model', opts.model);
  if (opts.languageHint) form.append('language', opts.languageHint.slice(0, 8));

  const res = await fetch(`${opts.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${opts.apiKey}` },
    body: form,
  });
  if (!res.ok) {
    await res.text().catch(() => '');
    throw new Error(`Não foi possível transcrever a gravação.`);
  }
  const data = (await res.json()) as { text?: string };
  const text = (data.text || '').trim();
  if (text.length < 5) throw new Error('Transcrição vazia ou demasiado curta');
  return {
    text: text.slice(0, 100_000),
    model: opts.model,
    segments: [{ id: 0, start: 0, end: 0, text }],
  };
}
