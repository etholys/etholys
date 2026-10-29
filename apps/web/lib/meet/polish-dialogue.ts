import 'server-only';

import { extractFirstJsonObject } from '@/lib/extract-json-object';
import type { DiarizedUtterance } from '@/lib/meet/diarize';
import { resolveMeetSpeechLanguage } from '@/lib/meet/language';
import { meetCompleteJsonText } from '@/lib/meet/meet-llm';

const CHUNK_CHARS = 7_500;

export type PolishedDialogueLine = {
  speaker: string;
  text: string;
  startSec?: number;
};

/**
 * Transforma STT bruto / semi-diarizado num diálogo legível:
 * falante + frases com pontuação — sem inventar conteúdo.
 */
export async function polishMeetTranscriptToDialogue(opts: {
  rawText: string;
  utterances?: DiarizedUtterance[];
  participants?: string[];
  locale?: string;
  languageHint?: string;
  meetingTitle?: string | null;
}): Promise<{ text: string; lines: PolishedDialogueLine[] }> {
  const speakers = [
    ...new Set(
      (opts.participants || [])
        .map((n) => n.trim())
        .filter(Boolean)
        .slice(0, 24),
    ),
  ];

  const speechLang = resolveMeetSpeechLanguage({
    explicit: opts.languageHint,
    uiLocale: opts.locale,
  });
  const langLabel =
    speechLang === 'es'
      ? 'español'
      : speechLang === 'en'
        ? 'English'
        : speechLang === 'pt'
          ? 'português'
          : 'o idioma original do áudio';

  // Se já temos turnos diarizados com algum conteúdo útil, polimos por lotes de falas
  if (opts.utterances && opts.utterances.length >= 2) {
    const lines = await polishUtteranceBatches({
      utterances: opts.utterances,
      speakers,
      langLabel,
      meetingTitle: opts.meetingTitle,
    });
    return { text: formatDialogueLines(lines), lines };
  }

  const raw = (opts.rawText || '').trim();
  if (raw.length < 20) {
    return { text: raw, lines: raw ? [{ speaker: speakers[0] || 'Participante', text: raw }] : [] };
  }

  const chunks = splitForPolish(raw);
  const lines: PolishedDialogueLine[] = [];
  let carrySpeaker: string | null = null;

  for (let i = 0; i < chunks.length; i += 1) {
    const part = await polishRawChunk({
      chunk: chunks[i]!,
      speakers,
      langLabel,
      meetingTitle: opts.meetingTitle,
      carrySpeaker,
      chunkIndex: i,
      chunkTotal: chunks.length,
    });
    for (const line of part) {
      lines.push(line);
      carrySpeaker = line.speaker;
    }
  }

  if (lines.length === 0) {
    return {
      text: raw,
      lines: [{ speaker: speakers[0] || 'Participante', text: raw }],
    };
  }

  return { text: formatDialogueLines(lines), lines };
}

