import 'server-only';

import { llmCompleteJsonText } from '@/lib/llm-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import type { WhisperTimedSegment } from '@/lib/meet/transcribe';

export type DiarizedUtterance = {
  speaker: string;
  text: string;
  startSec: number;
  endSec: number;
};

/**
 * Atribui segmentos Whisper aos nomes da reunião (estilo Otter).
 */
export async function diarizeWhisperSegments(opts: {
  segments: WhisperTimedSegment[];
  participants: string[];
  liveHints?: Array<{ speaker: string; text: string }>;
  locale?: string;
}): Promise<DiarizedUtterance[]> {
  const segments = opts.segments
    .map((s) => ({
      id: s.id,
      start: Number(s.start) || 0,
      end: Number(s.end) || 0,
      text: String(s.text || '').trim(),
    }))
    .filter((s) => s.text.length > 0)
    .slice(0, 400);

  if (segments.length === 0) return [];

  const speakers = [
    ...new Set(
      opts.participants
        .map((n) => n.trim())
        .filter(Boolean)
        .slice(0, 24),
    ),
  ];
  if (speakers.length === 0) speakers.push('Participante');

  const lang =
    opts.locale === 'pt' ? 'português' : opts.locale === 'en' ? 'English' : 'español';

  const packed = segments
    .map((s) => `#${s.id} [${s.start.toFixed(1)}-${s.end.toFixed(1)}s] ${s.text}`)
    .join('\n')
    .slice(0, 28_000);

  const hints = (opts.liveHints || [])
    .slice(0, 40)
    .map((h) => `${h.speaker}: ${h.text}`)
    .join('\n')
    .slice(0, 4000);

  const raw = await llmCompleteJsonText(
    'És o motor de diarização Etholys CHORUS. Devolves só JSON válido.',
    `Atribui cada segmento de áudio (Whisper) a UM falante da lista.
Lista de participantes: ${JSON.stringify(speakers)}
${hints ? `Pistas da transcrição ao vivo:\n${hints}\n` : ''}
Regras:
- Não inventes nomes fora da lista (salvo "Desconhecido" se impossível)
- Junta turnos consecutivos do mesmo falante no output
- Corrige pontuação leve; não reescrevas o sentido
- O texto falado fica em ${lang}

Segmentos:
${packed}

Responde APENAS:
{"utterances":[{"speaker":"Nome","text":"...","startSec":0,"endSec":1.2}]}`,
    { maxOutputTokens: 8192 },
  );

  const jsonStr = extractFirstJsonObject(raw) ?? raw.trim();
  let parsed: { utterances?: unknown };
  try {
    parsed = JSON.parse(jsonStr) as { utterances?: unknown };
  } catch {
    return segments.map((s, i) => ({
      speaker: speakers[i % speakers.length]!,
      text: s.text,
      startSec: s.start,
      endSec: s.end,
    }));
  }

  const out: DiarizedUtterance[] = [];
  if (Array.isArray(parsed.utterances)) {
    for (const row of parsed.utterances) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const speaker = typeof o.speaker === 'string' ? o.speaker.trim() : '';
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      if (!speaker || !text) continue;
      const startSec = typeof o.startSec === 'number' ? o.startSec : Number(o.startSec) || 0;
      const endSec = typeof o.endSec === 'number' ? o.endSec : Number(o.endSec) || startSec;
      const resolved =
        speakers.find((s) => s.toLowerCase() === speaker.toLowerCase()) ||
        speakers.find((s) => speaker.toLowerCase().includes(s.toLowerCase())) ||
        speaker.slice(0, 80);
      out.push({
        speaker: resolved.slice(0, 120),
        text: text.slice(0, 4000),
        startSec,
        endSec,
      });
    }
  }

  if (out.length === 0) {
    return segments.map((s, i) => ({
      speaker: speakers[i % speakers.length]!,
      text: s.text,
      startSec: s.start,
      endSec: s.end,
    }));
  }

  return mergeAdjacentUtterances(out);
}

function mergeAdjacentUtterances(rows: DiarizedUtterance[]): DiarizedUtterance[] {
  const merged: DiarizedUtterance[] = [];
  for (const row of rows) {
    const last = merged[merged.length - 1];
    if (last && last.speaker === row.speaker && row.startSec - last.endSec < 8) {
      last.text = `${last.text} ${row.text}`.replace(/\s+/g, ' ').trim();
      last.endSec = Math.max(last.endSec, row.endSec);
    } else {
      merged.push({ ...row });
    }
  }
  return merged;
}

export function formatDiarizedTranscript(utterances: DiarizedUtterance[]): string {
  return utterances
    .map((u) => {
      const m = Math.floor(u.startSec / 60);
      const s = Math.floor(u.startSec % 60)
        .toString()
        .padStart(2, '0');
      return `[${m}:${s}] ${u.speaker}: ${u.text}`;
    })
    .join('\n')
    .trim();
}
