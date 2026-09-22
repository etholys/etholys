import 'server-only';

import { prisma } from '@/lib/prisma';
import type { ScanCandidate } from '@/lib/opportunity/scan-types';

export const FEEDBACK_MEMORY_CATEGORY = 'opportunity_feedback';

/** Acção de aprendizagem — distinto do que acontece na UI da varredura. */
export const LEARNING_ACTIONS = [
  'like', // guardado — procurar mais assim
  'not_now', // não agora / outra estratégia neste momento
  'reject_type', // não queremos este tipo (com motivo)
] as const;
export type LearningAction = (typeof LEARNING_ACTIONS)[number];

export const REJECT_REASONS = [
  'loan_not_grant',
  'amount_wrong',
  'geography',
  'theme',
  'eligibility',
  'closed_or_stale',
  'low_quality',
  'other',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const LIKE_REASONS = [
  'theme_fit',
  'size_fit',
  'geography_fit',
  'instrument_fit',
  'partner_fit',
  'more_like_this',
] as const;
export type LikeReason = (typeof LIKE_REASONS)[number];

export type OpportunityFeedbackEntry = {
  id: string;
  at: string;
  action: LearningAction;
  candidateName: string;
  institution: string;
  type?: string;
  sectors?: string;
  countries?: string;
  amount?: number;
  reasons?: string[];
  note?: string;
  weight: number; // like=2, reject_type=2, not_now=0 (não envenena)
};

function entryId() {
  return `fb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function recordOpportunityFeedback(opts: {
  companyId: string;
  userId: string;
  candidate: ScanCandidate;
  action: LearningAction;
  reasons?: string[];
  note?: string;
}): Promise<OpportunityFeedbackEntry> {
  const entry: OpportunityFeedbackEntry = {
    id: entryId(),
    at: new Date().toISOString(),
    action: opts.action,
    candidateName: opts.candidate.name,
    institution: opts.candidate.institution,
    type: opts.candidate.type,
    sectors: opts.candidate.sectors ?? opts.candidate.category,
    countries: opts.candidate.eligibleCountries ?? opts.candidate.countries,
    amount: opts.candidate.amount,
    reasons: opts.reasons?.slice(0, 6),
    note: opts.note?.trim().slice(0, 500) || undefined,
    weight: opts.action === 'not_now' ? 0 : 2,
  };

  const key = `item_${entry.id}`;
  await prisma.aiCompanyMemory.create({
    data: {
      companyId: opts.companyId,
      category: FEEDBACK_MEMORY_CATEGORY,
      key,
      value: JSON.stringify(entry),
      source: `user:${opts.userId}`,
    },
  });

  return entry;
}

export async function listOpportunityFeedback(
  companyId: string,
  take = 40,
): Promise<OpportunityFeedbackEntry[]> {
  const rows = await prisma.aiCompanyMemory.findMany({
    where: { companyId, category: FEEDBACK_MEMORY_CATEGORY },
    orderBy: { createdAt: 'desc' },
    take,
  });
  const out: OpportunityFeedbackEntry[] = [];
  for (const row of rows) {
    try {
      out.push(JSON.parse(row.value) as OpportunityFeedbackEntry);
    } catch {
      // skip
    }
  }
  return out;
}

/** Texto para o prompt de descoberta. */
export async function buildFeedbackLearningBlock(companyId: string): Promise<string> {
  const feedback = await listOpportunityFeedback(companyId, 50);
  if (feedback.length === 0) return '';

  const likes = feedback.filter((f) => f.action === 'like');
  const rejects = feedback.filter((f) => f.action === 'reject_type');
  // not_now intencionalmente fora — não ensina a evitar o tipo

  const lines: string[] = [
    'APRENDIZAGEM DO UTILIZADOR (respeitar com prioridade):',
    '- «like» = procurar mais oportunidades SEMELHANTES.',
    '- «reject_type» = evitar este TIPO de fundo (instrumento/tema/geografia/elegibilidade).',
    '- Descartes «não agora» NÃO entram aqui — são só timing/estratégia pontual.',
  ];

  if (likes.length) {
    lines.push('Exemplos POSITIVOS (mais assim):');
    for (const f of likes.slice(0, 12)) {
      const bits = [
        f.candidateName,
        f.institution,
        f.type,
        f.sectors,
        f.countries,
        f.amount != null ? `~${f.amount} ${'USD'}` : '',
        f.reasons?.length ? `motivos: ${f.reasons.join(',')}` : '',
        f.note ? `nota: ${f.note}` : '',
      ].filter(Boolean);
      lines.push(`- ${bits.join(' | ')}`);
    }
  }

  if (rejects.length) {
    lines.push('Rejeições de TIPO (evitar padrões semelhantes):');
    for (const f of rejects.slice(0, 12)) {
      const bits = [
        f.candidateName,
        f.institution,
        f.type,
        f.reasons?.length ? `porque: ${f.reasons.join(',')}` : '',
        f.note ? `nota: ${f.note}` : '',
      ].filter(Boolean);
      lines.push(`- ${bits.join(' | ')}`);
    }
  }

  return lines.join('\n');
}
