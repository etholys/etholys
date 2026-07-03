export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { geminiGenerateContent } from '@/lib/gemini-client';
import {
  applyCopilotCanvasUpdate,
} from '@/lib/siep/report-canvas-merge';
import { buildProjectContextBlock } from '@/lib/siep/informe-service';
import {
  buildTemplateValidationPrompt,
  extractCopilotPayload,
  summarizeCanvasForPrompt,
} from '@/lib/siep/report-copilot-prompts';
import { normalizeInformeDomain } from '@/lib/siep/informe-domains';
import {
  detectCanvasFormat,
  parseReportTemplate,
} from '@/lib/siep/report-template-parse';
import { loadFileBuffer } from '@/lib/siep/file-storage';
import type { ReportCanvasState } from '@/lib/siep/report-canvas-types';

export async function POST(req: Request) {
  try {
    const tenant = await getUserCompanyIds();
    if (!tenant) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

    const body = await req.json();
    const projectId = String(body.projectId || '');
    const domain = normalizeInformeDomain(body.domain);
    const message = String(body.message || '').trim();
    const cloudStoragePath = String(body.cloudStoragePath || '');
    const templateFileName = String(body.templateFileName || '');
    let canvas = body.canvasState as ReportCanvasState | undefined;

    if (!projectId || !message) {
      return NextResponse.json({ error: 'projectId e message são obrigatórios' }, { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { companyId: true },
    });
    if (!project || !tenant.companyIds.includes(project.companyId)) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    if (!canvas && cloudStoragePath && templateFileName) {
      const buffer = await loadFileBuffer(cloudStoragePath);
      canvas = await parseReportTemplate(buffer, templateFileName, 'preview', body.mimeType);
    }

    if (!canvas?.regions?.length) {
      return NextResponse.json({ error: 'Canvas inválido — envie modelo ou canvasState' }, { status: 400 });
    }

    const projectContext = await buildProjectContextBlock(projectId, domain);
    const systemPrompt = buildTemplateValidationPrompt({
      locale: 'pt',
      domain,
      canvasSummary: summarizeCanvasForPrompt(canvas),
      projectContext,
      templateFileName: templateFileName || canvas.templateFileName || 'modelo',
    });

    const history = Array.isArray(body.history)
      ? (body.history as Array<{ role: string; content: string }>).slice(-10)
      : [];
    const historyText = history
      .map((m) => `${m.role === 'user' ? 'Utilizador' : 'Assistente'}: ${m.content}`)
      .join('\n\n');
    const userText = historyText
      ? `HISTÓRICO:\n${historyText}\n\nNOVA MENSAGEM:\n${message}`
      : message;

    const result = await geminiGenerateContent({
      systemInstruction: systemPrompt,
      userText,
      maxOutputTokens: 8192,
    });

    const { visibleText, patches, missingRegionIds, removeRegionIds, addTableRows, replaceTableRows } = extractCopilotPayload(result.text);
    canvas = applyCopilotCanvasUpdate(canvas, patches, missingRegionIds, removeRegionIds, addTableRows, replaceTableRows);

    return NextResponse.json({
      reply: visibleText || result.text,
      canvasState: canvas,
      canvasFormat: canvas.format || detectCanvasFormat(templateFileName, body.mimeType) || 'docx',
      patchesApplied: patches.length,
      regionsRemoved: removeRegionIds.length,
    });
  } catch (error: unknown) {
    console.error('[siep/informes/templates/validate POST]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