export function formatDialogueLines(lines: PolishedDialogueLine[]): string {
  return lines
    .map((l) => {
      const text = l.text.trim();
      if (!text) return '';
      if (typeof l.startSec === 'number' && Number.isFinite(l.startSec) && l.startSec > 0) {
        const m = Math.floor(l.startSec / 60);
        const s = Math.floor(l.startSec % 60)
          .toString()
          .padStart(2, '0');
        return `[${m}:${s}] ${l.speaker}: ${text}`;
      }
      return `${l.speaker}: ${text}`;
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function splitForPolish(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > CHUNK_CHARS) {
    let cut = rest.lastIndexOf('. ', CHUNK_CHARS);
    if (cut < CHUNK_CHARS * 0.4) cut = rest.lastIndexOf(' ', CHUNK_CHARS);
    if (cut < CHUNK_CHARS * 0.3) cut = CHUNK_CHARS;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts.filter(Boolean);
}

async function polishRawChunk(opts: {
  chunk: string;
  speakers: string[];
  langLabel: string;
  meetingTitle?: string | null;
  carrySpeaker: string | null;
  chunkIndex: number;
  chunkTotal: number;
}): Promise<PolishedDialogueLine[]> {
  const speakerHint =
    opts.speakers.length > 0
      ? `Participantes conhecidos (usa estes nomes quando baterem): ${JSON.stringify(opts.speakers)}`
      : 'Não há lista de participantes — infere nomes só se forem ditos claramente no texto (ex. alguém se dirige a "Tiago" ou "Beatriz"); senão usa Falante 1, Falante 2, … de forma consistente.';

  const raw = await meetCompleteJsonText(
    'És o editor de actas CHORUS. Devolves só JSON válido. Nunca inventas factos.',
    `Converte este excerto de STT bruto numa sequência de FALAS de diálogo legível.

Lote ${opts.chunkIndex + 1}/${opts.chunkTotal}.
Idioma de saída: ${opts.langLabel} (mantém o idioma do excerto).
${opts.meetingTitle ? `Reunião: ${opts.meetingTitle}\n` : ''}${speakerHint}
${opts.carrySpeaker ? `O último falante do lote anterior foi: ${opts.carrySpeaker}\n` : ''}

REGRAS OBRIGATÓRIAS:
1. NÃO inventes conteúdo que não esteja no excerto (nem visitas, nomes, números ou decisões novas).
2. Corrige pontuação e limites de frase para se ler como diálogo oral limpo.
3. Separa turnos de falantes (quando há mudança clara de voz/interlocutor no texto).
4. Remove muletas vazias excessivas (eh, este, este este) sem apagar sentido.
5. Mantém nomes próprios, lugares e números tal como no texto (corrige só ortografia óbvia se o contexto for claro).
6. Cada "text" deve ser 1–3 frases completas quando possível.
7. Responde APENAS JSON.

Excerto STT:
"""
${opts.chunk.slice(0, 12_000)}
"""

Formato:
{"lines":[{"speaker":"Nome","text":"Frase completa."}]}`,
    { maxOutputTokens: 8192 },
  );

  return parseLinesJson(raw, opts.speakers, opts.carrySpeaker);
}

async function polishUtteranceBatches(opts: {
  utterances: DiarizedUtterance[];
  speakers: string[];
  langLabel: string;
  meetingTitle?: string | null;
}): Promise<PolishedDialogueLine[]> {
  const out: PolishedDialogueLine[] = [];
  const batchSize = 40;
  for (let i = 0; i < opts.utterances.length; i += batchSize) {
    const batch = opts.utterances.slice(i, i + batchSize);
    const packed = batch
      .map(
        (u, idx) =>
          `#${i + idx} [${u.startSec.toFixed(0)}s] ${u.speaker}: ${u.text}`,
      )
      .join('\n')
      .slice(0, 14_000);

    const raw = await meetCompleteJsonText(
      'És o editor de actas CHORUS. Devolves só JSON válido. Nunca inventas factos.',
      `Limpa estas falas já segmentadas para diálogo legível (pontuação + frases).

Idioma: ${opts.langLabel}.
${opts.meetingTitle ? `Reunião: ${opts.meetingTitle}\n` : ''}Participantes: ${JSON.stringify(opts.speakers.length ? opts.speakers : ['mantém os speakers dados'])}

REGRAS:
- Mantém o mesmo id (#n) e o mesmo speaker (podes normalizar ortografia do nome).
- Reescreve só a clareza do "text" — sem adicionar factos.
- Junta fragmentos do MESMO speaker consecutivos se forem a mesma ideia (devolve menos linhas se necessário, mas preserva ordem temporal).
- Responde APENAS JSON.

Falas:
${packed}

Formato:
{"lines":[{"speaker":"Nome","text":"…","startSec":0}]}`,
      { maxOutputTokens: 8192 },
    );

    const parsed = parseLinesJson(raw, opts.speakers, out[out.length - 1]?.speaker || null);
    if (parsed.length === 0) {
      for (const u of batch) {
        out.push({ speaker: u.speaker, text: u.text, startSec: u.startSec });
      }
    } else {
      out.push(...parsed);
    }
  }
  return out;
}

function parseLinesJson(
  raw: string,
  speakers: string[],
  carrySpeaker: string | null,
): PolishedDialogueLine[] {
  const jsonStr = extractFirstJsonObject(raw) ?? raw.trim();
  try {
    const parsed = JSON.parse(jsonStr) as { lines?: unknown };
    if (!Array.isArray(parsed.lines)) return [];
    const lines: PolishedDialogueLine[] = [];
    for (const row of parsed.lines) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      let speaker = typeof o.speaker === 'string' ? o.speaker.trim() : '';
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      if (!text) continue;
      if (!speaker) speaker = carrySpeaker || speakers[0] || 'Participante';
      if (speakers.length) {
        const match =
          speakers.find((s) => s.toLowerCase() === speaker.toLowerCase()) ||
          speakers.find((s) => speaker.toLowerCase().includes(s.toLowerCase()));
        if (match) speaker = match;
      }
      const startSec =
        typeof o.startSec === 'number'
          ? o.startSec
          : typeof o.startSec === 'string'
            ? Number(o.startSec)
            : undefined;
      lines.push({
        speaker: speaker.slice(0, 80),
        text: text.slice(0, 4000),
        startSec: Number.isFinite(startSec) ? startSec : undefined,
      });
      carrySpeaker = speaker;
    }
    return lines;
  } catch {
    return [];
  }
}
