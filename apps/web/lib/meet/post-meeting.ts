import 'server-only';

import { canUseMeetAiEnhancement } from '@/lib/meet/ai-gate';
import { generateMeetPostMeetingClassic } from '@/lib/meet/post-meeting-classic';
import {
  generateMeetPostMeetingAi,
  type MeetAiFinalizeResult,
} from '@/lib/meet/post-meeting-ai';

export type MeetPostMeetingResult = MeetAiFinalizeResult & {
  /** true se a capa de IA foi aplicada com sucesso */
  enhanced: boolean;
};

/**
 * Pós-reunião: Camada A sempre; Camada B (IA) só se créditos/chave OK.
 * Em falha da B, devolve A — o utilizador não precisa saber.
 */
export async function generateMeetPostMeeting(opts: {
  title: string;
  mirror: string;
  projectName?: string | null;
  notes: string;
  locale?: string;
  participants?: string[];
  companyId?: string;
}): Promise<MeetPostMeetingResult> {
  const classic = generateMeetPostMeetingClassic({
    title: opts.title,
    notes: opts.notes,
    locale: opts.locale,
    participants: opts.participants,
  });

  if (!canUseMeetAiEnhancement({ companyId: opts.companyId })) {
    return { ...classic, enhanced: false };
  }

  try {
    const ai = await generateMeetPostMeetingAi({
      title: opts.title,
      mirror: opts.mirror,
      projectName: opts.projectName,
      notes: opts.notes,
      locale: opts.locale,
    });
    // Capa: preferir resultado enriquecido; se vier vazio demais, manter A
    if ((ai.summary || '').trim().length < 40 && classic.summary.length >= 40) {
      return { ...classic, enhanced: false };
    }
    return { ...ai, enhanced: true };
  } catch (err) {
    console.error('[meet/post-meeting] AI layer skipped, using classic', err);
    return { ...classic, enhanced: false };
  }
}
