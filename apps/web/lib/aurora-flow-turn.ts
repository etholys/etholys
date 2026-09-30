import { prisma } from './prisma';
import { loadDossier, upsertDossier } from './business-dossier';
import {
  diagProgress,
  readAuroraDiagnostic,
} from './aurora-diagnostic';
import { materializeAuroraBets } from './aurora-turn';
import type { AuroraLocale } from './aurora-interview';
import { llmCompleteJsonText } from './llm-client';
import {
  auroraFlowPatch,
  composeRadiographyFromDiagnostic,
  emptyAuroraValidation,
  normalizeAuroraBetStatus,
  proposeRouteFromDiagnostic,
  readAuroraFlow,
  readAuroraRadiography,
  readAuroraRouteChat,
  readAuroraValidation,
  resolveAuroraFlowPhase,
  type AuroraBetStatus,
  type AuroraFlowPhase,
  type AuroraRadiographyDoc,
  type AuroraRouteChatMessage,
  type AuroraValidationState,
} from './aurora-flow';
import { canAccessAtClientCompany, loadEngagementForTenant } from './nexus-at';
import { isAttendedMemberRole } from './nexus-at-shared';

async function companyNameOf(companyId: string) {
  const row = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, shortName: true },
  });
  return row?.name || row?.shortName || '';
}

/** Técnico/operador AT ou a própria empresa atendida. */
export async function canAccessAuroraFlow(
  tenantCompanyIds: string[],
  targetCompanyId: string,
  engagementId?: string | null,
): Promise<boolean> {
  return canAccessAtClientCompany(tenantCompanyIds, targetCompanyId, engagementId);
}

/** Vista do atendido: a própria MIPYME, ou operador/admin do contrato. */
export async function canViewAuroraAttended(
  userId: string,
  tenantCompanyIds: string[],
  targetCompanyId: string,
  engagementId?: string | null,
): Promise<boolean> {
  if (!targetCompanyId) return false;
  if (tenantCompanyIds.includes(targetCompanyId)) return true;
  if (!engagementId) return false;
  const engagement = await loadEngagementForTenant(engagementId, tenantCompanyIds);
  if (!engagement) return false;
  const isMember = engagement.members.some(
    (m) => m.companyId === targetCompanyId && isAttendedMemberRole(m.memberRole),
  );
  if (!isMember) return false;
  return tenantCompanyIds.includes(engagement.operatorCompanyId);
}

/** Só a incubadora/operadora do contrato AT pode mutar diagnóstico, radiografia e rota. */
export async function canMutateAuroraFlow(
  tenantCompanyIds: string[],
  targetCompanyId: string,
  engagementId?: string | null,
): Promise<boolean> {
  if (!targetCompanyId || !engagementId) return false;
  const engagement = await loadEngagementForTenant(engagementId, tenantCompanyIds);
  if (!engagement) return false;
  if (!engagement.members.some((m) => m.companyId === targetCompanyId)) return false;
  return tenantCompanyIds.includes(engagement.operatorCompanyId);
}

export async function loadAuroraFlowBundle(companyId: string) {
  const data = await loadDossier(companyId);
  const interviewJson = data.dossier?.interviewJson;
  const diagnostic = readAuroraDiagnostic(interviewJson);
  const radiography = readAuroraRadiography(interviewJson);
  const validation = readAuroraValidation(interviewJson);
  const stored = readAuroraFlow(interviewJson);
  const openBetCount = data.bets.filter((b) => b.status !== 'done' && b.status !== 'dropped').length;
  const phase = resolveAuroraFlowPhase({
    diagnostic,
    radiography,
    validation,
    openBetCount,
    stored,
  });
  return {
    companyName: await companyNameOf(companyId),
    dossier: data.dossier,
    bets: data.bets,
    rhythm: data.rhythm,
    diagnostic,
    progress: diagProgress(diagnostic),
    radiography,
    validation,
    routeChat: readAuroraRouteChat(interviewJson),
    phase,
    stored,
  };
}

export async function systematizeAuroraRadiography(opts: {
  companyId: string;
  userId: string;
  locale: AuroraLocale;
  bodyOverride?: string;
  hypothesisOverride?: string;
}) {
  const bundle = await loadAuroraFlowBundle(opts.companyId);
  if (!bundle.progress.complete) {
    throw new Error(
      opts.locale === 'es'
        ? 'Completá las 6 áreas del diagnóstico antes de sistematizar.'
        : opts.locale === 'en'
          ? 'Complete all 6 diagnostic areas before systematizing.'
          : 'Completa as 6 áreas do diagnóstico antes de sistematizar.',
    );
  }

  let doc = composeRadiographyFromDiagnostic(bundle.diagnostic, opts.locale, bundle.companyName);
  if (opts.bodyOverride?.trim()) doc = { ...doc, body: opts.bodyOverride.trim().slice(0, 12000) };
  if (opts.hypothesisOverride?.trim()) {
    doc = { ...doc, hypothesis: opts.hypothesisOverride.trim().slice(0, 2000) };
  }

  const flow = { phase: 'radio' as AuroraFlowPhase, updatedAt: new Date().toISOString() };
  await upsertDossier(opts.companyId, opts.userId, {
    portraitText: doc.body,
    hypothesis: doc.hypothesis,
    hypothesisAccepted: false,
    interviewJson: auroraFlowPatch({
      flow,
      radiography: doc,
      validation: emptyAuroraValidation(),
    }),
  });

  return loadAuroraFlowBundle(opts.companyId);
}

