import { prisma } from './prisma';
import { parseCompanySectorIds } from './nexus-economic-sectors';
import { loadDossier } from './business-dossier';
import { AURORA_DIAG_BLOCKS, AURORA_MATURITY, diagProgress, readAuroraDiagnostic } from './aurora-diagnostic';
import { isCatalogPortrait } from './polaris-map';
import { isContextSetupMeaningful, type CompanyContextSetup } from './company-context-setup';

/**
 * Leitura leve do ecossistema Etholys para o POLARIS (consultor permanente).
 * Sem scores Likert, sem consola de operação, sem inventar factos.
 */
export async function loadPolarisEcosystemBrief(companyId: string): Promise<string> {
  const [company, dossierPack, venture, unit, funds, tasks, meets, studioDocs, memories, alerts] =
    await Promise.all([
      prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          shortName: true,
          description: true,
          businessActivity: true,
          incorporationCountry: true,
          entityType: true,
          contextSetupJson: true,
        },
      }),
      loadDossier(companyId),
      prisma.nexusVentureState.findFirst({
        where: { companyId },
        select: { stage: true, incubatorNotes: true },
      }),
      prisma.nexusOpsUnit.findFirst({
        where: { companyId, isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { name: true, sectorId: true, updatedAt: true },
      }),
      prisma.fund.findMany({
        where: { companyId, isActive: true },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: { name: true, status: true, deadline: true, institution: true },
      }),
      prisma.task.findMany({
        where: {
          companyId,
          isActive: true,
          status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] },
        },
        orderBy: [{ dueDate: 'asc' }, { updatedAt: 'desc' }],
        take: 8,
        select: { title: true, status: true, dueDate: true, priority: true },
      }),
      prisma.meetSession.findMany({
        where: { companyId, status: { in: ['ended', 'live', 'scheduled'] } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { title: true, status: true, summaryText: true, scheduledAt: true },
      }),
      prisma.studioDocument.findMany({
        where: { companyId },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { title: true, updatedAt: true },
      }),
      prisma.aiCompanyMemory.findMany({
        where: {
          companyId,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          NOT: { category: { in: ['agent_telemetry', 'agent_feedback'] } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        select: { category: true, key: true, value: true },
      }),
      prisma.aiAlert.findMany({
        where: { companyId, dismissedAt: null, read: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true, severity: true, message: true },
      }),
    ]);

  const sectors = parseCompanySectorIds(company?.contextSetupJson);
  const ctx =
    company?.contextSetupJson && typeof company.contextSetupJson === 'object'
      ? (company.contextSetupJson as CompanyContextSetup)
      : null;
  const portrait = dossierPack.dossier?.portraitText || '';
  const catalog = isCatalogPortrait(portrait);
  const diagnostic = readAuroraDiagnostic(dossierPack.dossier?.interviewJson);
  const progress = diagProgress(diagnostic);
  const lines: string[] = [];

  lines.push(`Empresa: ${company?.name || '—'}${company?.shortName ? ` (${company.shortName})` : ''}`);
  if (company?.businessActivity) lines.push(`Atividade: ${String(company.businessActivity).slice(0, 400)}`);
  if (company?.description) lines.push(`Descrição: ${String(company.description).slice(0, 400)}`);
  if (company?.incorporationCountry) lines.push(`País: ${company.incorporationCountry}`);
  if (company?.entityType) lines.push(`Tipo: ${company.entityType}`);
  if (sectors.length) lines.push(`Sectores (contexto): ${sectors.slice(0, 6).join(', ')}`);
  if (ctx && isContextSetupMeaningful(ctx)) {
    if (ctx.entityKind) lines.push(`Tipo de entidade (setup): ${ctx.entityKind}`);
    if (ctx.primaryGoals?.length) lines.push(`Metas (setup): ${ctx.primaryGoals.join(', ')}`);
    if (ctx.notesForAdvisor?.trim()) lines.push(`Notas do setup: ${ctx.notesForAdvisor.trim().slice(0, 400)}`);
    if (ctx.tradesInternationally != null) {
      lines.push(`Comércio internacional: ${ctx.tradesInternationally ? 'sim' : 'não'}`);
    }
  }

  lines.push(
    `Linha base / diagnóstico de maturidade: ${progress.done}/${progress.total} blocos${
      progress.avgLevel != null ? `; média ${progress.avgLevel}/5` : ''
    }${progress.complete ? ' (completa)' : ' (INCOMPLETA — orientar a completar)'}`,
  );
  for (const def of AURORA_DIAG_BLOCKS) {
    const b = diagnostic.blocks[def.id];
    if (!b || b.status !== 'done' || !b.level) continue;
    const label = def.label.pt;
    const mat = AURORA_MATURITY[b.level].short.pt;
    lines.push(
      `Bloco ${label}: maturidade ${b.level} (${mat}). Situação: ${b.situation.slice(0, 280)}${
        b.gap ? ` | Brecha: ${b.gap.slice(0, 120)}` : ''
      }${b.potential ? ` | Potencial: ${b.potential.slice(0, 120)}` : ''}`,
    );
  }

  if (!catalog && portrait.trim()) {
    lines.push(`Retrato guardado:\n${portrait.slice(0, 1200)}`);
  } else {
    lines.push('Retrato guardado: (ainda sem retrato útil — não uses scores de diagnóstico Likert)');
  }
  if (dossierPack.dossier?.hypothesis?.trim() && !catalog) {
    lines.push(`Hipótese: ${dossierPack.dossier.hypothesis.slice(0, 400)}`);
    lines.push(`Hipótese aceite: ${dossierPack.dossier.hypothesisAccepted ? 'sim' : 'não'}`);
  }
  const gaps = (dossierPack.dossier?.gaps || []).map((g) => g.text).filter(Boolean);
  const pots = (dossierPack.dossier?.potentials || []).map((g) => g.text).filter(Boolean);
  if (gaps.length) lines.push(`Brechas no dossiê: ${gaps.slice(0, 5).join('; ')}`);
  if (pots.length) lines.push(`Potenciais no dossiê: ${pots.slice(0, 3).join('; ')}`);

  const bets = dossierPack.bets.filter((b) => b.status !== 'dropped');
  if (bets.length) {
    lines.push(
      `Apostas: ${bets
        .slice(0, 6)
        .map((b) => `${b.title} [${b.status}]`)
        .join('; ')}`,
    );
  }
  const last = dossierPack.rhythm[0];
  if (last) {
    lines.push(
      `Último ritmo: aconteceu=${last.happened || '—'}; trava=${last.blocked || '—'}; passo=${last.nextStep || '—'}`,
    );
  }

  if (venture?.stage) lines.push(`Etapa de venture (interno): ${venture.stage}`);
  if (venture?.incubatorNotes?.trim()) {
    lines.push(`Notas de incubação: ${venture.incubatorNotes.trim().slice(0, 500)}`);
  }
  if (unit) {
    lines.push(
      `Unidade ops activa: ${unit.name}${unit.sectorId ? ` / ${unit.sectorId}` : ''} (atualizada ${unit.updatedAt.toISOString().slice(0, 10)})`,
    );
  }
  if (dossierPack.dossier?.pulsoModule) {
    lines.push(`Módulo RADAR ligado: ${dossierPack.dossier.pulsoModule}`);
  }

  if (funds.length) {
    lines.push(
      `FundHub (até 8): ${funds
        .map((f) => {
          const dl = f.deadline ? f.deadline.toISOString().slice(0, 10) : 'sem prazo';
          return `${f.name} @ ${f.institution} [${f.status}] prazo ${dl}`;
        })
        .join(' | ')}`,
    );
  } else {
    lines.push('FundHub: (sem oportunidades activas)');
  }

  if (tasks.length) {
    lines.push(
      `Work — tarefas abertas: ${tasks
        .map((t) => {
          const due = t.dueDate ? t.dueDate.toISOString().slice(0, 10) : 'sem prazo';
          return `${t.title} [${t.status}/${t.priority}] até ${due}`;
        })
        .join(' | ')}`,
    );
  } else {
    lines.push('Work: (sem tarefas abertas relevantes)');
  }

  if (meets.length) {
    lines.push(
      `Chorus/Meet recente: ${meets
        .map((m) => {
          const sum = m.summaryText?.trim() ? ` — ${m.summaryText.trim().slice(0, 160)}` : '';
          return `${m.title} [${m.status}]${sum}`;
        })
        .join(' | ')}`,
    );
  }

  if (studioDocs.length) {
    lines.push(`Studio docs recentes: ${studioDocs.map((d) => d.title).join(' | ')}`);
  }

  if (memories.length) {
    lines.push(
      `Memória da empresa: ${memories
        .map((m) => `${m.category}/${m.key}: ${m.value.slice(0, 120)}`)
        .join(' | ')}`,
    );
  }

  if (alerts.length) {
    lines.push(
      `Alertas abertos: ${alerts.map((a) => `[${a.severity}] ${a.title}: ${a.message.slice(0, 100)}`).join(' | ')}`,
    );
  }

  return lines.join('\n').slice(0, 7000);
}
