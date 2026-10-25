export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import {
  hasLlmApiKey,
  llmGenerateContent,
  publicLlmErrorMessage,
  PUBLIC_LLM_UNAVAILABLE,
  type LlmPart,
} from '@/lib/llm-client';
import { buildRadarAssistantContext } from '@/lib/radar/assistant/context';
import {
  buildContextBlock,
  buildSectorSystemPrompt,
} from '@/lib/radar/assistant/sector-agents';
import { hrefForAction, parseAssistantLlmJson } from '@/lib/radar/assistant/parse-actions';
import type { RadarAssistantAction } from '@/lib/radar/assistant/types';
import { radarLoc } from '@/lib/radar/i18n';
import { isRadarTaskSeverity } from '@/lib/radar/tasks';

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

type HistoryMsg = { role: 'user' | 'assistant'; content: string };

/**
 * POST /api/radar/assistant/chat
 * Body: { companyId, message, propertyId?, locale?, history?, imageBase64?, imageMimeType?, createSuggestedTasks? }
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const propertyId = String(body.propertyId || '').trim() || null;
  const clientId = String(body.clientId || '').trim() || null;
  const message = String(body.message || '').trim();
  const loc = radarLoc(String(body.locale || 'pt'));
  const createSuggestedTasks = body.createSuggestedTasks !== false;
  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.replace(/^data:[^;]+;base64,/, '') : null;
  const imageMimeType =
    typeof body.imageMimeType === 'string' && body.imageMimeType.startsWith('image/')
      ? body.imageMimeType
      : 'image/jpeg';

  if (!message && !imageBase64) {
    return NextResponse.json({ error: 'Mensagem obrigatória.' }, { status: 400 });
  }

  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  if (!hasLlmApiKey()) {
    return NextResponse.json({ error: PUBLIC_LLM_UNAVAILABLE, code: 'llm_unavailable' }, { status: 503 });
  }

  const context = await buildRadarAssistantContext({
    companyId,
    propertyId,
    clientId,
    locale: loc,
  });

  const history: HistoryMsg[] = [];
  if (Array.isArray(body.history)) {
    for (const row of body.history.slice(-8)) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const role = r.role === 'assistant' ? 'assistant' : r.role === 'user' ? 'user' : null;
      const content = typeof r.content === 'string' ? r.content.trim().slice(0, 4000) : '';
      if (!role || !content) continue;
      history.push({ role, content });
    }
  }

  const systemInstruction = `${buildSectorSystemPrompt(context.sectorAgent, loc)}\n\n${buildContextBlock({
    propertyId: context.propertyId,
    propertyName: context.propertyName,
    moduleId: context.moduleId,
    sectorAgent: context.sectorAgent,
    checklist: context.checklist.map((c) => ({
      id: c.id,
      severity: c.severity,
      message: c.message[loc],
      href: c.href,
    })),
    alerts: context.alerts,
    openTasks: context.openTasks,
    recentCaderno: context.recentCaderno,
    sensors: context.sensors,
    spaces: context.spaces.map((s) => ({ id: s.id, name: s.name, propertyId: s.propertyId, placed: s.placed })),
    photoNote: imageBase64
      ? 'User attached a photo. Vision is enabled — describe hypotheses, not diagnoses.'
      : null,
  })}`;

  const userText =
    message ||
    (loc === 'es'
      ? '¿Qué ves en esta foto y qué debería hacer?'
      : loc === 'en'
        ? 'What do you see in this photo and what should I do?'
        : 'O que vês nesta foto e o que devo fazer?');

  const userParts: LlmPart[] = [{ text: userText }];
  if (imageBase64) {
    userParts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
  }

  let rawText: string;
  try {
    const result = await llmGenerateContent({
      systemInstruction,
      chatMessages: history,
      userParts,
      maxOutputTokens: 1800,
      temperature: 0.35,
      responseMimeType: 'application/json',
    });
    rawText = result.text;
  } catch (e: unknown) {
    console.error('[radar/assistant/chat]', e);
    return NextResponse.json({ error: publicLlmErrorMessage(e) }, { status: 502 });
  }

  const parsed = parseAssistantLlmJson(rawText);
  const qs = new URLSearchParams();
  qs.set('company', companyId);
  if (engagementId) qs.set('engagement', engagementId);
  if (clientId) qs.set('client', clientId);

  const actions: RadarAssistantAction[] = [];
  for (const a of parsed.actions) {
    if (a.type === 'create_task' && createSuggestedTasks && (a.title || a.label)) {
      const title = (a.title || a.label).slice(0, 200);
      const propId = a.propertyId || context.propertyId;
      let unitId = a.unitId || null;
      if (unitId) {
        const unit = await prisma.nexusOpsUnit.findFirst({
          where: { id: unitId, companyId, isActive: true },
          select: { id: true },
        });
        if (!unit) unitId = null;
      }
      if (propId) {
        const prop = await prisma.radarProperty.findFirst({ where: { id: propId, companyId } });
        if (!prop) {
          actions.push({ ...a, href: hrefForAction(a, qs.toString()) });
          continue;
        }
      }
      const severity = isRadarTaskSeverity(a.severity) ? a.severity : 'info';
      const created = await prisma.radarTask.create({
        data: {
          companyId,
          propertyId: propId,
          unitId,
          title,
          description: a.description || null,
          status: 'todo',
          severity,
          progressJson: [],
          sourceKey: `assistant:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 7)}`,
        },
      });
      actions.push({
        ...a,
        type: 'create_task',
        taskId: created.id,
        label: loc === 'es' ? 'Tarea creada' : loc === 'en' ? 'Task created' : 'Tarefa criada',
        href: `/hub/radar/tarefas?${qs}`,
      });
      continue;
    }
    actions.push({ ...a, href: hrefForAction(a, qs.toString()) });
  }

  return NextResponse.json({
    ok: true,
    reply: parsed.reply,
    actions,
    sectorAgent: context.sectorAgent,
    visionUsed: Boolean(imageBase64),
  });
}
