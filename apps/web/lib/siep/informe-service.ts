import { prisma } from '@/lib/prisma';
import { prismaHasEnumValue, prismaHasField } from '@/lib/prisma-has-field';
import { loadFileBuffer } from '@/lib/siep/file-storage';
import { loadReportGuideContext } from '@/lib/siep/report-guide-context';
import { buildMeScopeBlockForInforme } from '@/lib/siep/informe-me-context';
import { parseReportTemplate, detectCanvasFormat } from '@/lib/siep/report-template-parse';
import {
  canvasStateToPlainText,
  emptyMarkdownCanvas,
  type ReportCanvasState,
} from '@/lib/siep/report-canvas-types';
import { regionsFromDraftContent } from '@/lib/siep/report-canvas-merge';
import { encodeMeasurementPeriod } from '@/lib/siep/measurement-period';
import { bootstrapInformeMessage } from '@/lib/siep/report-copilot-prompts';
import { patchInformeMeta, readInformeMeta } from '@/lib/siep/informe-report-meta';
import {
  copyTemplateFileToPackage,
  resolveTemplateForCreate,
} from '@/lib/siep/informe-template-store';
import type { InformeDomain } from '@/lib/siep/informe-domains';

export type CreateInformeInput = {
  projectId: string;
  companyId: string;
  userId: string;
  domain: InformeDomain;
  cadence: string;
  periodStart: string;
  periodEnd: string;
  title?: string;
  donorFormat?: string;
  /** Modelo já guardado no projecto */
  templateFileId?: string;
  templateFileName?: string;
  cloudStoragePath?: string;
  mimeType?: string;
  fileSizeBytes?: number;
  /** Canvas validado na pré-visualização */
  canvasState?: ReportCanvasState;
  canvasFormat?: string;
};

const CADENCE_LABELS: Record<string, string> = {
  monthly: 'Mensal',
  quarterly: 'Trimestral',
  quarterly_final: 'Trimestral final',
  annual: 'Anual',
  adhoc: 'Pontual',
};

export async function createInforme(input: CreateInformeInput) {
  const period = encodeMeasurementPeriod(input.periodStart, input.periodEnd);
  const cadenceLabel = CADENCE_LABELS[input.cadence] || input.cadence;
  const title = input.title?.trim() || `${cadenceLabel} · ${input.periodStart} — ${input.periodEnd}`;
  const startDate = new Date(`${input.periodStart}T12:00:00`);
  const endDate = new Date(`${input.periodEnd}T12:00:00`);

  const pkg = await prisma.mEReportPackage.create({
    data: {
      projectId: input.projectId,
      title,
      cadence: input.cadence === 'quarterly_final' ? 'quarterly' : input.cadence,
      period,
      ...(prismaHasField('MEReportPackage', 'periodStart')
        ? { periodStart: startDate, periodEnd: endDate }
        : {}),
      donorFormat: input.donorFormat || 'generic',
      domain: input.domain,
      status: 'draft',
    },
  });

  let templateFileName = input.templateFileName || 'modelo.docx';
  let cloudStoragePath = input.cloudStoragePath || '';
  let mimeType = input.mimeType;
  let fileSizeBytes = input.fileSizeBytes || 0;
  let canvasState: ReportCanvasState;
  let canvasFormat: string;

  if (input.templateFileId) {
    const resolved = await resolveTemplateForCreate(input.templateFileId, input.projectId);
    if (!resolved) throw new Error('Modelo não encontrado');
    templateFileName = resolved.fileName;
    cloudStoragePath = resolved.cloudStoragePath;
    mimeType = resolved.mimeType || undefined;
    fileSizeBytes = resolved.fileSizeBytes;
    canvasState = input.canvasState || resolved.canvasState;
    canvasFormat = input.canvasFormat || resolved.canvasFormat;
    const templateFile = await copyTemplateFileToPackage(
      input.templateFileId,
      input.projectId,
      pkg.id,
      input.domain,
    );
    if (canvasState.templateFileId === 'preview' || !canvasState.templateFileId) {
      canvasState = { ...canvasState, templateFileId: templateFile.id, templateFileName };
    }
  } else {
    if (!cloudStoragePath && !input.canvasState) throw new Error('Modelo em falta');
    const storagePath =
      cloudStoragePath || `blank://${input.projectId}/${input.domain}/${Date.now()}`;
    const templateFile = await prisma.mEReportFile.create({
      data: {
        packageId: pkg.id,
        projectId: input.projectId,
        fileName: templateFileName || 'Formato personalizado',
        cloudStoragePath: storagePath,
        mimeType: mimeType || null,
        fileSizeBytes,
        component: input.domain === 'budget' ? 'financial' : 'narrative',
        cadence: pkg.cadence,
        order: 0,
      },
    });

    if (input.canvasState) {
      canvasState = { ...input.canvasState, templateFileId: templateFile.id, templateFileName: templateFile.fileName };
      canvasFormat = input.canvasFormat || input.canvasState.format || 'markdown';
    } else {
      const buffer = await loadFileBuffer(storagePath);
      const detected = detectCanvasFormat(templateFileName, mimeType);
      if (detected) {
        canvasState = await parseReportTemplate(buffer, templateFileName, templateFile.id, mimeType);
        canvasFormat = detected;
      } else {
        canvasState = emptyMarkdownCanvas(templateFile.id, templateFileName, '');
        canvasFormat = 'markdown';
      }
    }
  }

  let findings = '';
  let recommendations = '';
  // Preenchimento IA fica no editor (chat) — evita bloquear 1–2 min no create

  const aiSession = await prisma.aiAdvisorSession.create({
    data: {
      companyId: input.companyId,
      userId: input.userId,
      title: `SIEP Informe · ${title}`,
      kind: prismaHasEnumValue('AiAdvisorSessionKind', 'SIEP_REPORT')
        ? 'SIEP_REPORT'
        : 'WORKSPACE_ADVISOR',
    },
  });

  const plainContent = canvasStateToPlainText(canvasState);
  const report = await prisma.mEReport.create({
    data: {
      projectId: input.projectId,
      packageId: pkg.id,
      title,
      type: input.domain === 'budget' ? 'financial' : 'progress',
      component: input.domain === 'budget' ? 'financial' : 'narrative',
      period,
      ...(prismaHasField('MEReport', 'periodStart')
        ? { periodStart: startDate, periodEnd: endDate }
        : {}),
      cadence: pkg.cadence,
      donorFormat: pkg.donorFormat,
      content: plainContent,
      findings: findings || null,
      recommendations: recommendations || null,
      status: 'draft',
      ...(prismaHasField('MEReport', 'canvasState')
        ? { canvasState: canvasState as object }
        : {}),
      ...(prismaHasField('MEReport', 'canvasFormat') ? { canvasFormat } : {}),
      ...(prismaHasField('MEReport', 'aiSessionId') ? { aiSessionId: aiSession.id } : {}),
    },
  });

  await prisma.aiAdvisorMessage.create({
    data: {
      sessionId: aiSession.id,
      role: 'assistant',
      content: bootstrapInformeMessage('pt'),
    },
  });

  if (!prismaHasField('MEReport', 'aiSessionId') || !prismaHasField('MEReport', 'canvasState')) {
    await patchInformeMeta(report.id, {
      aiSessionId: aiSession.id,
      canvasState,
      canvasFormat,
    });
  }

  return { report, package: pkg, aiSessionId: aiSession.id };
}

