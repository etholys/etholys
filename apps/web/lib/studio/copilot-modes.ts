import type { StudioStructureSessionState } from '@/lib/studio/structure-apply';

export const STUDIO_COPILOT_MODES = ['discuss', 'propose', 'apply', 'edit_selection'] as const;
export type StudioCopilotMode = (typeof STUDIO_COPILOT_MODES)[number];

export const STUDIO_COPILOT_ACTIONS = [
  'approve_structure',
  'apply_structure',
  'adjust_plan',
  'cancel_plan',
] as const;
export type StudioCopilotAction = (typeof STUDIO_COPILOT_ACTIONS)[number];

export function normalizeStudioCopilotMode(raw: unknown): StudioCopilotMode {
  if (typeof raw === 'string' && (STUDIO_COPILOT_MODES as readonly string[]).includes(raw)) {
    return raw as StudioCopilotMode;
  }
  return 'discuss';
}

export function normalizeStudioCopilotAction(raw: unknown): StudioCopilotAction | null {
  if (typeof raw === 'string' && (STUDIO_COPILOT_ACTIONS as readonly string[]).includes(raw)) {
    return raw as StudioCopilotAction;
  }
  return null;
}

export function inferStudioCopilotMode(opts: {
  requested?: StudioCopilotMode;
  targetBlockIds: string[];
  structureStatus?: StudioStructureSessionState['status'] | null;
}): StudioCopilotMode {
  if (opts.targetBlockIds.length) return 'edit_selection';
  if (opts.requested && opts.requested !== 'discuss') return opts.requested;
  if (opts.structureStatus === 'approved') return 'apply';
  if (opts.structureStatus === 'pending_approval') return 'propose';
  return opts.requested || 'discuss';
}

export function actionUserMessage(action: StudioCopilotAction, locale: string): string {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  const map: Record<StudioCopilotAction, Record<string, string>> = {
    approve_structure: {
      es: 'Aprobar estructura propuesta',
      en: 'Approve proposed structure',
      pt: 'Aprovar estrutura proposta',
    },
    apply_structure: {
      es: 'Aplicar estructura aprobada al documento',
      en: 'Apply approved structure to the document',
      pt: 'Aplicar estrutura aprovada ao documento',
    },
    adjust_plan: {
      es: 'Quiero ajustar el plan antes de aplicar',
      en: 'I want to adjust the plan before applying',
      pt: 'Quero ajustar o plano antes de aplicar',
    },
    cancel_plan: {
      es: 'Cancelar plan / empezar de nuevo',
      en: 'Cancel plan / start over',
      pt: 'Cancelar plano / recomeçar',
    },
  };
  return map[action][loc];
}

export function actionAssistantMessage(action: StudioCopilotAction, locale: string): string {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  const map: Record<StudioCopilotAction, Record<string, string>> = {
    approve_structure: {
      es: 'Estructura aprobada. Pulsa «Aplicar estructura» para escribirla en el documento, o «Ajustar plan» para cambios.',
      en: 'Structure approved. Click «Apply structure» to write it to the document, or «Adjust plan» for changes.',
      pt: 'Estrutura aprovada. Carrega «Aplicar estrutura» para escrever no documento, ou «Ajustar plano» para mudanças.',
    },
    apply_structure: {
      es: 'Aplicando estructura al documento…',
      en: 'Applying structure to the document…',
      pt: 'A aplicar estrutura ao documento…',
    },
    adjust_plan: {
      es: 'Modo conversación: dime qué quieres cambiar en el plan.',
      en: 'Discuss mode: tell me what you want to change in the plan.',
      pt: 'Modo conversa: diz o que queres mudar no plano.',
    },
    cancel_plan: {
      es: 'Plan cancelado. Puedes pedir una nueva estructura en modo Planear.',
      en: 'Plan cancelled. You can request a new structure in Plan mode.',
      pt: 'Plano cancelado. Podes pedir nova estrutura no modo Planear.',
    },
  };
  return map[action][loc];
}

export function pendingStructureActions(
  structure: StudioStructureSessionState | null | undefined,
): StudioCopilotAction[] {
  if (!structure) return [];
  if (structure.status === 'pending_approval') {
    return ['approve_structure', 'adjust_plan', 'cancel_plan'];
  }
  if (structure.status === 'approved') {
    return ['apply_structure', 'adjust_plan', 'cancel_plan'];
  }
  return [];
}

