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

type PackedSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

const BATCH_SIZE = 90;

/**
 * Atribui segmentos Whisper aos nomes da reunião (estilo Otter).
 * Processa em lotes para reuniões longas (evita truncar / round-robin).
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
    .slice(0, 800);

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

  const hints = (opts.liveHints || [])
    .slice(0, 50)
    .map((h) => `${h.speaker}: ${h.text}`)
    .join('\n')
    .slice(0, 4500);

  const batches: PackedSegment[][] = [];
  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    batches.push(segments.slice(i, i + BATCH_SIZE));
  }

  const all: DiarizedUtterance[] = [];
  let carrySpeaker: string | null = null;

  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b]!;
    const part = await diarizeBatch({
      batch,
      speakers,
      hints,
      lang,
      carrySpeaker,
      batchIndex: b,
      batchTotal: batches.length,
    });
    if (part.length > 0) {
      carrySpeaker = part[part.length - 1]!.speaker;
      all.push(...part);
    }
  }

  if (all.length === 0) {
    return hintAwareFallback(segments, speakers, opts.liveHints || []);
  }

  return mergeAdjacentUtterances(all);
}

async function diarizeBatch(opts: {
  batch: PackedSegment[];
  speakers: string[];
  hints: string;
  lang: string;
  carrySpeaker: string | null;
  batchIndex: number;
  batchTotal: number;
}): Promise<DiarizedUtterance[]> {
  const packed = opts.batch
    .map((s) => `#${s.id} [${s.start.toFixed(1)}-${s.end.toFixed(1)}s] ${s.text}`)
    .join('\n')
    .slice(0, 24_000);

  const raw = await llmCompleteJsonText(
    'És o motor de diarização Etholys CHORUS. Devolves só JSON válido.',
    `Atribui cada segmento de áudio (Whisper) a UM falante da lista.
Lote ${opts.batchIndex + 1}/${opts.batchTotal}.
Lista de participantes: ${JSON.stringify(opts.speakers)}
${opts.carrySpeaker ? `O falante anterior (continuidade): ${opts.carrySpeaker}\n` : ''}
${opts.hints ? `Pistas da transcrição ao vivo:\n${opts.hints}\n` : ''}
Regras:
- Não inventes nomes fora da lista (salvo "Desconhecido" se impossível)
- Junta turnos consecutivos do mesmo falante no output
- Corrige pontuação leve; não reescrevas o sentido
- Cobre TODOS os segmentos do lote (não cries)
- O texto falado fica em ${opts.lang}

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
    return hintAwareFallback(opts.batch, opts.speakers, []);
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
        opts.speakers.find((s) => s.toLowerCase() === speaker.toLowerCase()) ||
        opts.speakers.find((s) => speaker.toLowerCase().includes(s.toLowerCase())) ||
        (opts.carrySpeaker && speaker.toLowerCase().includes(opts.carrySpeaker.toLowerCase())
          ? opts.carrySpeaker
          : null) ||
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
    return hintAwareFallback(opts.batch, opts.speakers, []);
  }
  return out;
}

/** Prefer live-hint speaker when text overlaps; else keep previous / first speaker. */
function hintAwareFallback(
  segments: PackedSegment[],
  speakers: string[],
  liveHints: Array<{ speaker: string; text: string }>,
): DiarizedUtterance[] {
  const out: DiarizedUtterance[] = [];
  let current = speakers[0]!;
  for (const s of segments) {
    const hit = liveHints.find((h) => {
      const a = h.text.toLowerCase().slice(0, 40);
      const b = s.text.toLowerCase().slice(0, 40);
      return a.length > 8 && (b.includes(a.slice(0, 20)) || a.includes(b.slice(0, 20)));
    });
    if (hit?.speaker) {
      const match =
        speakers.find((n) => n.toLowerCase() === hit.speaker.toLowerCase()) || hit.speaker;
      current = match;
    }
    out.push({
      speaker: current,
      text: s.text,
      startSec: s.start,
      endSec: s.end,
    });
  }
  return out;
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
