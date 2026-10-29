import 'server-only';

import { extractFirstJsonObject } from '@/lib/extract-json-object';
import { meetCompleteJsonText } from '@/lib/meet/meet-llm';

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

  return `És um editor de actas profissionais (nível Otter/Fireflies) do Etholys CHORUS.

Reunião: "${opts.title}"
Contexto: mirror=${opts.mirror}${opts.projectName ? `, projeto="${opts.projectName}"` : ''}

Produz um RECAP limpo em ${lang} — SÍNTESE, nunca copies frases STT brutas nem "Falante N".

Formato ouro (como acta executiva):
1) "summary": 1 parágrafo curto (2–5 frases) com o contexto e eixos principais.
2) "decisions": só acordos claros (frases curtas, sem citação).
3) "nextSteps": próximos passos com dono quando for claro (ex. "Confirmar com Alex…").
4) "actionItems": 3–8 tarefas imperativas ≤80 caracteres, com assigneeHint se o nome aparecer.

Responde APENAS JSON:
{
  "summary": "parágrafo executivo…",
  "decisions": ["…"],
  "nextSteps": ["… (Nome)"],
  "actionItems": [
    { "title": "tarefa curta", "notes": "opcional", "assigneeHint": "Nome", "dueHint": null }
  ]
}

Lista vazia > lixo. Não inventes factos.

TRANSCRIÇÃO:
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

  const raw = await meetCompleteJsonText(
    'Devolves apenas JSON válido para pós-reunião Etholys Meet / CHORUS.',
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

  const decH =
    opts.locale === 'en' ? 'Decisions:' : opts.locale === 'pt' ? 'Decisões:' : 'Decisiones:';
  const nextH =
    opts.locale === 'en' ? 'Next steps:' : opts.locale === 'pt' ? 'Próximos passos:' : 'Próximos passos:';

  const nextLines =
    nextSteps.length > 0
      ? nextSteps
      : actionItems.map((a) => (a.assigneeHint ? `${a.title} (${a.assigneeHint})` : a.title));

  const composedSummary = [
    summary || '(Sem resumo)',
    decisions.length ? `\n\n${decH}\n- ${decisions.join('\n- ')}` : '',
    nextLines.length ? `\n\n${nextH}\n- ${nextLines.join('\n- ')}` : '',
  ]
    .join('')
    .trim();

  return {
    summary: composedSummary,
    decisions,
    nextSteps: nextLines,
    actionItems,
  };
}
