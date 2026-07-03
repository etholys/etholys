export const dynamic = 'force-dynamic';
export const maxDuration = 120;

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { prismaHasEnumValue } from '@/lib/prisma-has-field';
import { geminiGenerateContent } from '@/lib/gemini-client';
import {
  buildSiepReportSystemPrompt,
  extractCopilotPayload,
  inferReportOutputLanguage,
  summarizeCanvasForPrompt,
  type CopilotLocale,
  type ReportOutputLanguage,
} from '@/lib/siep/report-copilot-prompts';
import {
  applyCopilotCanvasUpdate,
} from '@/lib/siep/report-canvas-merge';
import {
  buildProjectContextBlock,
  loadInformeEditorState,
} from '@/lib/siep/informe-service';
import { INFORME_SESSION_KINDS, patchInformeMeta, reportUsesAiSession } from '@/lib/siep/informe-report-meta';
import { normalizeInformeDomain } from '@/lib/siep/informe-domains';
import { loadReportGuideContext } from '@/lib/siep/report-guide-context';
import type { AiAdvisorSessionKind } from '@prisma/client';
import { canvasStateToPlainText, type ReportCanvasState } from '@/lib/siep/report-canvas-types';
import { displayMeasurementPeriod } from '@/lib/siep/measurement-period';
import {
  formatSelectionFocusForPrompt,
  parseInformeSelection,
} from '@/lib/siep/informe-canvas-selection';

function detectOutputLanguageFromMessage(
  message: string,
  fallback: ReportOutputLanguage,
): ReportOutputLanguage {
  if (/\b(ingl[eê]s|english|in english|em ingl[eê]s|todo en ingl[eé]s)\b/i.test(message)) return 'en';
  if (/\b(espa[nñ]ol|spanish|em espanhol|en espa[nñ]ol)\b/i.test(message)) return 'es';
  if (/\b(portugu[eê]s|portuguese|em portugu[eê]s)\b/i.test(message)) return 'pt';
  return fallback;
}

const SIEP_REPORT_GEMINI_MODEL =
  (process.env.GEMINI_SIEP_REPORT_MODEL || 'gemini-2.5-pro').trim();

type RouteCtx = { params: Promise<{ sessionId: string }> };

function informeSessionKinds(): AiAdvisorSessionKind[] {
  return INFORME_SESSION_KINDS.filter(
    (k) => k === 'WORKSPACE_ADVISOR' || prismaHasEnumValue('AiAdvisorSessionKind', k),
  ) as AiAdvisorSessionKind[];
}

async function resolveUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { companyUsers: { where: { isDefault: true }, take: 1 } },
  });
  if (!user) return null;
  const companyId = user.companyUsers[0]?.companyId
    ?? (await prisma.companyUser.findFirst({ where: { userId: user.id } }))?.companyId;
  if (!companyId) return null;
  return { user, companyId };
}

