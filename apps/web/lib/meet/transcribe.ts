import 'server-only';

import { downloadMeetRecordingBuffer } from '@/lib/meet/recording-storage';
import { extractMeetAudioForTranscription } from '@/lib/meet/extract-audio';

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

function pickAudioExtension(contentType: string, urlHint: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('webm')) return 'webm';
  if (ct.includes('ogg')) return 'ogg';
  if (ct.includes('wav')) return 'wav';
  if (ct.includes('mpeg') || ct.includes('mp3')) return 'mp3';
  if (ct.includes('mp4') || ct.includes('m4a')) return 'm4a';
  const m = urlHint.match(/\.([a-z0-9]{2,4})(?:\?|$)/i);
  if (m) return m[1]!.toLowerCase();
  return 'mp4';
}

function maxTranscribeBytes(): number {
  return Number(process.env.MEET_TRANSCRIBE_MAX_BYTES || 24 * 1024 * 1024);
}

/** Se o ficheiro for grande (vídeo), extrai áudio compacto para STT. */
async function prepareBufferForStt(opts: {
  buffer: Buffer;
  contentType: string;
  urlHint: string;
}): Promise<{ buffer: Buffer; contentType: string; ext: string }> {
  const maxBytes = maxTranscribeBytes();
  let { buffer, contentType } = opts;
  let ext = pickAudioExtension(contentType, opts.urlHint);

  if (buffer.byteLength > maxBytes) {
    const extracted = await extractMeetAudioForTranscription({
      buffer,
      contentType,
      urlHint: opts.urlHint,
    });
    if (!extracted) {
      const mb = Math.round(buffer.byteLength / 1024 / 1024);
      const lim = Math.round(maxBytes / 1024 / 1024);
      throw new Error(
        `A gravação é demasiado grande (${mb} MB; limite ~${lim} MB após extrair áudio). Tente um ficheiro mais curto.`,
      );
    }
    buffer = extracted.buffer;
    contentType = extracted.contentType;
    ext = extracted.ext;
  }

  if (buffer.byteLength > maxBytes) {
    const mb = Math.round(buffer.byteLength / 1024 / 1024);
    const lim = Math.round(maxBytes / 1024 / 1024);
    throw new Error(
      `O áudio extraído ainda é grande (${mb} MB; limite ~${lim} MB). Divida a reunião ou envie só o áudio.`,
    );
  }

  return { buffer, contentType, ext };
}

export type MeetWhisperResult = {
  text: string;
  model: string;
  segments: WhisperTimedSegment[];
};

/**
 * Whisper/Gemini com timestamps — base para diarização CHORUS pós-chamada.
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
  const downloaded = await downloadMeetRecordingBuffer(opts.recordingUrlOrKey);
  const prepared = await prepareBufferForStt({
    buffer: downloaded.buffer,
    contentType: downloaded.contentType,
    urlHint: opts.recordingUrlOrKey,
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
  const downloaded = await downloadMeetRecordingBuffer(opts.recordingUrlOrKey);
  const prepared = await prepareBufferForStt({
    buffer: downloaded.buffer,
    contentType: downloaded.contentType,
    urlHint: opts.recordingUrlOrKey,
  });

  const lang = (opts.languageHint || 'pt').slice(0, 8);
  const prompt = [
    `Transcreva este áudio de reunião em ${lang}.`,
    'Devolva apenas o texto transcrito, sem comentários nem formatação extra.',
    opts.promptHint?.trim() ? `Contexto: ${opts.promptHint.trim().slice(0, 400)}` : '',
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
