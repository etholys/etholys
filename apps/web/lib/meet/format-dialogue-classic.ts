export type ClassicDialogueLine = {
  speaker: string;
  text: string;
  startSec?: number;
  endSec?: number;
};

type Utt = {
  speaker: string;
  text: string;
  startSec: number;
  endSec: number;
};

const FILLERS =
  /\b(eh+|e+m+|hmm+|ah+|uh+|este+e*|o+sea|tipo|digamos|pues|bueno bueno|í{2,}|mmm+)\b/gi;

/**
 * Limpeza clássica agressiva de STT ES/PT: fillers, gaguejos, lixo de pontuação.
 */
export function cleanSttUtteranceText(raw: string): string {
  let t = String(raw || '')
    .replace(/\s+/g, ' ')
    // leading orphan punctuation after speaker split
    .replace(/^[,.\s]+/, '')
    .replace(FILLERS, ' ')
    // multi-word stutter: "se me se me se me"
    .replace(/\b((?:\w{1,12}\s+){1,3}\w{1,12})(?:\s+\1){1,}\b/gi, '$1')
    // stutter: "el el el" / "la la"
    .replace(/\b(\w{1,12})(?:\s+\1){2,}\b/gi, '$1')
    .replace(/\b(\w{2,10})\s+\1\b/gi, '$1')
    // orphan ¿ ?
    .replace(/¿\s*\?/g, '')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return '';

  // Drop ultra-short backchannels alone (kept if longer context in same turn)
  if (/^(sí|si|ok|okay|ajá|claro|exacto|mm+|no)\.?$/i.test(t)) {
    return t.charAt(0).toUpperCase() + t.slice(1).replace(/\.$/, '') + (t.endsWith('?') ? '' : '.');
  }

  t = t.charAt(0).toUpperCase() + t.slice(1);

  if (/[A-Za-zÀ-ÿ0-9)]$/.test(t) && !/[.!?…]$/.test(t)) {
    t = `${t}.`;
  }

  return t;
}

function mergeAdjacent(rows: Utt[]): Utt[] {
  const merged: Utt[] = [];
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

function formatTimed(utterances: Utt[]): string {
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

export function formatDialogueFromUtterances(
  utterances: Array<{
    speaker: string;
    text: string;
    startSec: number;
    endSec: number;
  }>,
): { text: string; lines: ClassicDialogueLine[] } {
  const cleaned: Utt[] = utterances
    .map((u) => ({
      ...u,
      text: cleanSttUtteranceText(u.text),
      speaker: (u.speaker || 'Participante').trim().slice(0, 120) || 'Participante',
    }))
    .filter((u) => u.text.length > 0);

  const merged = mergeAdjacent(cleaned);
  const lines: ClassicDialogueLine[] = merged.map((u) => ({
    speaker: u.speaker,
    text: u.text,
    startSec: u.startSec,
    endSec: u.endSec,
  }));

  return { text: formatTimed(merged), lines };
}

/**
 * Aceita "Falante 1: …" no mesmo parágrafo (Gemini costuma devolver assim).
 */
function explodeInlineSpeakers(raw: string): string[] {
  const text = String(raw || '').replace(/\r\n/g, '\n');
  // Split on Falante N: / Speaker N: even mid-paragraph
  const parts = text.split(/(?=(?:Falante|Speaker|Participante|Pessoa)\s*\d+\s*:)/i);
  if (parts.length > 1) {
    return parts.map((p) => p.trim()).filter(Boolean);
  }
  return text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export function formatDialogueFromRawText(
  rawText: string,
  participants: string[] = [],
): { text: string; lines: ClassicDialogueLine[] } {
  const speakers = [
    ...new Set(participants.map((n) => n.trim()).filter(Boolean).slice(0, 24)),
  ];
  const fallback = speakers[0] || 'Participante';

  const linesIn = explodeInlineSpeakers(rawText);

  const parsed: ClassicDialogueLine[] = [];
  let lastSpeaker = fallback;
  let t = 0;

  for (const line of linesIn) {
    const timed = line.match(/^\[(\d{1,3}):(\d{2})\]\s*(.+)$/s);
    const body = timed ? timed[3]! : line;
    const startSec = timed ? Number(timed[1]) * 60 + Number(timed[2]) : t;

    const labeled = body.match(/^([^:]{1,80}):\s*([\s\S]+)$/);
    if (labeled) {
      const maybe = labeled[1]!.trim();
      const rest = labeled[2]!.trim();
      const known =
        speakers.find((s) => s.toLowerCase() === maybe.toLowerCase()) ||
        speakers.find((s) => maybe.toLowerCase().includes(s.toLowerCase().split(/\s+/)[0]!));
      const looksLikeLabel =
        /^(falante|speaker|participante|pessoa)\s*\d+$/i.test(maybe) ||
        (maybe.length <= 40 && !/[.!?]$/.test(maybe) && /[A-Za-zÀ-ÿ]/.test(maybe));
      if (known || looksLikeLabel) {
        lastSpeaker = known || maybe;
        const text = cleanSttUtteranceText(rest);
        if (text) {
          parsed.push({ speaker: lastSpeaker, text, startSec, endSec: startSec + 4 });
          t = startSec + 5;
        }
        continue;
      }
    }

    const text = cleanSttUtteranceText(body);
    if (!text) continue;
    parsed.push({ speaker: lastSpeaker, text, startSec, endSec: startSec + 4 });
    t = startSec + 5;
  }

  return formatDialogueFromUtterances(
    parsed.map((l) => ({
      speaker: l.speaker,
      text: l.text,
      startSec: l.startSec ?? 0,
      endSec: l.endSec ?? (l.startSec ?? 0) + 4,
    })),
  );
}