export async function saveAuroraRadiographyDraft(opts: {
  companyId: string;
  userId: string;
  body: string;
  hypothesis: string;
  locale: AuroraLocale;
}) {
  const bundle = await loadAuroraFlowBundle(opts.companyId);
  const prev = bundle.radiography;
  const doc: AuroraRadiographyDoc = {
    title: prev?.title || composeRadiographyFromDiagnostic(bundle.diagnostic, opts.locale, bundle.companyName).title,
    body: opts.body.trim().slice(0, 12000),
    hypothesis: opts.hypothesis.trim().slice(0, 2000),
    blockSummaries: prev?.blockSummaries || [],
    generatedAt: prev?.generatedAt || new Date().toISOString(),
    source: 'diagnostic',
  };
  if (!doc.body) throw new Error('Radiografía vacía.');

  await upsertDossier(opts.companyId, opts.userId, {
    portraitText: doc.body,
    hypothesis: doc.hypothesis,
    interviewJson: auroraFlowPatch({
      flow: { phase: 'radio', updatedAt: new Date().toISOString() },
      radiography: doc,
    }),
  });
  return loadAuroraFlowBundle(opts.companyId);
}

export async function validateAuroraRadiography(opts: {
  companyId: string;
  userId: string;
  locale: AuroraLocale;
  techNotes?: string;
  accept: boolean;
}) {
  const bundle = await loadAuroraFlowBundle(opts.companyId);
  if (!bundle.radiography?.body) {
    throw new Error(
      opts.locale === 'es'
        ? 'Primero sistematizá la radiografía.'
        : opts.locale === 'en'
          ? 'Systematize the radiography first.'
          : 'Sistematiza primeiro a radiografia.',
    );
  }

  const notes = String(opts.techNotes || '').trim().slice(0, 2000);
  const aiNotes =
    opts.locale === 'es'
      ? 'La radiografía es coherente con los 6 bloques confirmados. Se puede abrir la ruta de intervención.'
      : opts.locale === 'en'
        ? 'The radiography is consistent with the 6 confirmed blocks. An intervention route can be opened.'
        : 'A radiografia é coerente com os 6 blocos confirmados. Pode abrir-se a rota de intervenção.';

  const validation: AuroraValidationState = {
    techAccepted: opts.accept,
    aiAccepted: opts.accept,
    techNotes: notes,
    aiNotes,
    acceptedAt: opts.accept ? new Date().toISOString() : null,
  };

  const phase: AuroraFlowPhase = opts.accept ? 'route' : 'validate';
  await upsertDossier(opts.companyId, opts.userId, {
    hypothesisAccepted: opts.accept,
    hypothesis: bundle.radiography.hypothesis,
    portraitText: bundle.radiography.body,
    interviewJson: auroraFlowPatch({
      flow: { phase, updatedAt: new Date().toISOString() },
      validation,
    }),
  });

  return loadAuroraFlowBundle(opts.companyId);
}

export async function proposeAuroraRoute(opts: {
  companyId: string;
  userId: string;
  locale: AuroraLocale;
}) {
  const bundle = await loadAuroraFlowBundle(opts.companyId);
  if (!bundle.validation.techAccepted) {
    throw new Error(
      opts.locale === 'es'
        ? 'Validá la radiografía antes de proponer la ruta.'
        : opts.locale === 'en'
          ? 'Validate the radiography before proposing the route.'
          : 'Valida a radiografia antes de propor a rota.',
    );
  }
  const drafts = proposeRouteFromDiagnostic(bundle.diagnostic, opts.locale);
  const created = await materializeAuroraBets(opts.companyId, drafts, 'accepted');
  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: auroraFlowPatch({
      flow: { phase: 'route', updatedAt: new Date().toISOString() },
    }),
  });
  const fresh = await loadAuroraFlowBundle(opts.companyId);
  return { ...fresh, created };
}

