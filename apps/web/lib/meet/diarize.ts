import 'server-only';

import { llmCompleteJsonText } from '@/lib/llm-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import type { WhisperTimedSegment } from '@/lib/meet/transcribe';
import { resolveMeetSpeechLanguage } from '@/lib/meet/language';

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
 * Atribui segmentos Whisper aos nomes da reunião — SEM reescrever o texto (evita alucinações).
 */
export async function diarizeWhisperSegments(opts: {
  segments: WhisperTimedSegment[];
  participants: string[];
  liveHints?: Array<{ speaker: string; text: string }>;
  locale?: string;
  languageHint?: string;
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

  const speechLang = resolveMeetSpeechLanguage({
    explicit: opts.languageHint,
    uiLocale: opts.locale,
  });

  const hints = (opts.liveHints || [])
    .slice(0, 30)
    .map((h) => `${h.speaker}: ${h.text}`)
    .join('\n')
    .slice(0, 3000);

  const batches: PackedSegment[][] = [];
  for (let i = 0; i < segments.length; i += BATCH_SIZE) {
    batches.push(segments.slice(i, i + BATCH_SIZE));
  }

  const speakerById = new Map<number, string>();
  let carrySpeaker: string | null = null;

  for (let b = 0; b < batches.length; b += 1) {
    const batch = batches[b]!;
    const assignments = await diarizeBatchAssignments({
      batch,
      speakers,
      hints,
      speechLang,
      carrySpeaker,
      batchIndex: b,
      batchTotal: batches.length,
    });
    for (const [id, speaker] of assignments) {
      speakerById.set(id, speaker);
      carrySpeaker = speaker;
    }
  }

  const utterances: DiarizedUtterance[] = segments.map((s) => ({
    speaker: speakerById.get(s.id) || carrySpeaker || speakers[0]!,
    text: s.text,
    startSec: s.start,
    endSec: s.end,
  }));

  return mergeAdjacentUtterances(utterances);
}

async function diarizeBatchAssignments(opts: {
  batch: PackedSegment[];
  speakers: string[];
  hints: string;
  speechLang?: string;
  carrySpeaker: string | null;
  batchIndex: number;
  batchTotal: number;
}): Promise<Map<number, string>> {
  const packed = opts.batch
    .map((s) => `#${s.id} [${s.start.toFixed(1)}-${s.end.toFixed(1)}s] ${s.text}`)
    .join('\n')
    .slice(0, 24_000);

  const raw = await llmCompleteJsonText(
    'És o motor de diarização Etholys CHORUS. Devolves só JSON válido.',
    `Atribui cada segmento Whisper (#id) a UM falante da lista.
Lote ${opts.batchIndex + 1}/${opts.batchTotal}.
Participantes: ${JSON.stringify(opts.speakers)}
${opts.carrySpeaker ? `Falante anterior: ${opts.carrySpeaker}\n` : ''}
${opts.hints ? `Pistas (só para quem fala, NÃO copies o texto):\n${opts.hints}\n` : ''}
Idioma da reunião: ${opts.speechLang || 'português'}

REGRAS CRÍTICAS:
- Responde APENAS com speaker por id — NÃO reescrevas, traduzas nem inventes texto
- Não inventes nomes fora da lista (salvo "Desconhecido")
- Cobre TODOS os ids do lote

Segmentos:
${packed}

Responde APENAS:
{"assignments":[{"id":0,"speaker":"Nome"}]}`,
    { maxOutputTokens: 4096 },
  );

  const jsonStr = extractFirstJsonObject(raw) ?? raw.trim();
  const out = new Map<number, string>();

  try {
    const parsed = JSON.parse(jsonStr) as { assignments?: unknown };
    if (Array.isArray(parsed.assignments)) {
      for (const row of parsed.assignments) {
        if (!row || typeof row !== 'object') continue;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === 'number' ? o.id : Number(o.id);
        const speaker = typeof o.speaker === 'string' ? o.speaker.trim() : '';
        if (!Number.isFinite(id) || !speaker) continue;
        const resolved =
          opts.speakers.find((s) => s.toLowerCase() === speaker.toLowerCase()) ||
          opts.speakers.find((s) => speaker.toLowerCase().includes(s.toLowerCase())) ||
          (opts.carrySpeaker && speaker.toLowerCase().includes(opts.carrySpeaker.toLowerCase())
            ? opts.carrySpeaker
            : null) ||
          speaker.slice(0, 80);
        out.set(id, resolved.slice(0, 120));
      }
    }
  } catch {
    /* fallback abaixo */
  }

  if (out.size === 0) {
    const current = opts.carrySpeaker || opts.speakers[0]!;
    for (const s of opts.batch) {
      out.set(s.id, current);
    }
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