export async function loadInformeEditorState(reportId: string, companyIds: string[]) {
  const report = await prisma.mEReport.findUnique({
    where: { id: reportId },
    include: {
      project: { select: { id: true, name: true, companyId: true } },
      package: {
        include: {
          files: { where: { isActive: true }, orderBy: { order: 'asc' } },
        },
      },
    },
  });
  if (!report || !companyIds.includes(report.project.companyId)) return null;

  const meta = await readInformeMeta(reportId);
  let canvasState = (report.canvasState as ReportCanvasState | null) || meta.canvasState;
  if (!canvasState && report.content) {
    const file = report.package?.files?.[0];
    canvasState = emptyMarkdownCanvas(file?.id || 'legacy', file?.fileName || 'informe.txt', report.content);
  }

  return {
    report: {
      ...report,
      aiSessionId: meta.aiSessionId,
      canvasState: meta.canvasState,
      canvasFormat: meta.canvasFormat ?? report.canvasFormat,
    },
    canvasState,
  };
}

export async function buildProjectContextBlock(projectId: string, domain: InformeDomain): Promise<string> {
  const guideScope = domain === 'budget' ? 'budget' : domain === 'narrative' ? 'general' : 'me';
  const guide = await loadReportGuideContext(projectId, guideScope);
  const meScope = await buildMeScopeBlockForInforme(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, goal: true, budget: true, currency: true, startDate: true, endDate: true },
  });

  const tasks = await prisma.task.findMany({
    where: { projectId, isActive: true },
    select: { title: true, status: true, description: true },
    orderBy: { order: 'asc' },
    take: 60,
  });

  return [
    `Projecto: ${project?.name || projectId}`,
    project?.goal ? `Objectivo geral: ${project.goal}` : '',
    project?.startDate && project?.endDate
      ? `Período do projecto: ${project.startDate.toISOString().slice(0, 10)} – ${project.endDate.toISOString().slice(0, 10)}`
      : '',
    project?.budget != null ? `Orçamento: ${project.budget} ${project.currency || ''}` : '',
    '',
    meScope,
    guide ? `\n--- MANUAL / GUIA DO FINANCIADOR ---\n${guide.slice(0, 25000)}\n--- FIM ---` : '',
    tasks.length
      ? `\nTarefas operacionais (cronograma — complementar ao escopo M&E):\n${tasks
          .map((t) => {
            const desc = t.description?.trim() ? ` — ${t.description.trim().slice(0, 120)}` : '';
            return `- [${t.status}] ${t.title}${desc}`;
          })
          .join('\n')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function legacyCanvasFromReport(report: {
  content: string;
  findings?: string | null;
  recommendations?: string | null;
  package?: { files?: Array<{ id: string; fileName: string }> } | null;
}): ReportCanvasState {
  const file = report.package?.files?.[0];
  return regionsFromDraftContent(
    emptyMarkdownCanvas(file?.id || 'legacy', file?.fileName || 'informe', report.content),
    report.content,
    report.findings || undefined,
    report.recommendations || undefined,
  );
}