export async function appendAuroraRouteChat(opts: {
  companyId: string;
  userId: string;
  locale: AuroraLocale;
  message: string;
}) {
  const message = opts.message.trim().slice(0, 4000);
  if (!message) throw new Error('Mensaje vacío.');
  const bundle = await loadAuroraFlowBundle(opts.companyId);
  const prior = bundle.routeChat;
  const openBets = bundle.bets.filter((b) => b.status !== 'done' && b.status !== 'dropped');
  const lang = opts.locale === 'es' ? 'espanhol' : opts.locale === 'en' ? 'inglês' : 'português';

  let reply =
    opts.locale === 'es'
      ? 'Ajustemos la ruta: ¿qué actividad movemos esta semana, o qué hay que corregir?'
      : opts.locale === 'en'
        ? 'Let’s adjust the route: which activity do we move this week?'
        : 'Ajustemos a rota: que atividade movemos esta semana?';

  const statusUpdates: Array<{ id: string; status: AuroraBetStatus }> = [];
  const newBets: Array<{ title: string; why: string; indicator: string }> = [];

  try {
    const raw = await llmCompleteJsonText(
      `És o assistente de rota do AURORA (incubadora). Falas com o TÉCNICO em ${lang}.
Tens a radiografia e as atividades. Responde curto (máx. 80 palavras).
Podes sugerir mudanças de estado ou 1 atividade nova se fizer sentido.
JSON só: {"reply":"","statusUpdates":[{"id":"","status":"accepted|active|done|dropped"}],"newBets":[{"title":"","why":"","indicator":""}]}`,
      JSON.stringify({
        company: bundle.companyName,
        hypothesis: bundle.radiography?.hypothesis || bundle.dossier?.hypothesis || '',
        radiographyExcerpt: (bundle.radiography?.body || '').slice(0, 1200),
        activities: openBets.map((b) => ({ id: b.id, title: b.title, status: b.status, why: b.why })),
        technicianMessage: message,
      }),
      { maxOutputTokens: 700 },
    );
    const parsed = JSON.parse(raw) as {
      reply?: unknown;
      statusUpdates?: Array<{ id?: unknown; status?: unknown }>;
      newBets?: Array<{ title?: unknown; why?: unknown; indicator?: unknown }>;
    };
    if (typeof parsed.reply === 'string' && parsed.reply.trim()) {
      reply = parsed.reply.trim().slice(0, 800);
    }
    for (const u of parsed.statusUpdates || []) {
      const id = String(u.id || '').trim();
      const status = normalizeAuroraBetStatus(u.status);
      if (id && status && openBets.some((b) => b.id === id)) statusUpdates.push({ id, status });
    }
    for (const b of parsed.newBets || []) {
      const title = String(b.title || '').trim();
      if (title.length < 3) continue;
      newBets.push({
        title: title.slice(0, 200),
        why: String(b.why || '').trim().slice(0, 800),
        indicator: String(b.indicator || '').trim().slice(0, 200),
      });
    }
  } catch {
    // fallback reply já definido
  }

  for (const u of statusUpdates.slice(0, 4)) {
    await prisma.businessBet.updateMany({
      where: { id: u.id, companyId: opts.companyId },
      data: { status: u.status },
    });
  }
  if (newBets.length) {
    await materializeAuroraBets(opts.companyId, newBets.slice(0, 2));
  }

  const chat: AuroraRouteChatMessage[] = [
    ...prior,
    { role: 'user', text: message },
    { role: 'assistant', text: reply },
  ].slice(-40);

  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: auroraFlowPatch({
      routeChat: chat,
      flow: { phase: bundle.phase === 'live' ? 'live' : 'route', updatedAt: new Date().toISOString() },
    }),
  });
  return loadAuroraFlowBundle(opts.companyId);
}

export async function updateAuroraRouteBet(opts: {
  companyId: string;
  userId: string;
  betId: string;
  status: AuroraBetStatus;
}) {
  const updated = await prisma.businessBet.updateMany({
    where: { id: opts.betId, companyId: opts.companyId },
    data: { status: opts.status },
  });
  if (!updated.count) throw new Error('Actividad no encontrada.');

  const bundle = await loadAuroraFlowBundle(opts.companyId);
  const open = bundle.bets.filter((b) => b.status !== 'done' && b.status !== 'dropped').length;
  const done = bundle.bets.filter((b) => b.status === 'done').length;
  if (open + done >= 2 && opts.status === 'done') {
    await upsertDossier(opts.companyId, opts.userId, {
      interviewJson: auroraFlowPatch({
        flow: { phase: 'live', updatedAt: new Date().toISOString() },
      }),
    });
  }
  return loadAuroraFlowBundle(opts.companyId);
}

export async function logAuroraRouteWeek(opts: {
  companyId: string;
  userId: string;
  happened: string;
  blocked: string;
  nextStep: string;
}) {
  await prisma.businessRhythmNote.create({
    data: {
      companyId: opts.companyId,
      happened: opts.happened.trim().slice(0, 2000),
      blocked: opts.blocked.trim().slice(0, 2000),
      nextStep: opts.nextStep.trim().slice(0, 2000),
      source: 'aurora-route',
    },
  });
  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: auroraFlowPatch({
      flow: { phase: 'live', updatedAt: new Date().toISOString() },
    }),
  });
  return loadAuroraFlowBundle(opts.companyId);
}

export async function markAuroraFlowLive(opts: { companyId: string; userId: string }) {
  await upsertDossier(opts.companyId, opts.userId, {
    interviewJson: auroraFlowPatch({
      flow: { phase: 'live', updatedAt: new Date().toISOString() },
    }),
  });
  return loadAuroraFlowBundle(opts.companyId);
}
