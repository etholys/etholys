import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import type { GeminiPart } from '@/lib/gemini-client';
import { geminiGenerateContent } from '@/lib/gemini-client';
import { buildGeminiAttachmentsFromFiles } from '@/lib/nexus-chat-attachments';
import { tryMergeNexusMirrorAfterCopilotReply } from '@/lib/nexus-mirror-extract';
import { buildNexusAdvisorContextBlock } from '@/lib/nexus-ai-context';
import { buildNexusCopilotSnapshot } from '@/lib/nexus-copilot-snapshot';
import {
  buildDesignPartnerSupportingContext,
  buildNexusDesignPartnerSystemLayer,
  nexusBootstrapOpeningInstruction,
  type CopilotLocale,
} from '@/lib/nexus-copilot-prompts';
import { safeVentureStage, buildNexusQuickSteps } from '@/lib/nexus-guides';
import { loadNetworkForTenant } from '@/lib/nexus-network';
import type { VentureStageId } from '@/lib/nexus-venture';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parseAdvisorPostBody(req: NextRequest): Promise<
  | {
      ok: true;
      body: Record<string, unknown>;
      attachmentGeminiParts: GeminiPart[];
      attachmentSummarySuffix: string;
      attachmentsMeta: Array<{ name: string; mimeType: string; size: number }>;
    }
  | { ok: false; error: string; status?: number }
> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('multipart/form-data')) {
    try {
      const body = (await req.json()) as Record<string, unknown>;
      return {
        ok: true,
        body,
        attachmentGeminiParts: [],
        attachmentSummarySuffix: '',
        attachmentsMeta: [],
      };
    } catch {
      return { ok: false, error: 'Invalid JSON body', status: 400 };
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return { ok: false, error: 'Corpo multipart inválido.', status: 400 };
  }

  let nexusBoostParsed: Record<string, unknown> | undefined;
  const nj = formData.get('nexusBoost');
  if (typeof nj === 'string' && nj.trim()) {
    try {
      nexusBoostParsed = JSON.parse(nj) as Record<string, unknown>;
    } catch {
      return { ok: false, error: 'nexusBoost JSON inválido', status: 400 };
    }
  }

  const body: Record<string, unknown> = {
    nexusMode: (formData.get('nexusMode') as string | null) ?? undefined,
    bootstrapNexus: formData.get('bootstrapNexus') === 'true',
    nexusLocale: (formData.get('nexusLocale') as string | null) ?? 'pt',
    nexusBoost: nexusBoostParsed,
    message: typeof formData.get('message') === 'string' ? formData.get('message') : '',
    companyId: (formData.get('companyId') as string | null) ?? undefined,
    agentId: (formData.get('agentId') as string | null) ?? undefined,
    folderPath: (formData.get('folderPath') as string | null) ?? undefined,
  };

  const rawFiles = formData.getAll('files');
  const blobs: Blob[] = [];
  const names: string[] = [];
  for (const x of rawFiles) {
    if (x instanceof Blob && x.size > 0) {
      blobs.push(x);
      const fname = typeof (x as Blob & { name?: string }).name === 'string' ? (x as File).name : '';
      names.push(fname?.trim() || `anexo-${blobs.length}`);
    }
  }

  if (body.bootstrapNexus === true && blobs.length > 0) {
    return { ok: false, error: 'Não envie ficheiros na abertura; envie primeiro a mensagem de boas‑vindas.', status: 400 };
  }

  if (blobs.length === 0) {
    return {
      ok: true,
      body,
      attachmentGeminiParts: [],
      attachmentSummarySuffix: '',
      attachmentsMeta: [],
    };
  }

  try {
    const built = await buildGeminiAttachmentsFromFiles(blobs, names);
    return {
      ok: true,
      body,
      attachmentGeminiParts: built.geminiParts,
      attachmentSummarySuffix: built.summaryLine,
      attachmentsMeta: built.meta,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Anexo inválido.',
      status: 400,
    };
  }
}

