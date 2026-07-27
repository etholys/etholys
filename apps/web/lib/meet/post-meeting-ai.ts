import 'server-only';

import { geminiCompleteJsonText } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';

export type MeetAiActionDraft = {
  title: string;
  notes?: string;
  assigneeHint?: string;
  dueHint?: string | null;
};

export type MeetAiFinalizeResult = {
  summary: string;
  decisions: string[];
  nextSteps: string[];
  actionItems: MeetAiActionDraft[];
};

function buildPrompt(opts: {
  title: string;
  mirror: string;
  projectName?: string | null;
  notes: string;
  locale?: string;
}): string {
  const lang =
    opts.locale === 'pt' ? 'português do Brasil' : opts.locale === 'en' ? 'English' : 'español';

  return `És um assistente de pós-reunião do Etholys (gestão de projetos e capacitações).

Reunião: "${opts.title}"
Contexto: mirror=${opts.mirror}${opts.projectName ? `, projeto SIEP="${opts.projectName}"` : ''}

Com base nas notas/transcrição abaixo, extrai:
1) resumo executivo curto
2) decisões tomadas
3) próximos passos narrativos
4) tarefas concretas (action items) para validação humana — NÃO inventes factos; só o que estiver implícito ou explícito nas notas

Responde APENAS JSON válido (sem markdown), campos em ${lang}:
{
  "summary": "string",
  "decisions": ["..."],
  "nextSteps": ["..."],
  "actionItems": [
    { "title": "tarefa curta e acionável", "notes": "opcional", "assigneeHint": "nome ou email se mencionado", "dueHint": "ISO date ou null" }
  ]
}

Máximo 12 actionItems. Se as notas forem pobres, devolve poucas tarefas e um summary honesto.

NOTAS / TRANSCRIÇÃO:
---
${opts.notes.slice(0, 24000)}
---`;
}

export async function generateMeetPostMeetingAi(opts: {
  title: string;
  mirror: string;
  projectName?: string | null;
  notes: string;
  locale?: string;
}): Promise<MeetAiFinalizeResult> {
  const notes = opts.notes.trim();
  if (notes.length < 20) {
    throw new Error('Notas/transcrição demasiado curtas (mín. ~20 caracteres)');
  }

  const raw = await geminiCompleteJsonText(
    'Devolves apenas JSON válido para pós-reunião Etholys Meet.',
    buildPrompt({ ...opts, notes }),
    { maxOutputTokens: 4096 },
  );

  const jsonStr = extractFirstJsonObject(raw) ?? raw.trim();
  let parsed: Partial<MeetAiFinalizeResult>;
  try {
    parsed = JSON.parse(jsonStr) as Partial<MeetAiFinalizeResult>;
  } catch {
    throw new Error('IA não devolveu JSON válido');
  }

  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  const decisions = Array.isArray(parsed.decisions)
    ? parsed.decisions.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
    : [];
  const nextSteps = Array.isArray(parsed.nextSteps)
    ? parsed.nextSteps.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean)
    : [];

  const actionItems: MeetAiActionDraft[] = [];
  if (Array.isArray(parsed.actionItems)) {
    for (const item of parsed.actionItems.slice(0, 12)) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const title = typeof o.title === 'string' ? o.title.trim() : '';
      if (!title) continue;
      actionItems.push({
        title: title.slice(0, 200),
        notes: typeof o.notes === 'string' ? o.notes.trim().slice(0, 2000) : undefined,
        assigneeHint:
          typeof o.assigneeHint === 'string' ? o.assigneeHint.trim().slice(0, 200) : undefined,
        dueHint: typeof o.dueHint === 'string' && o.dueHint.trim() ? o.dueHint.trim() : null,
      });
    }
  }

  const composedSummary = [
    summary || '(Sem resumo)',
    decisions.length ? `\nDecisões:\n- ${decisions.join('\n- ')}` : '',
    nextSteps.length ? `\nPróximos passos:\n- ${nextSteps.join('\n- ')}` : '',
  ]
    .join('')
    .trim();

  return {
    summary: composedSummary,
    decisions,
    nextSteps,
    actionItems,
  };
}