async function findInformeSession(sessionId: string, userId: string, companyId?: string) {
  const kinds = informeSessionKinds();
  const base = {
    id: sessionId,
    userId,
    OR: [
      { kind: { in: kinds } },
      { title: { startsWith: 'SIEP Informe' } },
    ],
  };

  let session = companyId
    ? await prisma.aiAdvisorSession.findFirst({ where: { ...base, companyId } })
    : null;
  if (!session) {
    session = await prisma.aiAdvisorSession.findFirst({ where: base });
  }
  return session;
}

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  try {
    const auth = await resolveUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sessionId } = await ctx.params;

    const advisorSession = await findInformeSession(sessionId, auth.user.id, auth.companyId);
    if (!advisorSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const messages = await prisma.aiAdvisorMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, role: true, content: true, createdAt: true },
    });

    return NextResponse.json({ ...advisorSession, messages });
  } catch (error: unknown) {
    console.error('[siep/report-copilot GET]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  try {
    const auth = await resolveUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sessionId } = await ctx.params;

    const body = await req.json();
    const userMessage = String(body.message || '').trim();
    const reportId = String(body.reportId || '').trim();
    const rawLoc = String(body.locale || 'pt');
    const locale: CopilotLocale = rawLoc === 'es' || rawLoc === 'en' ? rawLoc : 'pt';

    if (!userMessage) {
      return NextResponse.json({ error: 'Escreva uma mensagem.' }, { status: 400 });
    }
    if (!reportId) {
      return NextResponse.json({ error: 'reportId requerido' }, { status: 400 });
    }

    const advisorSession = await findInformeSession(sessionId, auth.user.id, auth.companyId);
    if (!advisorSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const tenantRows = await prisma.companyUser.findMany({
      where: { userId: auth.user.id },
      select: { companyId: true },
    });
    const companyIds = [...new Set(tenantRows.map((r) => r.companyId))];

    const loaded = await loadInformeEditorState(reportId, companyIds);
    if (!loaded || !(await reportUsesAiSession(reportId, sessionId))) {
      return NextResponse.json({ error: 'Informe não ligado a esta sessão' }, { status: 403 });
    }

    let canvas = (loaded.canvasState || loaded.report.canvasState) as ReportCanvasState;
    if (!canvas?.regions?.length) {
      return NextResponse.json({ error: 'Canvas inválido' }, { status: 400 });
    }

    const domain = normalizeInformeDomain(loaded.report.package?.domain);
    const guideScope = domain === 'budget' ? 'budget' : domain === 'narrative' ? 'general' : 'me';
    const guideContext = await loadReportGuideContext(loaded.report.projectId, guideScope);
    const projectContext = await buildProjectContextBlock(loaded.report.projectId, domain);
    const periodLabel = loaded.report.period
      ? displayMeasurementPeriod(loaded.report.period, locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt')
      : '';

    const outputLanguage = detectOutputLanguageFromMessage(
      userMessage,
      (body.outputLanguage as ReportOutputLanguage) ||
        inferReportOutputLanguage(canvas),
    );

    const systemPrompt = buildSiepReportSystemPrompt({
      locale,
      reportTitle: loaded.report.title,
      periodLabel,
      cadence: loaded.report.cadence || 'quarterly',
      domain,
      outputLanguage,
      guideContext: guideContext || undefined,
      canvasSummary: summarizeCanvasForPrompt(canvas),
      projectContext,
    });

    const historyDesc = await prisma.aiAdvisorMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { role: true, content: true },
    });
    const history = historyDesc.slice().reverse();

    await prisma.aiAdvisorMessage.create({
      data: { sessionId, role: 'user', content: userMessage },
    });

    const historyText = history
      .map((m) => `${m.role === 'user' ? 'Utilizador' : 'Assistente'}: ${m.content}`)
      .join('\n\n');

    const selection = parseInformeSelection(body.selection);
    const selectionBlock = selection ? formatSelectionFocusForPrompt(canvas, selection) : '';

    let fullUserText = history.length
      ? `HISTÓRICO:\n${historyText}\n\nNOVA MENSAGEM:\n${userMessage}`
      : userMessage;

    if (selectionBlock) {
      fullUserText = `══ ELEMENTO SELECCIONADO PELO UTILIZADOR ══\n${selectionBlock}\n\nA mensagem seguinte refere-se PRINCIPALMENTE a este elemento.\n\n${fullUserText}`;
    }

    const result = await geminiGenerateContent({
      systemInstruction: systemPrompt,
      userText: fullUserText,
      maxOutputTokens: 16384,
      model: SIEP_REPORT_GEMINI_MODEL,
      temperature: 0.2,
    });
    const rawReply = result.text;
    const { visibleText, patches, missingRegionIds, removeRegionIds, addTableRows, replaceTableRows } =
      extractCopilotPayload(rawReply);

    const tableRegionIds = new Set(
      canvas.regions.filter((r) => r.kind === 'tableCell' || r.kind === 'cell').map((r) => r.id),
    );
    const safeRemoveIds = removeRegionIds.filter((id) => !tableRegionIds.has(id));

    canvas = applyCopilotCanvasUpdate(
      canvas,
      patches,
      missingRegionIds,
      safeRemoveIds,
      addTableRows,
      replaceTableRows,
    );

    await prisma.aiAdvisorMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: visibleText || rawReply,
      },
    });

    const plainContent = canvasStateToPlainText(canvas);
    await prisma.mEReport.update({
      where: { id: reportId },
      data: { content: plainContent },
    });
    await patchInformeMeta(reportId, {
      canvasState: canvas,
      canvasFormat: canvas.format,
    });

    return NextResponse.json({
      reply: visibleText || rawReply,
      canvasState: canvas,
      patchesApplied: patches.length,
      rowsAdded: addTableRows.length,
      tablesReplaced: replaceTableRows.length,
      patchesSkipped: removeRegionIds.length - safeRemoveIds.length,
    });
  } catch (error: unknown) {
    console.error('[siep/report-copilot POST]', error);
    const msg = error instanceof Error ? error.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