async function getCompanyContext(companyId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const in30d = new Date(now.getTime() + 30 * 86400000);

  const [
    company, projects, tasks, invoices, products, employees,
    proposals, funds, incomeAgg, expenseAgg, monthIncomeAgg, monthExpenseAgg, topExpensesMonth, topIncomeMonth, memories,
  ] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true, currency: true, businessActivity: true } }),
    prisma.project.findMany({ where: { companyId, isActive: true }, select: { name: true, status: true, progress: true, budget: true, spent: true, endDate: true }, take: 15 }),
    prisma.task.findMany({ where: { companyId, isActive: true, status: { notIn: ['DONE', 'CANCELLED'] } }, select: { title: true, status: true, priority: true, dueDate: true }, orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }], take: 20 }),
    prisma.invoice.findMany({ where: { companyId, isActive: true, status: { notIn: ['PAID', 'CANCELLED'] } }, select: { number: true, type: true, status: true, total: true, currency: true, dueDate: true, contactName: true }, take: 15 }),
    prisma.product.findMany({ where: { companyId, isActive: true, minStock: { not: null } }, select: { name: true, stockQty: true, minStock: true }, take: 15 }),
    prisma.employeeContract.findMany({ where: { companyId, isActive: true }, select: { position: true, contractType: true, endDate: true }, take: 15 }),
    prisma.proposal.findMany({ where: { companyId, deletedAt: null }, select: { title: true, status: true, createdAt: true }, take: 8 }),
    prisma.fund.findMany({ where: { companyId, isActive: true }, select: { name: true, institution: true, status: true, deadline: true, amount: true, currency: true }, take: 8 }),
    prisma.transaction.aggregate({ where: { companyId, type: 'INCOME' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { companyId, type: 'EXPENSE' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { companyId, type: 'INCOME', date: { gte: monthStart, lt: nextMonthStart } }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { companyId, type: 'EXPENSE', date: { gte: monthStart, lt: nextMonthStart } }, _sum: { amount: true } }),
    prisma.transaction.findMany({
      where: { companyId, type: 'EXPENSE', date: { gte: monthStart, lt: nextMonthStart } },
      select: { title: true, amount: true, category: true },
      orderBy: { amount: 'desc' },
      take: 8,
    }),
    prisma.transaction.findMany({
      where: { companyId, type: 'INCOME', date: { gte: monthStart, lt: nextMonthStart } },
      select: { title: true, amount: true, category: true },
      orderBy: { amount: 'desc' },
      take: 8,
    }),
    prisma.aiCompanyMemory.findMany({ where: { companyId, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, select: { category: true, key: true, value: true }, orderBy: { updatedAt: 'desc' }, take: 20 }),
  ]);

  const overdueInvoices = invoices.filter((i) => i.dueDate && new Date(i.dueDate) < now);
  const overdueItems    = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now);
  const lowStock        = products.filter((p) => p.minStock !== null && p.stockQty <= (p.minStock ?? 0));
  const expiringContracts = employees.filter((e) => e.endDate && new Date(e.endDate) <= in30d);
  const fundDeadlines   = funds.filter((f) => f.deadline && new Date(f.deadline) <= in30d);

  const balance = (incomeAgg._sum.amount ?? 0) - (expenseAgg._sum.amount ?? 0);
  const monthIncome = monthIncomeAgg._sum.amount ?? 0;
  const monthExpense = monthExpenseAgg._sum.amount ?? 0;
  const monthBalance = monthIncome - monthExpense;

  return {
    company,
    now: now.toISOString().slice(0, 10),
    projects,
    tasks: { total: tasks.length, overdue: overdueItems.map((t) => t.title) },
    finance: {
      balance,
      month: {
        periodStart: monthStart.toISOString().slice(0, 10),
        periodEndExclusive: nextMonthStart.toISOString().slice(0, 10),
        income: monthIncome,
        expense: monthExpense,
        balance: monthBalance,
        topExpenseLines: topExpensesMonth.map((t) => `${t.title || 'Despesa'} (${t.category || 'sem categoria'}): ${t.amount}`),
        topIncomeLines: topIncomeMonth.map((t) => `${t.title || 'Receita'} (${t.category || 'sem categoria'}): ${t.amount}`),
      },
      overdueInvoices: overdueInvoices.map((i) => `${i.number} (${i.total} ${i.currency}) - ${i.contactName}`),
    },
    inventory: { lowStock: lowStock.map((p) => `${p.name}: ${p.stockQty}/${p.minStock}`) },
    hr: { contracts: employees.length, expiringContracts: expiringContracts.map((e) => `${e.position} (até ${e.endDate?.toISOString().slice(0, 10)})`), pendingLeave: 0 },
    proposals: proposals.map((p) => ({ title: p.title, status: p.status })),
    funds: fundDeadlines.map((f) => ({ name: f.name, deadline: f.deadline, amount: f.amount, currency: f.currency })),
    memory: memories,
  };
}

