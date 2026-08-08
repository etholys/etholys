import { prisma } from '@/lib/prisma';
import { buildAncestorsFromChain, flattenObjectives, indexObjectives } from '@/lib/siep/objective-hierarchy';
import type { ObjectiveNode } from '@/lib/siep/objective-hierarchy';

const TYPE_LABEL: Record<string, string> = {
  objective: 'Objetivo específico',
  outcome: 'Outcome / Resultado',
  output: 'Output / Producto',
  activity: 'Actividade',
  indicator: 'Indicador',
  deliverable: 'Entregável',
};

function objectiveTreeFromFlat(
  rows: Array<{
    id: string;
    parentId: string | null;
    type: string;
    code: string | null;
    title: string;
    description: string | null;
    indicator: string | null;
    order: number;
  }>,
): ObjectiveNode[] {
  const byParent = new Map<string | null, ObjectiveNode[]>();
  const nodes = new Map<string, ObjectiveNode>();

  for (const row of rows) {
    nodes.set(row.id, {
      id: row.id,
      parentId: row.parentId,
      type: row.type,
      code: row.code,
      title: row.title,
      description: row.description,
      order: row.order,
      children: [],
    });
  }

  for (const node of nodes.values()) {
    const pid = node.parentId || null;
    if (!byParent.has(pid)) byParent.set(pid, []);
    byParent.get(pid)!.push(node);
  }

  const sortKids = (list: ObjectiveNode[]) => list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  function attach(parent: ObjectiveNode) {
    const kids = sortKids(byParent.get(parent.id) || []);
    parent.children = kids;
    for (const k of kids) attach(k);
  }

  const roots = sortKids(byParent.get(null) || []);
  for (const r of roots) attach(r);
  return roots;
}

/** Palavras-chave simples para ajudar a IA a mapear notas do período → actividades. */
function mappingHintsForActivity(title: string, description: string | null): string {
  const blob = `${title} ${description || ''}`.toLowerCase();
  const hints: string[] = [];
  if (/visita|field|finca|producer|productor|msme|enrollment|selecci/.test(blob)) {
    hints.push('visitas a productores/fincas, enrollment MSME, recorrido de campo');
  }
  if (/capacit|train|taller|webinar|formaci|curric|programa/.test(blob)) {
    hints.push('capacitaciones, talleres, webinars, diseño de currículo');
  }
  if (/maquila|agroindust|proces|planta|equipo|cotiz|automat|digital/.test(blob)) {
    hints.push('diseño técnico, equipos, cotizaciones, maquila/planta');
  }
  if (/coordina|giz|aliad|reuni|partner|instituc/.test(blob)) {
    hints.push('reuniones de coordinación con aliados/donantes');
  }
  if (/mapeo|flujo|diagnóst|plan de intervenci|baseline/.test(blob)) {
    hints.push('planes de intervención, mapeos, diagnósticos');
  }
  if (/comunic|prensa|media|press|difusi/.test(blob)) {
    hints.push('comunicación / prensa (si aplica a esta actividad)');
  }
  return hints.length ? hints.join('; ') : '';
}

/** Escopo M&E (marco lógico) para a IA preencher informes com actividades reais do projecto. */
export async function buildMeScopeBlockForInforme(projectId: string): Promise<string> {
  const rows = await prisma.objective.findMany({
    where: { projectId, isActive: true },
    select: {
      id: true,
      parentId: true,
      type: true,
      code: true,
      title: true,
      description: true,
      indicator: true,
      order: true,
    },
    orderBy: { order: 'asc' },
  });

  if (!rows.length) {
    return [
      'ESCOPO M&E: (vazio — cadastre outcomes e actividades na aba M&E do projecto)',
      'Sem escopo cadastrado: NÃO invente códigos de actividade (A1.1, etc.).',
    ].join('\n');
  }

  const tree = objectiveTreeFromFlat(rows);
  const flat = flattenObjectives(tree);
  const { byId } = indexObjectives(flat);
  const descById = new Map(rows.map((r) => [r.id, r]));

  const lines: string[] = [
    'ESCOPO M&E DO PROJECTO (fonte autoritativa — usar APENAS estas entradas)',
    'Regra: tabelas de actividades do informe devem referenciar estes códigos/títulos.',
    'O utilizador descreve o mês em linguagem operacional; VOCÊ mapeia cada facto à actividade pai abaixo.',
    'NÃO crie actividades novas nem códigos novos.',
    '',
  ];

  function walk(nodes: ObjectiveNode[], depth: number) {
    for (const o of nodes) {
      const indent = '  '.repeat(depth);
      const typeLabel = TYPE_LABEL[o.type] || o.type;
      const code = o.code?.trim() ? `${o.code.trim()}: ` : '';
      lines.push(`${indent}• [${typeLabel}] ${code}${o.title || '(sem título)'}`);

      const raw = descById.get(o.id);
      if (o.description?.trim()) {
        lines.push(`${indent}  ↳ ${o.description.trim().slice(0, 420)}`);
      }
      if (o.type === 'activity') {
        const hints = mappingHintsForActivity(o.title || '', o.description);
        if (hints) lines.push(`${indent}  ≈ mapear notas sobre: ${hints}`);
      }
      if (raw?.indicator?.trim() && (o.type === 'activity' || o.type === 'output' || o.type === 'outcome')) {
        lines.push(`${indent}  ○ indicador: ${raw.indicator.trim().slice(0, 160)}`);
      }

      if (o.type === 'activity' || o.type === 'output') {
        const ancestors = buildAncestorsFromChain(o.id, byId);
        const chain = ['objective', 'outcome', 'output']
          .map((t) => ancestors[t])
          .filter(Boolean)
          .map((a) => (a!.code ? `${a!.code}` : a!.title))
          .join(' → ');
        if (chain) lines.push(`${indent}  (cadeia: ${chain})`);
      }

      if (o.children?.length) walk(o.children, depth + 1);
    }
  }

  walk(tree, 0);

  const activities = flat.filter((o) => o.type === 'activity');
  if (activities.length) {
    lines.push('');
    lines.push('ÍNDICE RÁPIDO DE ACTIVIDADES (códigos oficiais para tabelas e tags na narrativa):');
    for (const a of activities) {
      const code = a.code?.trim() ? `${a.code.trim()} — ` : '';
      const hints = mappingHintsForActivity(a.title || '', a.description);
      lines.push(`  - ${code}${a.title}${hints ? ` [${hints}]` : ''}`);
    }
  }

  return lines.join('\n');
}
