import type { CopilotHistoryMessage } from '@/lib/studio/copilot-history';
import {
  isStudioCopilotExplicitApproval,
  isStudioCopilotShortApproval,
} from '@/lib/studio/copilot-history';
import type { StudioCanvasPatch, StudioCanvasState } from '@/lib/studio/types';

/** Estado persistido na sessão Studio (context das mensagens assistant). */
export type StudioStructureSessionState = {
  status: 'pending_approval' | 'approved' | 'applied';
  proposalText: string;
  outline: string[];
  updatedAt: string;
};

const STRUCTURE_PROPOSAL_MARKERS = [
  /propuesta de estructura/i,
  /¿apruebas esta estructura/i,
  /aprob(?:as|ar) esta estructura/i,
  /proposta de estrutura/i,
  /approve this structure/i,
  /before (?:i )?edit(?:ing)? the document/i,
  /antes de (?:tocar|editar) el documento/i,
  /antes de editar o documento/i,
];

const DEVELOP_REQUEST_RE =
  /\b(desarroll\w*|implement\w*|aplic\w*|escrib\w*|redact\w*|desenvolv\w*|apply the structure|develop the structure|write out the structure|fill in the structure|crea(?:r)? (?:las )?secciones)\b/i;

const APPROVED_REF_RE =
  /\b(estructura aprobada|estructura que (?:est[aá]|qued[oó]) aprobada|la estructura que aprob|approved structure|estrutura aprovada)\b/i;

export function isStructureProposalContent(content: string): boolean {
  return STRUCTURE_PROPOSAL_MARKERS.some((re) => re.test(content));
}

/** Mensagem do assistente que pede aprovação de estrutura. */
export function findStructureProposalMessage(
  history: CopilotHistoryMessage[],
): CopilotHistoryMessage | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== 'assistant') continue;
    if (isStructureProposalContent(m.content)) return m;
  }
  return null;
}

export function readStudioStructureState(
  messages: Array<{ role: string; content: string; context?: unknown }>,
): StudioStructureSessionState | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant' || !m.context || typeof m.context !== 'object') continue;
    const ctx = m.context as Record<string, unknown>;
    const raw = ctx.studioStructureState;
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as Record<string, unknown>;
    if (typeof s.proposalText !== 'string' || !s.proposalText.trim()) continue;
    const status =
      s.status === 'approved' || s.status === 'applied' || s.status === 'pending_approval'
        ? s.status
        : 'pending_approval';
    const outline = Array.isArray(s.outline)
      ? s.outline.filter((x): x is string => typeof x === 'string')
      : extractStructureOutline(s.proposalText);
    return {
      status,
      proposalText: s.proposalText,
      outline,
      updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : new Date().toISOString(),
    };
  }

  const proposal = findStructureProposalMessage(messages);
  if (!proposal) return null;

  const proposalIdx = messages.findIndex((m) => m === proposal);
  const after = proposalIdx >= 0 ? messages.slice(proposalIdx + 1) : [];
  const userApproved = after.some(
    (m) => m.role === 'user' && isStructureApprovalMessage(m.content),
  );
  const assistantAckApproved = after.some(
    (m) =>
      m.role === 'assistant' &&
      /queda aprobada|estructura aprobada|estructura queda|ficou aprovada/i.test(m.content),
  );
  const userDevelop = after.some(
    (m) => m.role === 'user' && isStructureDevelopRequest(m.content),
  );

  let status: StudioStructureSessionState['status'] = 'pending_approval';
  if (userApproved || assistantAckApproved) status = 'approved';
  if (userDevelop && (userApproved || assistantAckApproved)) status = 'applied';

  return {
    status,
    proposalText: proposal.content,
    outline: extractStructureOutline(proposal.content),
    updatedAt: new Date().toISOString(),
  };
}

export function buildStudioStructureState(
  proposalText: string,
  status: StudioStructureSessionState['status'],
): StudioStructureSessionState {
  return {
    status,
    proposalText,
    outline: extractStructureOutline(proposalText),
    updatedAt: new Date().toISOString(),
  };
}

