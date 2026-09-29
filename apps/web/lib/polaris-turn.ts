import { prisma } from './prisma';
import { llmCompleteJsonText, publicLlmErrorMessage } from './llm-client';
import { auroraMethodStage } from './aurora-portfolio';
import { hydrateDossierFromNexus, loadDossier, upsertDossier } from './business-dossier';
import { loadPolarisEcosystemBrief } from './polaris-context';
import {
  isCatalogPortrait,
  parsePolarisModelJson,
  polarisInterviewPatch,
  polarisOpening,
  polarisRetryReply,
  polarisSystemPrompt,
  polarisUserPayload,
  normalizePolarisDraft,
  readPolarisSuggestions,
  readPolarisThread,
  selectNewBets,
  type PolarisBetDraft,
  type PolarisLocale,
  type PolarisMessage,
} from './polaris-map';

function openBet(status: string): boolean {
  return status !== 'done' && status !== 'dropped';
}

export async function materializePolarisSuggestions(companyId: string, interviewJson: unknown, also: PolarisBetDraft[] = []) {
  const proposed = [...readPolarisSuggestions(interviewJson), ...also];
  if (!proposed.length) return 0;
  const existing = await prisma.businessBet.findMany({
    where: { companyId },
    select: { title: true, status: true, sortOrder: true },
  });
  const openCount = existing.filter((b) => openBet(b.status)).length;
  const picks = selectNewBets(
    existing.map((b) => b.title),
    proposed,
    openCount,
  );
  if (!picks.length) return 0;
  const start = existing.reduce((max, b) => Math.max(max, b.sortOrder), -1) + 1;
  await prisma.businessBet.createMany({
    data: picks.map((bet, i) => ({
      companyId,
      title: bet.title,
      why: bet.why,
      indicator: bet.indicator || null,
      status: 'proposed',
      sortOrder: start + i,
    })),
  });
  return picks.length;
}

async function companyBasics(companyId: string) {
  return prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, businessActivity: true },
  });
}

async function callPolarisModel(opts: {
  locale: PolarisLocale;
  companyName: string;
  activity: string;
  hypothesisAccepted: boolean;
  portraitText: string;
  hypothesis: string;
  stage: ReturnType<typeof auroraMethodStage>;
  gaps: { text: string; evidence?: string }[];
  potentials: { text: string; evidence?: string }[];
  bets: { title: string; status: string }[];
  lastRhythm: { happened: string; blocked: string; nextStep: string } | null;
  thread: PolarisMessage[];
  ecosystemBrief: string;
  orient?: boolean;
}) {
  let raw = '';
  try {
    raw = await llmCompleteJsonText(
      polarisSystemPrompt(opts.locale),
      polarisUserPayload({
        locale: opts.locale,
        companyName: opts.companyName,
        activity: opts.activity,
        hypothesisAccepted: opts.hypothesisAccepted,
        portraitText: opts.portraitText,
        hypothesis: opts.hypothesis,
        stage: opts.stage,
        gaps: opts.gaps,
        potentials: opts.potentials,
        bets: opts.bets,
        lastRhythm: opts.lastRhythm,
        thread: opts.thread,
        ecosystemBrief: opts.ecosystemBrief,
        orient: opts.orient,
      }),
      { maxOutputTokens: 2048 },
    );
  } catch (e) {
    console.error('[polaris] turn failed', e);
    throw new Error(publicLlmErrorMessage(e));
  }

  let draft = normalizePolarisDraft({ reply: polarisRetryReply(opts.locale) }, opts.locale);
  try {
    draft = normalizePolarisDraft(parsePolarisModelJson(raw), opts.locale);
  } catch (e) {
    console.error('[polaris] draft parse failed', e);
  }
  return draft;
}

async function persistPolarisDraft(opts: {
  companyId: string;
  userId: string;
  thread: PolarisMessage[];
  draft: ReturnType<typeof normalizePolarisDraft>;
  accepted: boolean;
}) {
  const messages: PolarisMessage[] = [...opts.thread, { role: 'assistant', text: opts.draft.reply }].slice(-30);
  const writeMap = opts.draft.ready && (!opts.accepted || opts.draft.revise);

  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: polarisInterviewPatch(messages, opts.draft.bets),
    portraitText: writeMap && opts.draft.portraitText ? opts.draft.portraitText : undefined,
    hypothesis: writeMap && opts.draft.hypothesis ? opts.draft.hypothesis : undefined,
    gaps: writeMap && opts.draft.gaps.length ? opts.draft.gaps : undefined,
    potentials: writeMap && opts.draft.potentials.length ? opts.draft.potentials : undefined,
  });

  if (opts.accepted && opts.draft.bets.length) {
    const saved = await loadDossier(opts.companyId);
    await materializePolarisSuggestions(opts.companyId, saved.dossier?.interviewJson, opts.draft.bets);
  }

  const fresh = await loadDossier(opts.companyId);
  return {
    ok: true as const,
    reply: opts.draft.reply,
    ready: writeMap,
    messages,
    suggestions: readPolarisSuggestions(fresh.dossier?.interviewJson),
    rhythmSuggestion: opts.draft.rhythmSuggestion,
    portraitText: fresh.dossier?.portraitText || '',
    hypothesis: fresh.dossier?.hypothesis || '',
    hypothesisAccepted: Boolean(fresh.dossier?.hypothesisAccepted),
    gaps: fresh.dossier?.gaps || [],
    potentials: fresh.dossier?.potentials || [],
    bets: fresh.bets,
    rhythm: fresh.rhythm,
  };
}

