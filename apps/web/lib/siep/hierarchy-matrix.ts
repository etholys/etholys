/**
 * SIEP — matriz M&E (uma coluna por tipo) a partir da árvore objectives.
 */

import {
  buildAncestorsFromChain,
  flattenObjectives,
  indexObjectives,
  type ObjectiveNode,
} from '@/lib/siep/objective-hierarchy';

export type MeChainRow = {
  rowKey: string;
  leafId: string;
  goal: ObjectiveNode | null;
  outcome: ObjectiveNode | null;
  objective: ObjectiveNode | null;
  output: ObjectiveNode | null;
  activity: ObjectiveNode | null;
  indicator: ObjectiveNode | null;
};

function sortKey(node: ObjectiveNode | null | undefined): string {
  if (!node) return 'zzz';
  return `${node.type}:${(node.code || '').toLowerCase()}:${(node.title || '').toLowerCase()}`;
}

function compareRows(a: MeChainRow, b: MeChainRow): number {
  for (const k of ['goal', 'outcome', 'objective', 'output', 'activity', 'indicator'] as const) {
    const cmp = sortKey(a[k]).localeCompare(sortKey(b[k]));
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function nodeFromAncestors(
  ancestors: Record<string, { id: string } | undefined>,
  flat: ObjectiveNode[],
  type: string,
): ObjectiveNode | null {
  const id = ancestors[type]?.id;
  if (!id) return null;
  return flat.find((n) => n.id === id) ?? null;
}

/** Uma linha por indicador ou actividade (folha da cadeia M&E). */
export function buildMeChainRows(objectives: ObjectiveNode[] | undefined | null): MeChainRow[] {
  const flat = flattenObjectives(objectives);
  const { byId } = indexObjectives(flat);

  const isLeaf = (n: ObjectiveNode) => {
    if (n.type === 'indicator') return true;
    if (n.type === 'activity') {
      return !flat.some((c) => c.parentId === n.id && c.type === 'indicator');
    }
    return false;
  };

  let leaves = flat.filter(isLeaf);

  if (leaves.length === 0) {
    leaves = flat.filter((n) => ['output', 'objective', 'outcome'].includes(n.type));
  }

  const rows: MeChainRow[] = leaves.map((leaf) => {
    const ancestors = buildAncestorsFromChain(leaf.id, byId);
    const goal = nodeFromAncestors(ancestors, flat, 'goal') ?? nodeFromAncestors(ancestors, flat, 'impact');
    const outcome = nodeFromAncestors(ancestors, flat, 'outcome');
    const objective = nodeFromAncestors(ancestors, flat, 'objective');
    const output = nodeFromAncestors(ancestors, flat, 'output')
      ?? (leaf.type === 'output' ? leaf : null);
    const activity =
      leaf.type === 'activity'
        ? leaf
        : nodeFromAncestors(ancestors, flat, 'activity');
    const indicator = leaf.type === 'indicator' ? leaf : null;

    return {
      rowKey: leaf.id,
      leafId: leaf.id,
      goal,
      outcome,
      objective,
      output,
      activity,
      indicator,
    };
  });

  rows.sort(compareRows);
  return rows;
}

export function summarizeFlatForAi(flat: ObjectiveNode[]): unknown[] {
  return flat.map((n) => ({
    id: n.id,
    type: n.type,
    code: n.code || '',
    title: n.title || '',
    parentId: n.parentId || null,
  }));
}
