import 'server-only';

import { geminiCompleteJsonText } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';

export type MeetLiveBriefing = {
  themes: string[];
  openDecisions: string[];
  suggestedNextSteps: string[];
  alert: string;
};

/**
 * Briefing leve *durante* a reunião (F5) — hipóteses, não cria tarefas ainda.
 */
export async function generateMeetLiveBriefing(opts: {
  title: string;
  notesSoFar: string;
  locale?: string;
}): Promise<MeetLiveBriefing> {
  const notes = opts.notesSoFar.trim();
  if (notes.length < 15) {
    throw new Error('Notas demasiado curtas para briefing');
  }

  const lang =
    opts.locale === 'pt' ? 'português' : opts.locale === 'en' ? 'English' : 'español';

  const prompt = `És um facilitador Etholys Meet. A reunião "${opts.title}" ainda está a decorrer.
Com base nas notas parciais, devolve um alerta curto de encaminhamento (hipóteses — NÃO criar tarefas).

Responde APENAS JSON em ${lang}:
{
  "themes": ["tema1", "tema2"],
  "openDecisions": ["decisão ainda aberta"],
  "suggestedNextSteps": ["possível próximo passo"],
  "alert": "1-3 frases: para onde a reunião está a ir e o que convém fechar"
}

NOTAS PARCIAIS:
---
${notes.slice(0, 12000)}
---`;

  const raw = await geminiCompleteJsonText(
    'JSON válido apenas — briefing em curso de reunião.',
    prompt,
    { maxOutputTokens: 2048 },
  );

  const jsonStr = extractFirstJsonObject(raw) ?? raw.trim();
  const parsed = JSON.parse(jsonStr) as Partial<MeetLiveBriefing>;

  return {
    themes: Array.isArray(parsed.themes)
      ? parsed.themes.filter((x): x is string => typeof x === 'string').slice(0, 8)
      : [],
    openDecisions: Array.isArray(parsed.openDecisions)
      ? parsed.openDecisions.filter((x): x is string => typeof x === 'string').slice(0, 8)
      : [],
    suggestedNextSteps: Array.isArray(parsed.suggestedNextSteps)
      ? parsed.suggestedNextSteps.filter((x): x is string => typeof x === 'string').slice(0, 8)
      : [],
    alert: typeof parsed.alert === 'string' ? parsed.alert.trim() : '',
  };
}
