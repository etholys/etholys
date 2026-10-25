import type { RadarAssistantAction, RadarAssistantActionType } from '@/lib/radar/assistant/types';

const ACTION_TYPES = new Set<RadarAssistantActionType>([
  'create_task',
  'open_space',
  'open_caderno',
  'open_automation',
  'open_tasks',
  'open_property',
]);

function stripFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1].trim() : t;
}

export function parseAssistantLlmJson(raw: string): {
  reply: string;
  actions: RadarAssistantAction[];
} {
  const cleaned = stripFences(raw);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim() : cleaned;
    const actions: RadarAssistantAction[] = [];
    if (Array.isArray(parsed.actions)) {
      for (const row of parsed.actions) {
        if (!row || typeof row !== 'object') continue;
        const a = row as Record<string, unknown>;
        const type = String(a.type || '') as RadarAssistantActionType;
        if (!ACTION_TYPES.has(type)) continue;
        const label = String(a.label || a.title || type).trim().slice(0, 80);
        if (!label) continue;
        actions.push({
          type,
          label,
          title: typeof a.title === 'string' ? a.title.slice(0, 200) : undefined,
          description: typeof a.description === 'string' ? a.description.slice(0, 4000) : undefined,
          severity:
            a.severity === 'critical' || a.severity === 'warning' || a.severity === 'info'
              ? a.severity
              : undefined,
          propertyId: typeof a.propertyId === 'string' ? a.propertyId : null,
          unitId: typeof a.unitId === 'string' ? a.unitId : null,
        });
      }
    }
    return { reply: reply || '…', actions: actions.slice(0, 6) };
  } catch {
    return { reply: cleaned || '…', actions: [] };
  }
}

export function hrefForAction(action: RadarAssistantAction, qs: string): string {
  const params = new URLSearchParams(qs.startsWith('?') ? qs.slice(1) : qs);
  if (action.propertyId && (action.type === 'open_automation' || action.type === 'open_space' || action.type === 'open_property')) {
    if (action.type === 'open_automation') params.set('property', action.propertyId);
  }
  const suffix = params.toString() ? `?${params}` : '';
  switch (action.type) {
    case 'open_automation':
      return `/hub/radar/automatizacao${suffix}`;
    case 'open_caderno':
      return `/hub/radar/caderno${suffix}`;
    case 'open_tasks':
    case 'create_task':
      return `/hub/radar/tarefas${suffix}`;
    case 'open_space':
    case 'open_property':
      return action.propertyId
        ? `/hub/radar/properties/${action.propertyId}${suffix}`
        : `/hub/radar${suffix}`;
    default:
      return `/hub/radar${suffix}`;
  }
}
