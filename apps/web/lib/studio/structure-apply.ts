import type { CopilotHistoryMessage } from '@/lib/studio/copilot-history';
import {
  isStudioCopilotExplicitApproval,
  isStudioCopilotShortApproval,
} from '@/lib/studio/copilot-history';
import type { StudioCanvasPatch, StudioCanvasState } from '@/lib/studio/types';

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

const APPROVAL_PHRASES = [
  /^aprob/i,
  /^aprobo/i,
  /^apruebo/i,
  /^confirmo/i,
  /^confirmado/i,
  /^de acuerdo/i,
  /estructura tal como/i,
  /estructura como está/i,
  /tal como está/i,
  /^sim[,.\s!]*$/i,
  /^s[ií][,.\s!]*$/i,
  /^ok[,.\s!]*$/i,
  /^yes[,.\s!]*$/i,
  /^vale[,.\s!]*$/i,
  /^perfecto/i,
  /^adelante/i,
  /^hazlo/i,
  /^proceed/i,
];

/** Mensagem do assistente que pede aprovação de estrutura. */
export function findStructureProposalMessage(
  history: CopilotHistoryMessage[],
): CopilotHistoryMessage | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role !== 'assistant') continue;
    if (STRUCTURE_PROPOSAL_MARKERS.some((re) => re.test(m.content))) {
      return m;
    }
  }
  return null;
}

/** Utilizador aprovou a estrutura (curto, explícito ou mensagem longa de confirmação). */
export function isStructureApprovalMessage(message: string): boolean {
  const t = message.trim();
  if (!t) return false;
  if (isStudioCopilotShortApproval(t) || isStudioCopilotExplicitApproval(t)) return true;

  const n = t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (t.length <= 280 && APPROVAL_PHRASES.some((re) => re.test(n))) return true;

  if (/\b(aprobado|aprobe|aprob[eé]|apruebo|aprobo|confirmo)\b/.test(n)) {
    if (/estructura|propuesta|propuse|propusiste|tal como/.test(n)) return true;
    if (t.length <= 64) return true;
  }

  return false;
}

/** Extrai títulos de secção da proposta markdown. */
export function extractStructureOutline(proposalText: string): string[] {
  const out: string[] = [];
  for (const line of proposalText.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('---') || t.startsWith('⚠️')) continue;
    const h = t.match(/^#{1,4}\s+(.+)$/);
    if (h) {
      const title = h[1].replace(/\*\*/g, '').trim();
      if (/^propuesta de estructura/i.test(title)) continue;
      out.push(title);
      continue;
    }
    const bold = t.match(/^\*\*(.+?)\*\*$/);
    if (bold) {
      out.push(bold[1].trim());
      continue;
    }
    const sub = t.match(/^-\s+((?:\d+\.)*\d+\s+.+)$/);
    if (sub) {
      out.push(sub[1].trim());
    }
  }
  return out.filter((s) => s.length > 2 && !/^notas antes/i.test(s));
}

/** Blocos candidatos a receber títulos da nova estrutura (ordem do documento). */
function structureTargetBlocks(canvas: StudioCanvasState) {
  const all = canvas.pages.flatMap((p) => p.blocks);
  const headings = all.filter((b) => b.kind === 'heading');
  if (headings.length >= 3) return headings;
  return all.filter(
    (b) =>
      b.kind === 'heading' ||
      b.kind === 'paragraph' ||
      b.kind === 'bullets' ||
      b.kind === 'callout',
  );
}

/**
 * Fallback determinístico: aplica outline aprovado nos blocos existentes
 * quando o LLM devolve canvasPatches vazio.
 */
export function buildStructureApprovalPatches(
  canvas: StudioCanvasState,
  proposalText: string,
): StudioCanvasPatch[] {
  const sections = extractStructureOutline(proposalText);
  if (!sections.length) return [];

  const targets = structureTargetBlocks(canvas);
  if (!targets.length) return [];

  const patches: StudioCanvasPatch[] = [];
  const used = Math.min(sections.length, targets.length);

  for (let i = 0; i < used; i++) {
    patches.push({
      blockId: targets[i].id,
      kind: 'heading',
      title: sections[i].slice(0, 120),
      text: sections[i],
    });
  }

  if (sections.length > used && targets[0]) {
    const remainder = sections.slice(used).map((s) => `- ${s}`).join('\n');
    const existing = (targets[0].text || '').trim();
    patches.push({
      blockId: targets[0].id,
      kind: 'bullets',
      title: 'Índice de estructura',
      text: existing
        ? `${existing}\n\n## Estructura aprobada\n${remainder}`
        : `## Estructura aprobada\n${remainder}`,
    });
  }

  return patches;
}

export function buildStructureApprovalSystemAddendum(
  proposalText: string,
  locale: string,
): string {
  const loc = locale === 'es' ? 'es' : locale === 'en' ? 'en' : 'pt';
  const header =
    loc === 'es'
      ? `## APROBACIÓN DE ESTRUCTURA — APLICAR AHORA
El usuario acaba de APROBAR la siguiente propuesta. Debes implementarla en el documento con \`canvasPatches\` en ESTE turno.
- **Prohibido** decir que no tienes historial — la propuesta está abajo.
- **Prohibido** volver a pedir confirmación.
- **Obligatorio** devolver \`canvasPatches\` que reflejen la estructura (títulos de sección, reorganización).
- Puedes actualizar muchos bloques porque el usuario aprobó una reestructuración completa.

### Propuesta aprobada:
`
      : loc === 'en'
        ? `## STRUCTURE APPROVAL — APPLY NOW
The user just APPROVED the proposal below. Implement it in the document with \`canvasPatches\` in THIS turn.
- Do **not** say you lack history — the proposal is below.
- Do **not** ask for confirmation again.
- You **must** return \`canvasPatches\` reflecting the structure.

### Approved proposal:
`
        : `## APROVAÇÃO DE ESTRUTURA — APLICAR AGORA
O utilizador acabou de APROVAR a proposta abaixo. Implementa-a no documento com \`canvasPatches\` NESTE turno.
- **Proibido** dizer que não tens histórico — a proposta está abaixo.
- **Proibido** pedir confirmação outra vez.
- **Obrigatório** devolver \`canvasPatches\` que reflitam a estrutura.

### Proposta aprovada:
`;

  return `${header}${proposalText.slice(0, 12000)}`;
}
