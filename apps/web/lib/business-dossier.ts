import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { parseCompanySectorIds, normalizeSectorIdList } from './nexus-economic-sectors';
import { listEngagementsForTenant } from './nexus-at';
import {
  AURORA_STAGE_ORDER,
  auroraMethodStage,
  collectAttendedBusinesses,
  type AuroraPortfolioItem,
} from './aurora-portfolio';
import { readAuroraTech } from './aurora-interview';
import { auroraDueSoon } from './aurora-week';

export {
  AURORA_RHYTHM_STALE_MS,
  AURORA_STAGE_ORDER,
  auroraMethodStage,
  collectAttendedBusinesses,
} from './aurora-portfolio';
export type { AuroraAttendedBusiness, AuroraMethodStage, AuroraPortfolioItem } from './aurora-portfolio';

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

function radarModuleFromSectors(ids: string[]): string | null {
  const lower = ids.map((s) => s.toLowerCase());
  if (lower.some((s) => s.includes('carbon') || s.includes('decarbon'))) return 'carbon';
  if (lower.some((s) => s === 'livestock' || s.includes('pecu') || s.includes('cattle') || s.includes('poultry'))) {
    return 'livestock';
  }
  if (lower.some((s) => s === 'agroindustry' || s.includes('agroind'))) return 'agroindustry';
  if (lower.some((s) => s === 'agriculture' || s.includes('agri') || s.includes('crop') || s.includes('farm'))) {
    return 'agriculture';
  }
  return null;
}

function labelsFromScores(raw: unknown, evidence: string): GapOrPotential[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (typeof x === 'string' && x.trim()) return { text: x.trim(), evidence };
      if (x && typeof x === 'object') {
        const o = x as { label?: unknown; text?: unknown; name?: unknown };
        const text = String(o.label || o.text || o.name || '').trim();
        return text ? { text, evidence } : null;
      }
      return null;
    })
    .filter((x): x is GapOrPotential => Boolean(x));
}

function emptyDossier(row: { portraitText: string; gapsJson: unknown; potentialsJson: unknown; pulsoModule: string | null } | null) {
  if (!row) return true;
  return !row.portraitText.trim() && asList(row.gapsJson).length === 0 && asList(row.potentialsJson).length === 0 && !row.pulsoModule;
}

/** Preenche o dossiê a partir de diagnóstico, jornada e ops — sem apagar retrato já escrito e sem colar quiz. */
export async function hydrateDossierFromNexus(companyId: string, userId: string) {
  const existing = await prisma.businessDossier.findUnique({ where: { companyId } });
  const needsDossier = emptyDossier(existing);
  if (!needsDossier && existing?.pulsoModule) return existing;

  const [dx, venture, unit, company] = await Promise.all([
    prisma.nexusDiagnosis.findFirst({ where: { companyId }, orderBy: { createdAt: 'desc' } }),
    prisma.nexusVentureState.findFirst({ where: { companyId } }),
    prisma.nexusOpsUnit.findFirst({ where: { companyId, isActive: true }, orderBy: { updatedAt: 'desc' } }),
    prisma.company.findUnique({ where: { id: companyId }, select: { contextSetupJson: true } }),
  ]);

  const sectorIds = [
    ...normalizeSectorIdList({ sectorIds: dx?.sectorIds, sectorId: unit?.sectorId }),
    ...parseCompanySectorIds(company?.contextSetupJson),
    ...(unit?.sectorId ? [unit.sectorId] : []),
  ];
  const radarModule = existing?.pulsoModule || radarModuleFromSectors(sectorIds);

  const scores = dx?.scoresJson && typeof dx.scoresJson === 'object' ? (dx.scoresJson as Record<string, unknown>) : {};
  const gapsFromDx = labelsFromScores(scores.weaknesses ?? scores.weakAreas, 'diagnóstico NEXUS').slice(0, 5);
  const potsFromDx = labelsFromScores(scores.potentials, 'diagnóstico NEXUS').slice(0, 3);
  const notes = String(venture?.incubatorNotes || '').trim();

  let portrait = existing?.portraitText?.trim() || '';
  if (!portrait && notes) portrait = notes;

  const hypothesis = existing?.hypothesis?.trim() || '';

  if (needsDossier || !existing?.pulsoModule) {
    await upsertDossier(companyId, userId, {
      portraitText: portrait || existing?.portraitText,
      hypothesis: hypothesis || existing?.hypothesis,
      gaps: asList(existing?.gapsJson).length ? asList(existing?.gapsJson) : gapsFromDx,
      potentials: asList(existing?.potentialsJson).length ? asList(existing?.potentialsJson) : potsFromDx,
      pulsoModule: radarModule,
    });
  }

  return prisma.businessDossier.findUnique({ where: { companyId } });
}