function buildSystemPrompt(ctx: Awaited<ReturnType<typeof getCompanyContext>>): string {
  const ctxStr = JSON.stringify(ctx, null, 2);
  return `Você é o Etholys AI Advisor — o assistente central de inteligência da empresa "${ctx.company?.name}".

Você tem acesso ao estado real da empresa hoje (${ctx.now}). Responda sempre em português do Brasil, de forma clara, direta e útil. Seja um assessor de confiança: ajude a pessoa a tomar decisões, faça alertas proativos, responda perguntas sobre qualquer módulo (finanças, projetos, RH, estoque, faturas, propostas, fundos).

CONTEXTO ATUAL DA EMPRESA:
${ctxStr}

INSTRUÇÕES:
- Use os dados acima para dar respostas embasadas na realidade da empresa
- Se houver alertas urgentes (faturas vencidas, tarefas atrasadas, estoque baixo), proativamente os mencione quando relevante
- Se o usuário perguntar sobre algo que não está nos dados, diga que não tem essa informação no momento
- Não invente dados. Use apenas o que está no CONTEXTO ATUAL
- Quando for resumir finanças, mencione o saldo atual
- Seja conciso mas completo. Use listas quando ajudar na clareza
- Memória da empresa (histórico de decisões importantes): se existir, use como contexto adicional`;
}

// ---------------------------------------------------------------------------
// Route Handlers
// ---------------------------------------------------------------------------

/** GET /api/ai/advisor/[sessionId] — fetch messages */
export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const advisorSession = await prisma.aiAdvisorSession.findFirst({
    where: { id: params.sessionId, userId: user.id },
    include: {
      messages: { orderBy: { createdAt: 'asc' }, select: { id: true, role: true, content: true, createdAt: true } },
    },
  });

  if (!advisorSession) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json(advisorSession);
}