/** Primeiro turno: a IA do sistema fala com base no ecossistema — a pessoa ainda não escreveu. */
export async function runPolarisOrient(opts: { companyId: string; userId: string; locale: PolarisLocale }) {
  await hydrateDossierFromNexus(opts.companyId, opts.userId);
  const [company, loaded, ecosystemBrief] = await Promise.all([
    companyBasics(opts.companyId),
    loadDossier(opts.companyId),
    loadPolarisEcosystemBrief(opts.companyId),
  ]);

  const prior = readPolarisThread(loaded.dossier?.interviewJson);
  if (prior.length > 0) {
    return {
      ok: true as const,
      reply: prior[prior.length - 1]?.role === 'assistant' ? prior[prior.length - 1].text : polarisOpening(opts.locale),
      ready: false,
      messages: prior,
      suggestions: readPolarisSuggestions(loaded.dossier?.interviewJson),
      rhythmSuggestion: null,
      portraitText: isCatalogPortrait(loaded.dossier?.portraitText || '') ? '' : loaded.dossier?.portraitText || '',
      hypothesis: isCatalogPortrait(loaded.dossier?.portraitText || '') ? '' : loaded.dossier?.hypothesis || '',
      hypothesisAccepted: Boolean(loaded.dossier?.hypothesisAccepted),
      gaps: loaded.dossier?.gaps || [],
      potentials: loaded.dossier?.potentials || [],
      bets: loaded.bets,
      rhythm: loaded.rhythm,
    };
  }

  const last = loaded.rhythm[0];
  const rawPortrait = loaded.dossier?.portraitText || '';
  const screenPortrait = isCatalogPortrait(rawPortrait) ? '' : rawPortrait;
  const screenHypothesis = isCatalogPortrait(rawPortrait) ? '' : loaded.dossier?.hypothesis || '';
  const stage = auroraMethodStage({
    hasPortrait: Boolean(screenPortrait.trim()),
    hypothesisAccepted: Boolean(loaded.dossier?.hypothesisAccepted),
    openBetCount: loaded.bets.filter((b) => openBet(b.status)).length,
    lastRhythmAt: last?.createdAt ?? null,
  });

  const draft = await callPolarisModel({
    locale: opts.locale,
    companyName: company?.name || '',
    activity: String(company?.businessActivity || '').slice(0, 500),
    hypothesisAccepted: Boolean(loaded.dossier?.hypothesisAccepted),
    portraitText: screenPortrait,
    hypothesis: screenHypothesis,
    stage,
    gaps: loaded.dossier?.gaps || [],
    potentials: loaded.dossier?.potentials || [],
    bets: loaded.bets.map((b) => ({ title: b.title, status: b.status })),
    lastRhythm: last ? { happened: last.happened, blocked: last.blocked, nextStep: last.nextStep } : null,
    thread: [],
    ecosystemBrief,
    orient: true,
  });

  return persistPolarisDraft({
    companyId: opts.companyId,
    userId: opts.userId,
    thread: [],
    draft,
    accepted: Boolean(loaded.dossier?.hypothesisAccepted),
  });
}

export async function runPolarisTurn(opts: {
  companyId: string;
  userId: string;
  message: string;
  locale: PolarisLocale;
  screenPortrait?: string;
  screenHypothesis?: string;
}) {
  const message = opts.message.trim().slice(0, 4000);
  if (message.length < 1) throw new Error('polaris:empty');

  const [company, loaded, ecosystemBrief] = await Promise.all([
    companyBasics(opts.companyId),
    loadDossier(opts.companyId),
    loadPolarisEcosystemBrief(opts.companyId),
  ]);

  const prior = readPolarisThread(loaded.dossier?.interviewJson);
  const thread: PolarisMessage[] = [
    ...(prior.length ? prior : [{ role: 'assistant' as const, text: polarisOpening(opts.locale) }]),
    { role: 'user', text: message },
  ].slice(-30);

  const last = loaded.rhythm[0];
  const rawPortrait = opts.screenPortrait != null ? opts.screenPortrait : loaded.dossier?.portraitText || '';
  const screenPortrait = isCatalogPortrait(rawPortrait) ? '' : rawPortrait;
  const screenHypothesis = isCatalogPortrait(rawPortrait)
    ? ''
    : opts.screenHypothesis != null
      ? opts.screenHypothesis
      : loaded.dossier?.hypothesis || '';
  const stage = auroraMethodStage({
    hasPortrait: Boolean(screenPortrait.trim()),
    hypothesisAccepted: Boolean(loaded.dossier?.hypothesisAccepted),
    openBetCount: loaded.bets.filter((b) => openBet(b.status)).length,
    lastRhythmAt: last?.createdAt ?? null,
  });

  const draft = await callPolarisModel({
    locale: opts.locale,
    companyName: company?.name || '',
    activity: String(company?.businessActivity || '').slice(0, 500),
    hypothesisAccepted: Boolean(loaded.dossier?.hypothesisAccepted),
    portraitText: screenPortrait,
    hypothesis: screenHypothesis,
    stage,
    gaps: loaded.dossier?.gaps || [],
    potentials: loaded.dossier?.potentials || [],
    bets: loaded.bets.map((b) => ({ title: b.title, status: b.status })),
    lastRhythm: last ? { happened: last.happened, blocked: last.blocked, nextStep: last.nextStep } : null,
    thread,
    ecosystemBrief,
  });

  return persistPolarisDraft({
    companyId: opts.companyId,
    userId: opts.userId,
    thread,
    draft,
    accepted: Boolean(loaded.dossier?.hypothesisAccepted),
  });
}