/** Utilizador aprovou a estrutura. */
export function isStructureApprovalMessage(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (isStudioCopilotShortApproval(t) || isStudioCopilotExplicitApproval(t)) return true;

  const n = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (/\b(aprobado|aprobe|aprob[eé]|apruebo|aprobo|confirmo)\b/.test(n)) {
    if (/estructura|propuesta|propuse|propusiste|tal como/.test(n)) return true;
    if (t.length <= 64) return true;
  }

  if (/queda aprobada|est[aá] aprobada|ficou aprovada/.test(n)) return true;

  return false;
}

/** Pedido para aplicar/desenvolver a estrutura já acordada. */
export function isStructureDevelopRequest(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  const n = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (APPROVED_REF_RE.test(n)) return true;
  if (
    DEVELOP_REQUEST_RE.test(n) &&
    /estructura|estrutura|structure|secciones|secoes|plan|documento/.test(n)
  ) {
    return true;
  }
  if (/\bdesarroll\w*/.test(n) && /\b(esa|la|esta|lo)\b/.test(n) && /estructura|estrutura|structure/.test(n)) {
    return true;
  }
  if (/\bdesenvolv\w*/.test(n) && /\b(essa|esta|a)\b/.test(n) && /estrutura|structure/.test(n)) {
    return true;
  }
  if (/lo que estoy pidiendo/.test(n) && /estructura|desarroll|aplic|implement/.test(n)) return true;

  return false;
}

export type StructureSection = {
  title: string;
  bullets: string[];
};

/** Extrai títulos de secção da proposta markdown. */
export function extractStructureOutline(proposalText: string): string[] {
  return parseStructureProposalSections(proposalText).map((s) => s.title);
}

/** Parseia proposta em secções com sub-itens. */
export function parseStructureProposalSections(proposalText: string): StructureSection[] {
  const sections: StructureSection[] = [];
  let current: StructureSection | null = null;

  for (const line of proposalText.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('---') || t.startsWith('⚠️')) continue;

    const h = t.match(/^#{1,4}\s+(.+)$/);
    if (h) {
      const title = h[1].replace(/\*\*/g, '').trim();
      if (/^propuesta de estructura/i.test(title)) continue;
      current = { title, bullets: [] };
      sections.push(current);
      continue;
    }

    const bold = t.match(/^\*\*(.+?)\*\*$/);
    if (bold) {
      current = { title: bold[1].trim(), bullets: [] };
      sections.push(current);
      continue;
    }

    const sub = t.match(/^-\s+(.+)$/);
    if (sub && current) {
      current.bullets.push(sub[1].trim());
    }
  }

  return sections.filter((s) => s.title.length > 2 && !/^notas antes/i.test(s.title));
}

function structureTargetBlocks(canvas: StudioCanvasState) {
  return canvas.pages.flatMap((p) => p.blocks);
}

/** Aplica títulos da estrutura (fallback mínimo). */
export function buildStructureApprovalPatches(
  canvas: StudioCanvasState,
  proposalText: string,
): StudioCanvasPatch[] {
  return buildStructureDevelopPatches(canvas, proposalText);
}

/**
 * Desenvolve estrutura aprovada: título + bullets por secção nos blocos existentes.
 */
export function buildStructureDevelopPatches(
  canvas: StudioCanvasState,
  proposalText: string,
): StudioCanvasPatch[] {
  const sections = parseStructureProposalSections(proposalText);
  if (!sections.length) return [];

  const blocks = structureTargetBlocks(canvas);
  if (!blocks.length) return [];

  const patches: StudioCanvasPatch[] = [];
  let blockIdx = 0;

  for (const section of sections) {
    if (blockIdx >= blocks.length) break;

    const headingBlock = blocks[blockIdx];
    patches.push({
      blockId: headingBlock.id,
      kind: 'heading',
      title: section.title.slice(0, 120),
      text: section.title,
    });
    blockIdx++;

    const bodyText =
      section.bullets.length > 0
        ? section.bullets.map((b) => `- ${b}`).join('\n')
        : '(Contenido pendiente de desarrollar.)';

    if (blockIdx < blocks.length) {
      const bodyBlock = blocks[blockIdx];
      patches.push({
        blockId: bodyBlock.id,
        kind: section.bullets.length ? 'bullets' : 'paragraph',
        title: section.title.slice(0, 80),
        text: bodyText,
      });
      blockIdx++;
    }
  }

  return patches;
}