/** POST /api/ai/advisor/[sessionId] — send message, get AI reply */
export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: { companyUsers: { where: { isDefault: true }, take: 1 } },
  });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  let companyId: string | null = user.companyUsers[0]?.companyId ?? null;
  if (!companyId) {
    const any = await prisma.companyUser.findFirst({ where: { userId: user.id } });
    companyId = any?.companyId ?? null;
  }
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const parsedBody = await parseAdvisorPostBody(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status ?? 400 });
  }
  const { body, attachmentGeminiParts, attachmentSummarySuffix, attachmentsMeta } = parsedBody;

  const nexusMode = (body.nexusMode as string | undefined) || undefined;
  const bootstrapNexus = body.bootstrapNexus === true;
  const rawLoc = (body.nexusLocale as string) || 'pt';
  const nexusLocale: CopilotLocale = rawLoc === 'es' || rawLoc === 'en' ? rawLoc : 'pt';

  const useDesignPartner = nexusMode === 'design_partner' || bootstrapNexus;

  const nexusBoost = body.nexusBoost as { networkId?: string; projectId?: string } | undefined;
  const baseMessage = (body.message as string)?.trim() ?? '';
  const userMessage = (
    (baseMessage ||
      (attachmentSummarySuffix ? '(Documento(s) ou imagem(ns) anexado(s). Responde com base no conteúdo.)' : '')) +
    attachmentSummarySuffix
  ).trim();
  const requestedCompanyId = typeof body.companyId === 'string' ? body.companyId.trim() : '';
  const agentId = typeof body.agentId === 'string' ? body.agentId.trim() : null;
  const activeFolderPath = typeof body.folderPath === 'string' ? body.folderPath.trim() : null;

  const tenantRows = await prisma.companyUser.findMany({
    where: { userId: user.id },
    select: { companyId: true },
  });
  const tenantCompanyIds = [...new Set(tenantRows.map((r) => r.companyId))];
  if (requestedCompanyId && tenantCompanyIds.includes(requestedCompanyId)) {
    companyId = requestedCompanyId;
  }

  // Verify session belongs to user
  const advisorSession = await prisma.aiAdvisorSession.findFirst({
    where: { id: params.sessionId, userId: user.id, companyId },
  });
  if (!advisorSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const messageCount = await prisma.aiAdvisorMessage.count({ where: { sessionId: advisorSession.id } });
  if (bootstrapNexus && messageCount > 0) {
    return NextResponse.json({ error: 'A conversa já começou. Recarregue a página.' }, { status: 400 });
  }
  if (!bootstrapNexus && !userMessage.trim()) {
    return NextResponse.json({ error: 'Escreva uma mensagem ou anexe pelo menos um ficheiro.' }, { status: 400 });
  }

  /* Garantir que assessor workspace e Copiloto NEXUS não partilham o mesmo "modo" na mesma sessão */
  let sessionKind = advisorSession.kind;
  const titleLooksLikeNexus =
    !!advisorSession.title &&
    (advisorSession.title.includes('NEXUS') || /copiloto|co-pilot|copilot/i.test(advisorSession.title));

  if (useDesignPartner && sessionKind === 'WORKSPACE_ADVISOR') {
    if (bootstrapNexus || messageCount === 0 || titleLooksLikeNexus) {
      await prisma.aiAdvisorSession.update({
        where: { id: advisorSession.id },
        data: { kind: 'NEXUS_COPILOT' },
      });
      sessionKind = 'NEXUS_COPILOT';
    } else {
      return NextResponse.json(
        {
          error:
            'Esta sessão é do assessor workspace. Para o Copiloto NEXUS utilize /hub/nexus e inicie a conversa a partir daí.',
          code: 'SESSION_KIND_MISMATCH',
        },
        { status: 409 },
      );
    }
  }

  if (!useDesignPartner && sessionKind === 'NEXUS_COPILOT') {
    return NextResponse.json(
      {
        error:
          'Esta conversa é do Copiloto NEXUS (/hub/nexus). Para o assessor Etholys (Centro ou chat com IA contexto) abra uma conversa nova.',
        code: 'NEXUS_SESSION_REQUIRES_WORKSPACE_MODE',
      },
      { status: 409 },
    );
  }

  /* Últimas 10 mensagens em ordem cronológica (asc+take antes pegava as 10 MAIS ANTIGAS) */
  const historyDesc = await prisma.aiAdvisorMessage.findMany({
    where: { sessionId: advisorSession.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { role: true, content: true },
  });
  const history = historyDesc.slice().reverse();

  // Load agent instructions and folder files in parallel with context
  const [ctx, agentRow, folderFileRows] = await Promise.all([
    getCompanyContext(companyId),
    agentId
      ? prisma.aiCompanyMemory.findFirst({
          where: { companyId, category: 'ai_agents', key: agentId },
          select: { value: true },
        })
      : Promise.resolve(null),
    activeFolderPath
      ? prisma.aiCompanyMemory.findMany({
          where: { companyId, category: 'chat_folder_files' },
          select: { value: true },
          orderBy: { createdAt: 'asc' },
        })
      : Promise.resolve([]),
  ]);

  let systemPrompt = useDesignPartner
    ? buildDesignPartnerSupportingContext(nexusLocale, {
        company: ctx.company ?? null,
        now: ctx.now,
      })
    : buildSystemPrompt(ctx);
  let ventureStage: VentureStageId = 'DISCOVER';
  if (nexusBoost?.networkId) {
    const netw = await loadNetworkForTenant(nexusBoost.networkId, tenantCompanyIds);
    if (netw) {
      const s = await prisma.nexusVentureState.findUnique({ where: { networkId: netw.id } });
      ventureStage = safeVentureStage(s?.stage);
    }
  } else {
    const s = await prisma.nexusVentureState.findUnique({ where: { companyId } });
    ventureStage = safeVentureStage(s?.stage);
  }

  if (useDesignPartner) {
    const copilotSnapshot = await buildNexusCopilotSnapshot(prisma, {
      companyId,
      tenantCompanyIds,
      networkId: nexusBoost?.networkId,
      locale: nexusLocale,
    });
    systemPrompt = `${buildNexusDesignPartnerSystemLayer(nexusLocale, copilotSnapshot, ventureStage)}\n\n${systemPrompt}`;
  }

  // Inject custom agent instructions
  if (agentRow) {
    try {
      const agentData = JSON.parse(agentRow.value) as { name?: string; systemPrompt?: string; description?: string };
      if (agentData.systemPrompt) {
        const companyCtxEmbed = useDesignPartner
          ? JSON.stringify({ company: ctx.company, now: ctx.now }, null, 2)
          : JSON.stringify(ctx, null, 2);
        systemPrompt = `${agentData.systemPrompt}\n\nCONTEXTO DA EMPRESA (use quando relevante):\n${companyCtxEmbed}`;
      }
    } catch { /* ignore malformed agent */ }
  }

  // Inject folder reference files
  if (folderFileRows.length > 0) {
    const normPath = (p: string) => p.split('/').map((s) => s.trim()).filter(Boolean).join('/');
    const targetPath = activeFolderPath ? normPath(activeFolderPath) : null;
    const relevantFiles: Array<{ name: string; content: string }> = [];
    for (const row of folderFileRows) {
      try {
        const f = JSON.parse(row.value) as { folderPath?: string; name?: string; content?: string };
        if (!f.name || !f.content) continue;
        if (!targetPath || normPath(f.folderPath || '') === targetPath) {
          relevantFiles.push({ name: f.name, content: f.content });
        }
      } catch { /* ignore */ }
    }
    if (relevantFiles.length > 0) {
      const filesBlock = relevantFiles
        .map((f) => `--- Arquivo: ${f.name} ---\n${f.content}`)
        .join('\n\n');
      systemPrompt += `\n\nARQUIVOS DE REFERÊNCIA DA PASTA (use como contexto adicional obrigatório):\n${filesBlock}`;
    }
  }

  const hasAttachments = attachmentGeminiParts.length > 0;
  if (hasAttachments) {
    const attachmentBlurb =
      nexusLocale === 'es'
        ? 'DOCUMENTOS DE ESTE TURNO: hay archivo(s) adjunto(s) al mensaje siguiente. Lee el contenido junto al texto del usuario y responde citando los nombres de archivo cuando proceda; si Gemini no puede interpretar un formato, dímelo con claridad.'
        : nexusLocale === 'en'
          ? 'TURN DOCUMENTS: one or more files are attached to the following user prompt. Read them together with the user text and answer; cite filenames when relevant. If the model cannot reliably read a MIME type or format, say so clearly.'
          : useDesignPartner
            ? 'DOCUMENTOS DESTE TURNO: há anexo(s) ligados ao pedido seguinte. Lê o conteúdo em conjunto com o texto do utilizador e responde; cita nomes de ficheiros quando fizer sentido. Se um formato não for interpretável com fiabilidade, diz isso com clareza.'
            : 'DOCUMENTOS DESTE TURNO: há anexo(s) ligados ao pedido seguinte. Lê o conteúdo em conjunto com o texto do utilizador e responde com base nele; cita nomes de ficheiros quando fizer sentido. Se um formato não for interpretável, indica limitação.';
    systemPrompt += `\n\n${attachmentBlurb}`;
  }

  if (nexusBoost?.networkId || nexusBoost?.projectId) {
    const nexusBlock = await buildNexusAdvisorContextBlock(prisma, tenantCompanyIds, {
      networkId: typeof nexusBoost.networkId === 'string' ? nexusBoost.networkId.trim() : undefined,
      projectId: typeof nexusBoost.projectId === 'string' ? nexusBoost.projectId.trim() : undefined,
    });
    if (nexusBlock) {
      const nexusVoice =
        nexusLocale === 'es'
          ? 'Este bloque aporta contexto de rede/proyecto del programa Nexus. Aquí só actúas como copiloto de negocios/diagnóstico NEXUS (no como panel financiero global de Etholys). Respondé siempre en español salvo petición explícita de otro idioma.'
          : nexusLocale === 'en'
            ? 'This block adds programme/network context only. Stay the NEXUS business/diagnosis co‑pilot here—not the dashboard Etholys Workspace Advisor persona. Reply in English unless the user switches language.'
            : 'Este bloco traz apenas contexto técnico de rede/projecto Nexus. Mantém-te só no copiloto de negócio/diagnóstico NEXUS — não uses a persona de “painel financiero” global do workspace. PT-BR salvo pedido explícito noutro idioma.';
      systemPrompt += `\n\n${nexusBlock}\n\nCONTEXT NEXUS: ${nexusVoice}`;
    }
  }

  const netIdForSteps = typeof nexusBoost?.networkId === 'string' ? nexusBoost.networkId.trim() : null;
  const bootstrapQuickSteps = buildNexusQuickSteps(ventureStage, netIdForSteps ?? null);
  const bootstrapHighStep = bootstrapQuickSteps.find((s) => s.emphasis === 'high') ?? bootstrapQuickSteps[0];
  const bootstrapPriorityHint = bootstrapHighStep
    ? {
        stepId: bootstrapHighStep.id,
        title:
          nexusLocale === 'es'
            ? bootstrapHighStep.titleEs
            : nexusLocale === 'en'
              ? bootstrapHighStep.titleEn
              : bootstrapHighStep.titlePt,
        hint:
          nexusLocale === 'es'
            ? bootstrapHighStep.hintEs
            : nexusLocale === 'en'
              ? bootstrapHighStep.hintEn
              : bootstrapHighStep.hintPt,
      }
    : null;

  // Build conversation-aware user text (include history)
  let fullUserText: string;
  if (bootstrapNexus) {
    fullUserText = nexusBootstrapOpeningInstruction(nexusLocale, bootstrapPriorityHint);
  } else if (history.length > 0) {
    const historyText = history
      .map((m) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`)
      .join('\n\n');
    fullUserText = `HISTÓRICO DA CONVERSA:\n${historyText}\n\nNOVA MENSAGEM DO USUÁRIO:\n${userMessage}`;
  } else {
    fullUserText = userMessage;
  }

  if (!bootstrapNexus) {
    await prisma.aiAdvisorMessage.create({
      data: {
        sessionId: advisorSession.id,
        role: 'user',
        content: userMessage,
        ...(attachmentsMeta.length > 0 ? { context: { attachments: attachmentsMeta } } : {}),
      },
    });
    console.log('[AI Advisor POST] User message SAVED', {
      sessionId: advisorSession.id,
      userMessage: userMessage.slice(0, 50),
      attachments: attachmentsMeta.length,
    });
  } else {
    console.log('[AI Advisor POST] Copiloto NEXUS — abertura (sem gravação de mensagem do utilizador)', {
      sessionId: advisorSession.id,
    });
  }

  // Call Gemini
  let aiText: string;
  try {
    const result = await geminiGenerateContent({
      systemInstruction: systemPrompt,
      userText: fullUserText,
      userParts: hasAttachments ? attachmentGeminiParts : undefined,
      maxOutputTokens: bootstrapNexus ? 1024 : 2048,
      temperature: useDesignPartner ? 0.52 : 0.3,
    });
    aiText = result.text;
  } catch (err) {
    console.error('[AI Advisor] Gemini error:', err);
    return NextResponse.json({ error: 'AI unavailable', detail: String(err) }, { status: 503 });
  }

  // Save AI response
  const aiMessage = await prisma.aiAdvisorMessage.create({
    data: {
      sessionId: advisorSession.id,
      role: 'assistant',
      content: aiText,
      context: { summaryAt: ctx.now, balance: ctx.finance.balance },
    },
  });
  console.log('[AI Advisor POST] AI message SAVED', { sessionId: advisorSession.id, aiMessageId: aiMessage.id, aiText: aiText.slice(0, 50) });

  if (useDesignPartner && !bootstrapNexus) {
    try {
      await tryMergeNexusMirrorAfterCopilotReply(prisma, advisorSession.id, aiText, nexusLocale);
    } catch (e) {
      console.error('[NEXUS mirror extract]', e);
    }
  }

  // Auto-set session title from first user message
  if (bootstrapNexus) {
    await prisma.aiAdvisorSession.update({
      where: { id: advisorSession.id },
      data: { title: 'NEXUS — Copiloto (negócio & marca)', kind: 'NEXUS_COPILOT' },
    });
  } else if (!advisorSession.title && history.length === 0) {
    const shortTitle = userMessage.slice(0, 60) + (userMessage.length > 60 ? '…' : '');
    await prisma.aiAdvisorSession.update({
      where: { id: advisorSession.id },
      data: { title: shortTitle },
    });
  } else {
    await prisma.aiAdvisorSession.update({
      where: { id: advisorSession.id },
      data: { updatedAt: new Date() },
    });
  }

  return NextResponse.json({ message: aiMessage });
}

/** DELETE /api/ai/advisor/[sessionId] — delete session */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  await prisma.aiAdvisorSession.deleteMany({
    where: { id: params.sessionId, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
