import 'server-only';

import { canUseMeetAiEnhancement } from '@/lib/meet/ai-gate';
import type { DiarizedUtterance } from '@/lib/meet/diarize';
import {
  formatDialogueFromRawText,
  formatDialogueFromUtterances,
  type ClassicDialogueLine,
} from '@/lib/meet/format-dialogue-classic';
import { polishMeetTranscriptToDialogue } from '@/lib/meet/polish-dialogue';
import {
  estimateLineTimestamps,
  resolveGenericSpeakers,
} from '@/lib/meet/resolve-speakers-classic';
import { formatDiarizedTranscript } from '@/lib/meet/diarize-merge';

export type MeetDialogueResult = {
  text: string;
  lines: ClassicDialogueLine[];
  enhanced: boolean;
};

function finalizeClassicLines(
  lines: ClassicDialogueLine[],
  participants: string[],
): { text: string; lines: ClassicDialogueLine[] } {
  const named = resolveGenericSpeakers(lines, participants);
  const timed = estimateLineTimestamps(named);
  const asUtt = timed.map((l) => ({
    speaker: l.speaker,
    text: l.text,
    startSec: l.startSec ?? 0,
    endSec: l.endSec ?? (l.startSec ?? 0) + 4,
  }));
  return {
    text: formatDiarizedTranscript(asUtt),
    lines: timed,
  };
}

/**
 * Diálogo final: clássico (nomes + minutagem + limpeza) sempre;
 * polish LLM (Anthropic/Gemini) só se Camada B disponível.
 */
export async function buildMeetDialogue(opts: {
  rawText: string;
  utterances?: DiarizedUtterance[];
  participants: string[];
  locale?: string;
  languageHint?: string;
  meetingTitle?: string;
  companyId?: string;
}): Promise<MeetDialogueResult> {
  const base =
    opts.utterances && opts.utterances.length > 0
      ? formatDialogueFromUtterances(opts.utterances)
      : formatDialogueFromRawText(opts.rawText, opts.participants);

  const classic = finalizeClassicLines(base.lines, opts.participants);

  if (!canUseMeetAiEnhancement({ companyId: opts.companyId })) {
    return { ...classic, enhanced: false };
  }

  try {
    const polished = await polishMeetTranscriptToDialogue({
      rawText: classic.text || opts.rawText,
      utterances: opts.utterances,
      participants: opts.participants,
      locale: opts.locale,
      languageHint: opts.languageHint,
      meetingTitle: opts.meetingTitle,
    });
    if (polished.lines.length === 0) {
      return { ...classic, enhanced: false };
    }
    const refined = finalizeClassicLines(
      polished.lines.map((l) => ({
        speaker: l.speaker,
        text: l.text,
        startSec: l.startSec,
      })),
      opts.participants,
    );
    return { ...refined, enhanced: true };
  } catch (err) {
    console.error('[meet/dialogue] AI layer skipped, using classic', err);
    return { ...classic, enhanced: false };
  }
}
