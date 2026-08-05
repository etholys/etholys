import { prisma } from '@/lib/prisma';
import { llmGenerateContent, hasLlmApiKey } from '@/lib/llm-client';
import { buildAnvilSystemPrompt } from './prompts';
import { checkProjectPolicy } from './policy';
import type { LabAnvilAgentMeta, LabAnvilProjectContext } from './types';

function extractJsonBlock(text: string): LabAnvilAgentMeta | null {
  const fence = /```json\s*([\s\S]*?)\s*```/i.exec(text);
  const raw = fence ? fence[1] : null;
  if (!raw) {
    const loose = /\{\s*"plan"\s*:[\s\S]*\}\s*$/.exec(text.trim());
    if (!loose) return null;
    try {
      return JSON.parse(loose[0]) as LabAnvilAgentMeta;
    } catch {
      return null;
    }
  }
  try {
    return JSON.parse(raw) as LabAnvilAgentMeta;
  } catch {
    return null;
  }
}

export async function runAnvilAgentTurn(opts: {
  sessionId: string;
  userMessage: string;
  userId: string;
}) {
  const session = await prisma.labAnvilSession.findUnique({
    where: { id: opts.sessionId },
    include: {
      project: { include: { agent: true, deployTargets: true } },
      messages: { orderBy: { createdAt: 'asc' }, take: 40 },
    },
  });
  if (!session) throw new Error('Sessão não encontrada');
  if (session.status !== 'open') throw new Error('Sessão fechada');

  const project = session.project as LabAnvilProjectContext & {
    agent: { id: string; systemPromptExtra: string | null } | null;
    deployTargets: Array<{ kind: string; label: string; isDefault: boolean }>;
  };

  const policy = checkProjectPolicy(project, opts.userMessage);

  await prisma.labAnvilMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      content: opts.userMessage,
    },
  });

  if (!policy.ok) {
    const content =
      `⛔ Política ANVIL bloqueou este pedido.\n\n` +
      policy.blockedReasons.map((r) => `• ${r}`).join('\n') +
      `\n\nAlternativas típicas:\n` +
      `1. Consumir API Etholys (projeto consumes_etholys_api)\n` +
      `2. Usar/aprovar pacote em allowedReuse\n` +
      `3. Reimplementar o mínimo no repo público\n` +
      `4. Fazer a parte premium num projeto etholys_core / whitelabel separado`;

    const msg = await prisma.labAnvilMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content,
        metaJson: {
          policyWarnings: policy.warnings,
          blockedReasons: policy.blockedReasons,
          reuseDecision: 'none',
        },
      },
    });
    return { message: msg, blocked: true as const };
  }

  if (!hasLlmApiKey()) {
    const msg = await prisma.labAnvilMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content:
          'Chave LLM não configurada. Define ANTHROPIC_API_KEY ou LLM_API_KEY no .env para o agente gerar planos e código.',
        metaJson: { policyWarnings: policy.warnings },
      },
    });
    return { message: msg, blocked: false as const };
  }

  if (project.agent) {
    await prisma.labAnvilAgent.update({
      where: { id: project.agent.id },
      data: { status: 'running', lastRunAt: new Date() },
    });
  }

  const history = session.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const deployList = project.deployTargets
    .map((t) => `- ${t.kind} (${t.label})${t.isDefault ? ' [default]' : ''}`)
    .join('\n');

  const system = buildAnvilSystemPrompt(project, project.agent?.systemPromptExtra);
  const userText = [
    policy.warnings.length ? `Avisos de política:\n${policy.warnings.map((w) => `- ${w}`).join('\n')}` : '',
    `Deploy targets deste projeto:\n${deployList || '(nenhum)'}`,
    history ? `Histórico recente:\n${history}` : '',
    `Pedido actual:\n${opts.userMessage}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const result = await llmGenerateContent({
      systemInstruction: system,
      userText,
      temperature: 0.3,
      maxOutputTokens: 8000,
    });

    const meta = extractJsonBlock(result.text) || {};
    if (policy.warnings.length) {
      meta.policyWarnings = [...(meta.policyWarnings || []), ...policy.warnings];
    }

    const msg = await prisma.labAnvilMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: result.text,
        metaJson: meta,
      },
    });

    if (!session.title) {
      const title = opts.userMessage.slice(0, 80);
      await prisma.labAnvilSession.update({
        where: { id: session.id },
        data: { title },
      });
    }

    if (project.agent) {
      await prisma.labAnvilAgent.update({
        where: { id: project.agent.id },
        data: { status: 'idle', lastRunAt: new Date() },
      });
    }

    return { message: msg, blocked: false as const };
  } catch (e) {
    if (project.agent) {
      await prisma.labAnvilAgent.update({
        where: { id: project.agent.id },
        data: { status: 'error' },
      });
    }
    throw e;
  }
}
