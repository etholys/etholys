import { prisma } from '@/lib/prisma';
import { extractTextFromBuffer } from '@/lib/siep/extract-file-text';
import { loadFileBuffer } from '@/lib/siep/file-storage';

const MAX_CHARS_PER_GUIDE = 80_000;
const MAX_TOTAL_CHARS = 200_000;

/** Texto consolidado de manuales activos del proyecto para inyectar en prompts de IA. */
export async function loadReportGuideContext(projectId: string, domain?: string): Promise<string> {
  const where: {
    projectId: string;
    isActive: boolean;
    extractionStatus: string;
    OR?: Array<{ domain: string }>;
  } = { projectId, isActive: true, extractionStatus: 'ready' };

  if (domain) {
    where.OR = [{ domain }, { domain: 'general' }];
  }

  const guides = await prisma.projectReportGuide.findMany({
    where,
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    select: { title: true, fileName: true, extractedText: true, domain: true },
  });

  if (guides.length === 0) return '';

  let total = 0;
  const blocks: string[] = [];

  for (const g of guides) {
    const text = (g.extractedText || '').trim();
    if (!text) continue;
    const slice = text.slice(0, MAX_CHARS_PER_GUIDE);
    if (total + slice.length > MAX_TOTAL_CHARS) break;
    blocks.push(`### ${g.title} (${g.fileName})\n${slice}`);
    total += slice.length;
  }

  if (blocks.length === 0) return '';

  return `MANUAL DE REPORTE DEL FINANCIADOR (referencia obligatoria — formato, secciones, plazos, requisitos):\n\n${blocks.join('\n\n---\n\n')}`;
}

export async function extractAndStoreGuideText(guideId: string): Promise<void> {
  const guide = await prisma.projectReportGuide.findUnique({
    where: { id: guideId },
  });
  if (!guide) return;

  try {
    const buffer = await loadFileBuffer(guide.cloudStoragePath);
    const text = await extractTextFromBuffer(buffer, guide.fileName, guide.mimeType);

    await prisma.projectReportGuide.update({
      where: { id: guideId },
      data: {
        extractedText: text.slice(0, 500_000),
        extractionStatus: text.trim() ? 'ready' : 'failed',
      },
    });
  } catch (err: unknown) {
    console.error('[SIEP] report guide extraction failed:', guideId, err);
    await prisma.projectReportGuide.update({
      where: { id: guideId },
      data: { extractionStatus: 'failed' },
    });
  }
}
