import { prisma } from '@/lib/prisma';
import { geminiGenerateContent } from '@/lib/gemini-client';
import { extractFirstJsonObject } from '@/lib/extract-json-object';
import {
  canReparentTo,
  describeReparentError,
  flattenObjectives,
  wouldCreateCycle,
  type ObjectiveNode,
} from '@/lib/siep/objective-hierarchy';
import { summarizeFlatForAi } from '@/lib/siep/hierarchy-matrix';

export type ReparentLink = { id: string; parentId: string | null };

function buildReorganizePrompt(
  flatExport: unknown[],
  userInstructions?: string,
): string {
  const extra = userInstructions?.trim()
    ? `\n\nINSTRUÇÕES DO UTILIZADOR:\n${userInstructions.trim()}`
    : '';

  return `Você corrige a hierarquia de um marco lógico de projeto (SIEP / M&E).

CADEIA CANÓNICA (pai → filho):
goal ou impact → outcome (Resultado R) → objective (Obj. Específico OE) → output (Producto OP) → activity (Actividad A) → indicator

REGRAS:
- NÃO altere id, type, code nem title — só parentId.
- outcome deve ficar sob goal/impact quando existir; senão parentId null.
- objective (OE) deve ficar sob o outcome correcto (códigos R1, OE1, P1.1, A1.1a costumam partilhar prefixo).
- output (OP) sob o objective correcto.
- activity (A) sob o output correcto.
- indicator sob a activity do mesmo ramo; se não houver activity, sob output.
- Nunca crie ciclos (filho não pode ser ancestral do pai).
- Devolva APENAS nós cujo parentId deva mudar.

NÓS ACTUAIS (JSON):
${JSON.stringify(flatExport, null, 0)}
${extra}

Responda APENAS JSON válido:
{ "links": [{ "id": "...", "parentId": "..." | null }], "summary": "breve explicação em português" }`;
}

export async function suggestObjectiveReparentLinks(
  projectId: string,
  userInstructions?: string,
): Promise<{ links: ReparentLink[]; summary: string }> {
  const dbFlat = await prisma.objective.findMany({
    where: { projectId, isActive: true },
    select: { id: true, type: true, code: true, title: true, parentId: true },
    orderBy: [{ type: 'asc' }, { order: 'asc' }],
  });

  const flatExport = summarizeFlatForAi(dbFlat as ObjectiveNode[]);
  const prompt = buildReorganizePrompt(flatExport, userInstructions);

  const { text } = await geminiGenerateContent({
    systemInstruction: prompt,
    userParts: [{ text: 'Reorganize os parentId conforme a cadeia M&E canónica.' }],
    temperature: 0.1,
    responseMimeType: 'application/json',
  });

  const jsonStr = extractFirstJsonObject(text) || text.trim();
  const parsed = JSON.parse(jsonStr) as { links?: ReparentLink[]; summary?: string };
  const links = (parsed.links || []).filter((l) => l?.id);

  return {
    links,
    summary: parsed.summary || `${links.length} vínculo(s) sugeridos pela IA.`,
  };
}

export async function applyReparentLinks(
  projectId: string,
  links: ReparentLink[],
): Promise<{ applied: number; skipped: number; errors: string[] }> {
  const flat = await prisma.objective.findMany({
    where: { projectId, isActive: true },
    select: { id: true, type: true, parentId: true },
  });
  const byId = new Map(flat.map((n) => [n.id, n]));

  let applied = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const link of links) {
    const child = byId.get(link.id);
    if (!child) {
      skipped++;
      continue;
    }

    const newParentId = link.parentId || null;
    if ((child.parentId || null) === newParentId) {
      skipped++;
      continue;
    }

    if (newParentId) {
      const parent = byId.get(newParentId);
      if (!parent) {
        errors.push(`${link.id}: pai não encontrado`);
        continue;
      }
      const err = describeReparentError(
        child as ObjectiveNode,
        parent as ObjectiveNode,
        flat as ObjectiveNode[],
      );
      if (err || !canReparentTo(child.type, parent.type)) {
        errors.push(`${link.id}: ${err || 'tipo de pai inválido'}`);
        continue;
      }
      if (wouldCreateCycle(flat, child.id, newParentId)) {
        errors.push(`${link.id}: ciclo detectado`);
        continue;
      }
    }

    await prisma.objective.update({
      where: { id: link.id },
      data: { parentId: newParentId },
    });
    child.parentId = newParentId;
    applied++;
  }

  return { applied, skipped, errors };
}

export async function reorganizeProjectObjectives(
  projectId: string,
  userInstructions?: string,
): Promise<{ applied: number; skipped: number; summary: string; errors: string[] }> {
  const { links, summary } = await suggestObjectiveReparentLinks(projectId, userInstructions);
  const result = await applyReparentLinks(projectId, links);
  return { ...result, summary };
}
