import 'server-only';

import { prisma } from '@/lib/prisma';
import { SCAN_MEMORY_CATEGORY, parseScanResults } from '@/lib/opportunity/candidate-store';
import { listUserMonitoredUrls } from '@/lib/opportunity/source-catalog';

/** Contexto de aprendizagem — o que a organização já validou ou rejeitou (não substitui a descoberta). */
export async function buildLearningContext(companyId: string): Promise<string> {
  const [validated, scanMemories] = await Promise.all([
    prisma.fund.findMany({
      where: { companyId, isActive: true },
      select: { institution: true, sectors: true, type: true, countries: true },
      take: 30,
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.aiCompanyMemory.findMany({
      where: { companyId, category: SCAN_MEMORY_CATEGORY },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: { value: true, key: true },
    }),
  ]);

  const lines: string[] = [];

  if (validated.length > 0) {
    const inst = [...new Set(validated.map((f) => f.institution))].slice(0, 12);
    lines.push(`Instituições já validadas pela organização: ${inst.join(', ')}`);
    const sectors = [...new Set(validated.map((f) => f.sectors).filter(Boolean))].slice(0, 8);
    if (sectors.length) lines.push(`Sectores/temas preferidos: ${sectors.join('; ')}`);
  }

  const discarded: string[] = [];
  for (const row of scanMemories) {
    const runId = row.key.replace('run_', '');
    const payload = parseScanResults(row.value, runId);
    for (const id of payload.discardedTempIds) {
      const c = payload.candidates.find((x) => x.tempId === id);
      if (c) discarded.push(`${c.name} (${c.institution})`);
    }
  }
  if (discarded.length > 0) {
    lines.push(`Evitar repetir ou priorizar baixo: ${[...new Set(discarded)].slice(0, 15).join('; ')}`);
  }

  const profile = await prisma.fundingCaptureProfile.findUnique({
    where: { companyId },
    select: { preferencesJson: true },
  });
  if (profile?.preferencesJson) {
    try {
      const prefs = JSON.parse(profile.preferencesJson) as { searchFeedback?: string };
      if (prefs.searchFeedback?.trim()) {
        lines.push(`Instruções do utilizador para afinar buscas: ${prefs.searchFeedback.trim()}`);
      }
    } catch {
      // ignore
    }
  }

  return lines.length > 0 ? lines.join('\n') : '(sem histórico — primeira varredura ou catálogo vazio)';
}
