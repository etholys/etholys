import { prisma } from '@/lib/prisma';
import { geminiCompleteJsonText } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import { loadReportGuideContext } from '@/lib/siep/report-guide-context';
import { extractTextDetailed } from '@/lib/siep/extract-file-text';
import { loadFileBuffer } from '@/lib/siep/file-storage';

export type DonorReportDraftResult = {
  title: string;
  period: string;
  content: string;
  findings: string;
  recommendations: string;
  warnings: string[];
  templateFileName: string;
};

const PROMPT = `Eres un especialista en informes periódicos para donantes (USAID, BID, UE).
Tu tarea: GENERAR un borrador de informe RELLENANDO la plantilla/formato del donante con datos reales del proyecto.

Responde SOLO JSON válido:
{
  "title": "título del informe",
  "period": "período cubierto",
  "content": "informe completo en markdown, respetando secciones y orden de la PLANTILLA. Rellena cada campo/sección con datos del proyecto. Marca [VERIFICAR] donde falten datos.",
  "findings": "logros y variaciones del período",
  "recommendations": "próximos pasos",
  "warnings": ["datos que el usuario debe confirmar manualmente"]
}

Reglas:
- Sigue la estructura de la plantilla (encabezados, tablas, numeración)
- Usa SOLO datos del contexto del proyecto — no inventes cifras
- Si un campo de la plantilla no tiene dato, escribe [PENDIENTE — descripción] o [VERIFICAR]`;

export async function generateDonorReportDraft(
  projectId: string,
  packageId: string,
  opts?: { templateFileId?: string; periodStart?: string; periodEnd?: string },
): Promise<DonorReportDraftResult> {
  const pkg = await prisma.mEReportPackage.findUnique({
    where: { id: packageId },
    include: { files: { where: { isActive: true } } },
  });
  if (!pkg || pkg.projectId !== projectId) throw new Error('Pacote não encontrado');

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, budget: true, currency: true },
  });
  if (!project) throw new Error('Projeto não encontrado');

  const templateFile = opts?.templateFileId
    ? pkg.files.find((f) => f.id === opts.templateFileId)
    : pkg.files.find((f) => f.component === 'narrative')
      || pkg.files.find((f) => /\.(docx|pdf|txt)$/i.test(f.fileName));

  if (!templateFile) {
    throw new Error('Suba primeiro o modelo/formato do informe (componente Narrativo) no pacote.');
  }

  const buffer = await loadFileBuffer(templateFile.cloudStoragePath);
  const extracted = await extractTextDetailed(buffer, templateFile.fileName, templateFile.mimeType);
  if (!extracted.ok) {
    throw new Error(
      extracted.issue
        || `Não foi possível ler o modelo (${extracted.charCount} caracteres). Use .docx preenchido ou PDF com texto.`,
    );
  }

  const domain = pkg.domain === 'budget' ? 'budget' : 'me';
  const guideContext = await loadReportGuideContext(projectId, domain);

  const periodStart = opts?.periodStart ? new Date(opts.periodStart) : null;
  const periodEnd = opts?.periodEnd ? new Date(opts.periodEnd) : null;
  const periodLabel = pkg.period || (periodStart && periodEnd
    ? `${opts?.periodStart ?? ''} — ${opts?.periodEnd ?? ''}`
    : 'período do pacote');

  const tasks = await prisma.task.findMany({
    where: { projectId, isActive: true },
    select: { title: true, status: true, description: true, completedAt: true, dueDate: true },
    take: 80,
  });

  const measurements = await prisma.indicatorMeasurement.findMany({
    where: { projectId },
    include: { objective: { select: { title: true, code: true, indicator: true, actual: true, target: true } } },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });

  const activityReports = await prisma.taskActivityReport.findMany({
    where: { projectId, isActive: true },
    orderBy: { reportDate: 'desc' },
    take: 40,
    select: { narrative: true, reportDate: true, progressPct: true, status: true, task: { select: { title: true } } },
  });

  const userText = `PROYECTO: ${project.name}
PACOTE: ${pkg.title}
PERÍODO: ${periodLabel}
CADÊNCIA: ${pkg.cadence}
FORMATO DONANTE: ${pkg.donorFormat}

--- PLANTILLA / FORMATO DEL INFORME (${templateFile.fileName}) ---
${extracted.text.slice(0, 80000)}
--- FIN PLANTILLA ---

ACTIVIDADES (tareas):
${tasks.map((t) => `- [${t.status}] ${t.title}${t.completedAt ? ` (concluída ${t.completedAt.toISOString().slice(0, 10)})` : ''}`).join('\n')}

MEDICIONES M&E recientes:
${measurements.slice(0, 25).map((m) => `- ${m.objective.code || ''} ${m.objective.indicator || m.objective.title}: ${m.value} (${m.period})`).join('\n')}

REPORTES INTERNOS DE ACTIVIDADES:
${activityReports.slice(0, 15).map((r) => `- ${r.reportDate.toISOString().slice(0, 10)} ${r.task?.title || 'Actividad'}: ${r.narrative.slice(0, 300)}`).join('\n')}

${guideContext ? `\n${guideContext}\n` : ''}`;

  const raw = await geminiCompleteJsonText(PROMPT, userText, { maxOutputTokens: 16384 });
  const parsed = extractFirstJsonObject(raw) as Partial<DonorReportDraftResult>;

  return {
    title: parsed.title || `${pkg.title} — borrador`,
    period: parsed.period || periodLabel,
    content: parsed.content || '',
    findings: parsed.findings || '',
    recommendations: parsed.recommendations || '',
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    templateFileName: templateFile.fileName,
  };
}
