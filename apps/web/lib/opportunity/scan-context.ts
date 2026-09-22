import 'server-only';

import { prisma } from '@/lib/prisma';
import { buildFeedbackLearningBlock } from '@/lib/opportunity/learning-feedback';
import { SCAN_MEMORY_CATEGORY, parseScanResults } from '@/lib/opportunity/candidate-store';

/** Contexto de aprendizagem — o que a organização já validou ou rejeitou (não substitui a descoberta). */
export async function buildLearningContext(companyId: string): Promise<string> {
  const [validated, feedbackBlock] = await Promise.all([
    prisma.fund.findMany({
      where: { companyId, isActive: true },
      select: { name: true, institution: true, sectors: true, type: true, countries: true, amount: true },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    }),
    buildFeedbackLearningBlock(companyId),
  ]);

  const lines: string[] = [];

  if (validated.length > 0) {
    lines.push('Catálogo guardado (sinais positivos implícitos):');
    for (const f of validated.slice(0, 15)) {
      lines.push(
        `- ${f.name} (${f.institution}) · ${f.type}${f.sectors ? ` · ${f.sectors}` : ''}${f.countries ? ` · ${f.countries}` : ''}`,
      );
    }
  }

  if (feedbackBlock) lines.push(feedbackBlock);

  // Soft: nomes descartados nesta ocasião (só evita repetir o mesmo fundo na próxima run)
  const scanMemories = await prisma.aiCompanyMemory.findMany({
    where: { companyId, category: SCAN_MEMORY_CATEGORY },
    orderBy: { updatedAt: 'desc' },
    take: 3,
    select: { value: true, key: true },
  });
  const softSkip: string[] = [];
  for (const row of scanMemories) {
    const runId = row.key.replace('run_', '');
    const payload = parseScanResults(row.value, runId);
    for (const id of [...payload.discardedTempIds, ...payload.laterTempIds]) {
      const c = payload.candidates.find((x) => x.tempId === id);
      if (c) softSkip.push(`${c.name} (${c.institution})`);
    }
  }
  if (softSkip.length) {
    lines.push(
      `Não repetir estes nomes já vistos (timing/ocasião — NÃO generalizar o tipo): ${[...new Set(softSkip)].slice(0, 12).join('; ')}`,
    );
  }

  const profile = await prisma.fundingCaptureProfile.findUnique({
    where: { companyId },
    select: { preferencesJson: true },
  });
  if (profile?.preferencesJson) {
    try {
      const prefs = JSON.parse(profile.preferencesJson) as { searchFeedback?: string };
      if (prefs.searchFeedback?.trim()) {
        lines.push(`Orientação do atalho activo:\n${prefs.searchFeedback.trim()}`);
      }
    } catch {
      // ignore
    }
  }

  return lines.length > 0 ? lines.join('\n') : '(sem histórico — primeira varredura ou catálogo vazio)';
}
