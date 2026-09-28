import { prisma } from './prisma';

export type GapOrPotential = { text: string; evidence?: string };

function asList(raw: unknown): GapOrPotential[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === 'string' && x.trim()) return { text: x.trim() };
      if (x && typeof x === 'object' && typeof (x as { text?: unknown }).text === 'string') {
        const text = String((x as { text: string }).text).trim();
        if (!text) return null;
        const evidence = String((x as { evidence?: string }).evidence || '').trim();
        return { text, evidence: evidence || undefined };
      }
      return null;
    })
    .filter((x): x is GapOrPotential => Boolean(x))
    .slice(0, 8);
}

export async function loadDossier(companyId: string) {
  const [dossier, bets, rhythm] = await Promise.all([
    prisma.businessDossier.findUnique({ where: { companyId } }),
    prisma.businessBet.findMany({ where: { companyId }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
    prisma.businessRhythmNote.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' }, take: 12 }),
  ]);
  return {
    dossier: dossier
      ? {
          ...dossier,
          gaps: asList(dossier.gapsJson).slice(0, 5),
          potentials: asList(dossier.potentialsJson).slice(0, 3),
        }
      : null,
    bets,
    rhythm,
  };
}

export async function upsertDossier(
  companyId: string,
  userId: string,
  body: {
    portraitText?: string;
    hypothesis?: string;
    hypothesisAccepted?: boolean;
    gaps?: GapOrPotential[];
    potentials?: GapOrPotential[];
    interviewJson?: Record<string, string>;
    pulsoModule?: string | null;
  }
) {
  const gaps = (body.gaps || []).slice(0, 5);
  const potentials = (body.potentials || []).slice(0, 3);
  return prisma.businessDossier.upsert({
    where: { companyId },
    create: {
      companyId,
      portraitText: body.portraitText?.slice(0, 8000) || '',
      hypothesis: body.hypothesis?.slice(0, 2000) || '',
      hypothesisAccepted: Boolean(body.hypothesisAccepted),
      gapsJson: gaps,
      potentialsJson: potentials,
      interviewJson: body.interviewJson || {},
      pulsoModule: body.pulsoModule || null,
      updatedByUserId: userId,
    },
    update: {
      portraitText: body.portraitText != null ? body.portraitText.slice(0, 8000) : undefined,
      hypothesis: body.hypothesis != null ? body.hypothesis.slice(0, 2000) : undefined,
      hypothesisAccepted: body.hypothesisAccepted,
      gapsJson: body.gaps ? gaps : undefined,
      potentialsJson: body.potentials ? potentials : undefined,
      interviewJson: body.interviewJson,
      pulsoModule: body.pulsoModule === undefined ? undefined : body.pulsoModule,
      updatedByUserId: userId,
    },
  });
}

export function draftPortraitFromInterview(answers: Record<string, string>, locale: 'es' | 'pt' | 'en'): {
  portraitText: string;
  hypothesis: string;
  gaps: GapOrPotential[];
  potentials: GapOrPotential[];
} {
  const doWhat = answers.do?.trim() || '';
  const money = answers.money?.trim() || '';
  const deliver = answers.deliver?.trim() || '';
  const stuck = answers.stuck?.trim() || '';
  const works = answers.works?.trim() || '';

  const portraitText =
    locale === 'es'
      ? [doWhat && `Hace: ${doWhat}`, money && `Dinero: ${money}`, deliver && `Entrega: ${deliver}`]
          .filter(Boolean)
          .join('\n\n')
      : locale === 'en'
        ? [doWhat && `Does: ${doWhat}`, money && `Money: ${money}`, deliver && `Delivers: ${deliver}`]
            .filter(Boolean)
            .join('\n\n')
        : [doWhat && `Faz: ${doWhat}`, money && `Dinheiro: ${money}`, deliver && `Entrega: ${deliver}`]
            .filter(Boolean)
            .join('\n\n');

  const hypothesis =
    locale === 'es'
      ? stuck
        ? `El freno principal parece ser: ${stuck}.${works ? ` El empuje está en: ${works}` : ''}`
        : works
          ? `Hay base para empujar: ${works}`
          : ''
      : locale === 'en'
        ? stuck
          ? `The main brake seems to be: ${stuck}.${works ? ` The pull is: ${works}` : ''}`
          : works
            ? `There is a base to push: ${works}`
            : ''
        : stuck
          ? `O travão principal parece ser: ${stuck}.${works ? ` O puxão está em: ${works}` : ''}`
          : works
            ? `Há base para puxar: ${works}`
            : '';

  return {
    portraitText,
    hypothesis,
    gaps: stuck ? [{ text: stuck, evidence: 'conversa' }] : [],
    potentials: works ? [{ text: works, evidence: 'conversa' }] : [],
  };
}