export function buildStructureApprovalSystemAddendum(
  proposalText: string,
  locale: string,
  mode: 'apply' | 'develop' = 'apply',
): string {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  if (mode === 'develop') {
    if (loc === 'es') {
      return `## DESARROLLAR ESTRUCTURA APROBADA — APLICAR AHORA
El usuario pide DESARROLLAR/APLICAR la estructura ya aprobada. La propuesta está abajo.
- **Prohibido** preguntar "¿a qué estructura te refieres?" — es la de abajo.
- **Prohibido** pedir confirmación o más contexto.
- **Obligatorio** devolver \`canvasPatches\` que implementen TODAS las secciones (títulos + contenido inicial/bullets).

### Estructura aprobada:
${proposalText.slice(0, 12000)}`;
    }
    if (loc === 'en') {
      return `## DEVELOP APPROVED STRUCTURE — APPLY NOW
The user asks to DEVELOP/APPLY the already approved structure below.
- Do **not** ask which structure they mean.
- You **must** return \`canvasPatches\` implementing ALL sections.

### Approved structure:
${proposalText.slice(0, 12000)}`;
    }
    return `## DESENVOLVER ESTRUTURA APROVADA — APLICAR AGORA
O utilizador pede DESENVOLVER/APLICAR a estrutura já aprovada abaixo.
- **Proibido** perguntar a qual estrutura se refere.
- **Obrigatório** devolver \`canvasPatches\` com TODAS as secções.

### Estrutura aprovada:
${proposalText.slice(0, 12000)}`;
  }

  const header =
    loc === 'es'
      ? `## APROBACIÓN DE ESTRUCTURA — APLICAR AHORA
El usuario acaba de APROBAR la siguiente propuesta. Debes implementarla en el documento con \`canvasPatches\` en ESTE turno.

### Propuesta aprobada:
`
      : loc === 'en'
        ? `## STRUCTURE APPROVAL — APPLY NOW
Implement the approved proposal below with \`canvasPatches\` in THIS turn.

### Approved proposal:
`
        : `## APROVAÇÃO DE ESTRUTURA — APLICAR AGORA
Implementa a proposta aprovada abaixo com \`canvasPatches\` NESTE turno.

### Proposta aprovada:
`;

  return `${header}${proposalText.slice(0, 12000)}`;
}

export function structureApplySuccessMessage(
  locale: string,
  patchCount: number,
  mode: 'apply' | 'develop' | 'migrate',
): string {
  if (locale === 'es') {
    if (mode === 'migrate') {
      return `Estructura aplicada y contenido migrado (${patchCount} cambio${patchCount === 1 ? '' : 's'}). Revisa cada sección; pídeme ajustes puntuales si hace falta.`;
    }
    return mode === 'develop'
      ? `He desarrollado la estructura aprobada en el documento (${patchCount} cambio${patchCount === 1 ? '' : 's'}). Revisa las secciones y pídeme ajustes puntuales si hace falta.`
      : `Estructura aprobada aplicada al documento (${patchCount} sección${patchCount === 1 ? '' : 'es'} actualizada${patchCount === 1 ? '' : 's'}).`;
  }
  if (locale === 'en') {
    if (mode === 'migrate') {
      return `Structure applied and content migrated (${patchCount} change${patchCount === 1 ? '' : 's'}). Review each section; ask for targeted edits if needed.`;
    }
    return mode === 'develop'
      ? `I've developed the approved structure in the document (${patchCount} change${patchCount === 1 ? '' : 's'}). Review the sections and ask for targeted edits if needed.`
      : `Approved structure applied (${patchCount} section${patchCount === 1 ? '' : 's'} updated).`;
  }
  if (mode === 'migrate') {
    return `Estrutura aplicada e conteúdo migrado (${patchCount} alteração${patchCount === 1 ? '' : 'ões'}). Revê cada secção.`;
  }
  return mode === 'develop'
    ? `Desenvolvi a estrutura aprovada no documento (${patchCount} alteração${patchCount === 1 ? '' : 'ões'}).`
    : `Estrutura aprovada aplicada (${patchCount} secção${patchCount === 1 ? '' : 'ões'} actualizada${patchCount === 1 ? '' : 's'}).`;
}
