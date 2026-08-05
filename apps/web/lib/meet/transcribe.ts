import 'server-only';

import { downloadMeetRecordingBuffer } from '@/lib/meet/recording-storage';

/**
 * Transcrição automática (Whisper via OpenAI-compatible API).
 * Requer OPENAI_API_KEY (ou MEET_TRANSCRIBE_API_KEY) — Anthropic não faz STT de áudio aqui.
 */
export function isMeetTranscribeConfigured(): boolean {
  return Boolean(
    (
      process.env.MEET_TRANSCRIBE_API_KEY ||
      process.env.OPENAI_API_KEY ||
      ''
    ).trim(),
  );
}

function getTranscribeConfig(): { apiKey: string; baseUrl: string; model: string } {
  const apiKey = (
    process.env.MEET_TRANSCRIBE_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ''
  ).trim();
  if (!apiKey) {
    throw new Error(
      'Falta chave de STT (OPENAI_API_KEY ou MEET_TRANSCRIBE_API_KEY) para transcrição automática',
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

export async function transcribeMeetRecording(opts: {
  recordingUrlOrKey: string;
  languageHint?: string;
}): Promise<{ text: string; model: string }> {
  const { apiKey, baseUrl, model } = getTranscribeConfig();
  const { buffer, contentType } = await downloadMeetRecordingBuffer(opts.recordingUrlOrKey);

  // Whisper tem limite ~25MB; recusar cedo com mensagem clara
  const maxBytes = Number(process.env.MEET_TRANSCRIBE_MAX_BYTES || 24 * 1024 * 1024);
  if (buffer.byteLength > maxBytes) {
    throw new Error(
      `Ficheiro demasiado grande para STT (${Math.round(buffer.byteLength / 1024 / 1024)} MB). Extraia áudio ou use notas manuais.`,
    );
  }

  const ext = pickAudioExtension(contentType, opts.recordingUrlOrKey);
  const form = new FormData();
  form.append(
    'file',
    new Blob([new Uint8Array(buffer)], { type: contentType || 'application/octet-stream' }),
    `recording.${ext}`,
  );
  form.append('model', model);
  if (opts.languageHint) form.append('language', opts.languageHint.slice(0, 8));

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`STT falhou (${res.status}): ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text || '').trim();
  if (text.length < 5) throw new Error('Transcrição vazia ou demasiado curta');
  return { text: text.slice(0, 100_000), model };
}
