import { prisma } from '@/lib/prisma';
import { prismaHasEnumValue, prismaHasField } from '@/lib/prisma-has-field';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';

export type InformeMetaRow = {
  aiSessionId: string | null;
  canvasState: ReportCanvasState | null;
  canvasFormat: string | null;
};

export async function readInformeMeta(reportId: string): Promise<InformeMetaRow> {
  if (prismaHasField('MEReport', 'aiSessionId')) {
    const select: Record<string, boolean> = { aiSessionId: true };
    if (prismaHasField('MEReport', 'canvasState')) select.canvasState = true;
    if (prismaHasField('MEReport', 'canvasFormat')) select.canvasFormat = true;
    const row = await prisma.mEReport.findUnique({
      where: { id: reportId },
      select: select as { aiSessionId: true; canvasState?: true; canvasFormat?: true },
    });
    return {
      aiSessionId: row?.aiSessionId ?? null,
      canvasState: (row?.canvasState as ReportCanvasState | null) ?? null,
      canvasFormat: row?.canvasFormat ?? null,
    };
  }

  const rows = await prisma.$queryRaw<
    Array<{ aiSessionId: string | null; canvasState: ReportCanvasState | null; canvasFormat: string | null }>
  >`
    SELECT "aiSessionId", "canvasState", "canvasFormat"
    FROM "MEReport"
    WHERE id = ${reportId}
    LIMIT 1
  `;
  return rows[0] ?? { aiSessionId: null, canvasState: null, canvasFormat: null };
}

export async function patchInformeMeta(
  reportId: string,
  patch: Partial<InformeMetaRow>,
): Promise<void> {
  const prismaData: Record<string, unknown> = {};
  if (patch.aiSessionId !== undefined && prismaHasField('MEReport', 'aiSessionId')) {
    prismaData.aiSessionId = patch.aiSessionId;
  }
  if (patch.canvasState !== undefined && prismaHasField('MEReport', 'canvasState')) {
    prismaData.canvasState = patch.canvasState;
  }
  if (patch.canvasFormat !== undefined && prismaHasField('MEReport', 'canvasFormat')) {
    prismaData.canvasFormat = patch.canvasFormat;
  }

  if (Object.keys(prismaData).length > 0) {
    await prisma.mEReport.update({ where: { id: reportId }, data: prismaData });
    return;
  }

  if (patch.aiSessionId !== undefined) {
    await prisma.$executeRaw`
      UPDATE "MEReport"
      SET "aiSessionId" = ${patch.aiSessionId}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${reportId}
    `;
  }
  if (patch.canvasState !== undefined) {
    await prisma.$executeRaw`
      UPDATE "MEReport"
      SET "canvasState" = ${JSON.stringify(patch.canvasState)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${reportId}
    `;
  }
  if (patch.canvasFormat !== undefined) {
    await prisma.$executeRaw`
      UPDATE "MEReport"
      SET "canvasFormat" = ${patch.canvasFormat}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${reportId}
    `;
  }
}

export async function ensureInformeAiSession(
  reportId: string,
  opts: { title: string; companyId: string; userId: string },
): Promise<string> {
  const meta = await readInformeMeta(reportId);
  if (meta.aiSessionId) return meta.aiSessionId;

  const sessionTitle = `SIEP Informe · ${opts.title}`;
  const existing = await prisma.aiAdvisorSession.findFirst({
    where: {
      companyId: opts.companyId,
      userId: opts.userId,
      title: sessionTitle,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    await patchInformeMeta(reportId, { aiSessionId: existing.id });
    return existing.id;
  }

  const session = await prisma.aiAdvisorSession.create({
    data: {
      companyId: opts.companyId,
      userId: opts.userId,
      title: sessionTitle,
      kind: prismaHasEnumValue('AiAdvisorSessionKind', 'SIEP_REPORT')
        ? 'SIEP_REPORT'
        : 'WORKSPACE_ADVISOR',
    },
  });
  await patchInformeMeta(reportId, { aiSessionId: session.id });
  return session.id;
}

export async function reportUsesAiSession(reportId: string, sessionId: string): Promise<boolean> {
  const meta = await readInformeMeta(reportId);
  return meta.aiSessionId === sessionId;
}

export const INFORME_SESSION_KINDS = ['SIEP_REPORT', 'WORKSPACE_ADVISOR'] as const;