export function buildStudioCopilotModeAddendum(mode: StudioCopilotMode, locale: string): string {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  if (mode === 'discuss') {
    return loc === 'es'
      ? `## MODO ACTUAL: CONVERSAR
- Responde en el chat. **No** edites el documento (\`canvasPatches: []\`) salvo que el usuario pida explícitamente un cambio concreto.`
      : loc === 'en'
        ? `## CURRENT MODE: DISCUSS
- Chat only. Do **not** edit the document (\`canvasPatches: []\`) unless the user explicitly asks for a concrete change.`
        : `## MODO ACTUAL: CONVERSAR
- Responde no chat. **Não** edites o documento (\`canvasPatches: []\`) salvo pedido explícito de alteração concreta.`;
  }
  if (mode === 'propose') {
    return loc === 'es'
      ? `## MODO ACTUAL: PLANEAR
- Propón estructura/outline en \`message\`. **Prohibido** editar el documento: \`canvasPatches\` debe ser \`[]\`.
- Termina pidiendo confirmación; el usuario usará botones Aprobar/Ajustar/Aplicar.`
      : loc === 'en'
        ? `## CURRENT MODE: PLAN
- Propose structure/outline in \`message\`. Do **not** edit the document: \`canvasPatches\` must be \`[]\`.
- End by asking for confirmation; the user will use Approve/Adjust/Apply buttons.`
        : `## MODO ACTUAL: PLANEAR
- Propõe estrutura/outline em \`message\`. **Proibido** editar o documento: \`canvasPatches\` deve ser \`[]\`.
- Termina pedindo confirmação; o utilizador usa botões Aprovar/Ajustar/Aplicar.`;
  }
  if (mode === 'apply') {
    return loc === 'es'
      ? `## MODO ACTUAL: APLICAR
- El usuario quiere cambios en el documento. Devuelve \`canvasPatches\` obligatoriamente cuando corresponda.
- Si hay estructura aprobada pendiente, impleméntala ahora.`
      : loc === 'en'
        ? `## CURRENT MODE: APPLY
- The user wants document changes. Return \`canvasPatches\` when appropriate.
- If there is a pending approved structure, implement it now.`
        : `## MODO ACTUAL: APLICAR
- O utilizador quer alterações no documento. Devolve \`canvasPatches\` quando aplicável.
- Se há estrutura aprovada pendente, implementa agora.`;
  }
  return loc === 'es'
    ? `## MODO ACTUAL: EDITAR SELECCIÓN
- Solo puedes parchear los blockId del ámbito seleccionado.`
    : loc === 'en'
      ? `## CURRENT MODE: EDIT SELECTION
- You may only patch blockIds in the selected scope.`
      : `## MODO ACTUAL: EDITAR SELEÇÃO
- Só podes aplicar patches nos blockId do âmbito selecionado.`;
}

export function modeLabel(mode: StudioCopilotMode, locale: string): string {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  const labels: Record<StudioCopilotMode, Record<string, string>> = {
    discuss: { es: 'Conversar', en: 'Discuss', pt: 'Conversar' },
    propose: { es: 'Planear', en: 'Plan', pt: 'Planear' },
    apply: { es: 'Aplicar', en: 'Apply', pt: 'Aplicar' },
    edit_selection: { es: 'Editar selección', en: 'Edit selection', pt: 'Editar seleção' },
  };
  return labels[mode][loc];
}

export function actionLabel(action: StudioCopilotAction, locale: string): string {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  const labels: Record<StudioCopilotAction, Record<string, string>> = {
    approve_structure: { es: 'Aprobar estructura', en: 'Approve structure', pt: 'Aprovar estrutura' },
    apply_structure: { es: 'Aplicar estructura', en: 'Apply structure', pt: 'Aplicar estrutura' },
    adjust_plan: { es: 'Ajustar plan', en: 'Adjust plan', pt: 'Ajustar plano' },
    cancel_plan: { es: 'Cancelar plan', en: 'Cancel plan', pt: 'Cancelar plano' },
  };
  return labels[action][loc];
}