export async function hydrateDossiersForCompanies(companyIds: string[], userId: string) {
  const unique = [...new Set(companyIds.filter(Boolean))];
  const extra = unique.length
    ? await prisma.nexusAtEngagementMember.findMany({
        where: { engagement: { operatorCompanyId: { in: unique }, isActive: true } },
        select: { companyId: true },
        take: 200,
      })
    : [];
  const all = [...new Set([...unique, ...extra.map((m) => m.companyId)])];
  let n = 0;
  for (const id of all.slice(0, 80)) {
    await hydrateDossierFromNexus(id, userId);
    n += 1;
  }
  return n;
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

/** Junta chaves novas sem apagar beats da conversa nem o fio do POLARIS. */
export function mergeInterviewJson(prev: unknown, patch: Record<string, unknown>): Record<string, unknown> {
  const base =
    prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {};
  return { ...base, ...patch };
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
    interviewJson?: Record<string, unknown> | Record<string, string>;
    pulsoModule?: string | null;
  }
) {
  const gaps = (body.gaps || []).slice(0, 5);
  const potentials = (body.potentials || []).slice(0, 3);
  let interviewJson: Prisma.InputJsonValue | undefined;
  if (body.interviewJson) {
    const prev = await prisma.businessDossier.findUnique({
      where: { companyId },
      select: { interviewJson: true },
    });
    interviewJson = JSON.parse(
      JSON.stringify(mergeInterviewJson(prev?.interviewJson, body.interviewJson as Record<string, unknown>))
    ) as Prisma.InputJsonValue;
  }
  return prisma.businessDossier.upsert({
    where: { companyId },
    create: {
      companyId,
      portraitText: body.portraitText?.slice(0, 8000) || '',
      hypothesis: body.hypothesis?.slice(0, 2000) || '',
      hypothesisAccepted: Boolean(body.hypothesisAccepted),
      gapsJson: gaps,
      potentialsJson: potentials,
      interviewJson: interviewJson ?? {},
      pulsoModule: body.pulsoModule || null,
      updatedByUserId: userId,
    },
    update: {
      portraitText: body.portraitText != null ? body.portraitText.slice(0, 8000) : undefined,
      hypothesis: body.hypothesis != null ? body.hypothesis.slice(0, 2000) : undefined,
      hypothesisAccepted: body.hypothesisAccepted,
      gapsJson: body.gaps ? gaps : undefined,
      potentialsJson: body.potentials ? potentials : undefined,
      interviewJson,
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

export async function loadAuroraPortfolio(
  tenantCompanyIds: string[],
  viewerUserId?: string,
): Promise<AuroraPortfolioItem[]> {
  const engagements = await listEngagementsForTenant(tenantCompanyIds);
  const businesses = collectAttendedBusinesses(engagements).slice(0, 80);
  const ids = businesses.map((b) => b.companyId);
  if (ids.length === 0) return [];

  const [dossiers, bets, notes] = await Promise.all([
    prisma.businessDossier.findMany({
      where: { companyId: { in: ids } },
      select: {
        companyId: true,
        portraitText: true,
        hypothesis: true,
        hypothesisAccepted: true,
        interviewJson: true,
      },
    }),
    prisma.businessBet.findMany({
      where: { companyId: { in: ids }, status: { notIn: ['done', 'dropped'] } },
      select: { companyId: true, title: true, dueAt: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.businessRhythmNote.findMany({
      where: { companyId: { in: ids } },
      orderBy: { createdAt: 'desc' },
      take: 400,
      select: { companyId: true, createdAt: true, nextStep: true, happened: true, blocked: true },
    }),
  ]);

  const dossierByCompany = new Map(dossiers.map((d) => [d.companyId, d]));
  const now = new Date();
  const betsByCompany = new Map<string, string[]>();
  const dueByCompany = new Map<string, string[]>();
  for (const bet of bets) {
    const list = betsByCompany.get(bet.companyId) || [];
    if (list.length < 4) list.push(bet.title);
    betsByCompany.set(bet.companyId, list);
    if (auroraDueSoon(bet.dueAt, now)) {
      const due = dueByCompany.get(bet.companyId) || [];
      if (due.length < 4) due.push(bet.title);
      dueByCompany.set(bet.companyId, due);
    }
  }
  const rhythmByCompany = new Map<
    string,
    { createdAt: Date; nextStep: string; happened: string; blocked: string }
  >();
  for (const note of notes) {
    if (!rhythmByCompany.has(note.companyId)) rhythmByCompany.set(note.companyId, note);
  }

  const items: AuroraPortfolioItem[] = businesses.map((b) => {
    const dossier = dossierByCompany.get(b.companyId);
    const portraitText = dossier?.portraitText?.trim() || '';
    const last = rhythmByCompany.get(b.companyId);
    const betTitles = betsByCompany.get(b.companyId) || [];
    const hasPortrait = Boolean(portraitText);
    const hypothesisAccepted = Boolean(dossier?.hypothesisAccepted);
    const tech = readAuroraTech(dossier?.interviewJson);
    const technicianUserId = tech?.userId || '';
    return {
      ...b,
      hasPortrait,
      hypothesisAccepted,
      hypothesis: String(dossier?.hypothesis || '').slice(0, 280),
      openBetCount: betTitles.length,
      betTitles,
      lastRhythmAt: last?.createdAt.toISOString() ?? null,
      lastRhythmHappened: (last?.happened || '').trim(),
      lastRhythmBlocked: (last?.blocked || '').trim(),
      lastRhythmNext: (last?.nextStep || last?.happened || '').trim(),
      portraitPreview: portraitText.slice(0, 180),
      technicianName: tech?.name || '',
      technicianUserId,
      mine: Boolean(viewerUserId && technicianUserId === viewerUserId),
      dueBetTitles: dueByCompany.get(b.companyId) || [],
      stage: auroraMethodStage({
        hasPortrait,
        hypothesisAccepted,
        openBetCount: betTitles.length,
        lastRhythmAt: last?.createdAt ?? null,
        now,
      }),
    };
  });

  items.sort((a, b) => {
    const stageDiff = AURORA_STAGE_ORDER[a.stage] - AURORA_STAGE_ORDER[b.stage];
    if (stageDiff !== 0) return stageDiff;
    const aTime = a.lastRhythmAt ? new Date(a.lastRhythmAt).getTime() : 0;
    const bTime = b.lastRhythmAt ? new Date(b.lastRhythmAt).getTime() : 0;
    return aTime - bTime;
  });
  return items;
}
