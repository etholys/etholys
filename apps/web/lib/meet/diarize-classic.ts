import { mergeAdjacentUtterances, type DiarizedUtterance } from '@/lib/meet/diarize-merge';

type WhisperTimedSegment = {
  id: number;
  start: number;
  end: number;
  text: string;
};

const GAP_TURN_SEC = 2.2;

function normalizeSpeakers(participants: string[]): string[] {
  const speakers = [
    ...new Set(participants.map((n) => n.trim()).filter(Boolean).slice(0, 24)),
  ];
  if (speakers.length === 0) speakers.push('Participante');
  return speakers;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/[^a-z0-9à-ÿ]+/i)
      .filter((w) => w.length > 2),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/**
 * Camada A: atribui falantes por heurística (1 participante, pistas live, gaps).
 * Não reescreve o texto. Sem LLM.
 */
export function diarizeWhisperSegmentsClassic(opts: {
  segments: WhisperTimedSegment[];
  participants: string[];
  liveHints?: Array<{ speaker: string; text: string }>;
}): DiarizedUtterance[] {
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

  const speakers = normalizeSpeakers(opts.participants);
  const hints = (opts.liveHints || [])
    .map((h) => ({
      speaker: h.speaker.trim(),
      tokens: tokenize(h.text),
    }))
    .filter((h) => h.speaker && h.tokens.size > 0)
    .slice(0, 80);

  let carry = speakers[0]!;
  let altIdx = 0;
  const utterances: DiarizedUtterance[] = [];

  for (let i = 0; i < segments.length; i += 1) {
    const s = segments[i]!;
    const prev = segments[i - 1];
    const gap = prev ? s.start - prev.end : 0;
    const segTokens = tokenize(s.text);

    let bestHint: { speaker: string; score: number } | null = null;
    for (const h of hints) {
      const score = jaccard(segTokens, h.tokens);
      if (score >= 0.28 && (!bestHint || score > bestHint.score)) {
        const resolved =
          speakers.find((sp) => sp.toLowerCase() === h.speaker.toLowerCase()) ||
          speakers.find((sp) => h.speaker.toLowerCase().includes(sp.toLowerCase())) ||
          h.speaker;
        bestHint = { speaker: resolved.slice(0, 120), score };
      }
    }

    if (bestHint) {
      carry = bestHint.speaker;
    } else if (speakers.length === 1) {
      carry = speakers[0]!;
    } else if (gap >= GAP_TURN_SEC) {
      altIdx = (altIdx + 1) % speakers.length;
      const next = speakers[altIdx]!;
      if (next.toLowerCase() !== carry.toLowerCase()) carry = next;
      else carry = speakers[(altIdx + 1) % speakers.length]!;
    }

    utterances.push({
      speaker: carry,
      text: s.text,
      startSec: s.start,
      endSec: s.end,
    });
  }

  return mergeAdjacentUtterances(utterances);
}
