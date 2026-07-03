/**
 * SIEP — objective tree helpers (marco lógico ↔ M&E hierarchy).
 */

import { resolveIndicatorMetrics } from '@/lib/siep/indicator-fields';

export type ObjectiveNode = {
  id: string;
  parentId?: string | null;
  type: string;
  code?: string | null;
  title?: string | null;
  indicator?: string | null;
  description?: string | null;
  unitOfMeasure?: string | null;
  baseline?: string | null;
  target?: string | null;
  actual?: string | null;
  order?: number;
  children?: ObjectiveNode[];
};

export type HierarchyEntry = { code: string; title: string; id: string };
export type HierarchyMap = Record<string, HierarchyEntry>;

export const HIERARCHY_TYPES = ['objective', 'outcome', 'output', 'activity'] as const;

export const AUTO_ACTIVITY_DESC = '__siep_auto_activity_v1';

/** Flatten objective tree (depth-first). */
export function flattenObjectives(nodes: ObjectiveNode[] | undefined | null): ObjectiveNode[] {
  const out: ObjectiveNode[] = [];
  const walk = (list: ObjectiveNode[]) => {
    for (const node of list ?? []) {
      out.push(node);
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes ?? []);
  return out;
}

/** Build id → node and id → parentId maps from a flat list. */
export function indexObjectives(flat: ObjectiveNode[]) {
  const byId = new Map<string, ObjectiveNode>();
  for (const o of flat) byId.set(o.id, o);
  return { byId };
}

/** Walk parentId chain upward; each type on the path is stored (later wins if duplicated). */
export function buildAncestorsFromChain(
  nodeId: string,
  byId: Map<string, ObjectiveNode>,
): HierarchyMap {
  const ancestors: HierarchyMap = {};
  let cur: ObjectiveNode | undefined = byId.get(nodeId);
  const chain: ObjectiveNode[] = [];
  while (cur) {
    chain.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  for (const node of chain) {
    if (node.type && node.type !== 'indicator') {
      ancestors[node.type] = {
        code: node.code || '',
        title: node.title || '',
        id: node.id,
      };
    }
  }
  return ancestors;
}

export function isTrackableIndicator(o: ObjectiveNode): boolean {
  return o.type === 'indicator' || Boolean(o.indicator && o.indicator.trim());
}

/** Only standalone indicator nodes can be reparented without breaking the logframe tree. */
export function isReparentableIndicator(o: ObjectiveNode): boolean {
  return o.type === 'indicator';
}

export function hasActivityAncestor(ancestors: HierarchyMap): boolean {
  return Boolean(ancestors.activity?.id);
}

/** Nearest anchor for grouping orphaned indicators (output preferred, then outcome, then objective). */
export function findGroupingAnchor(
  node: ObjectiveNode,
  byId: Map<string, ObjectiveNode>,
): ObjectiveNode | null {
  let cur: ObjectiveNode | undefined = node.parentId ? byId.get(node.parentId) : undefined;
  while (cur) {
    if (cur.type === 'output' || cur.type === 'outcome' || cur.type === 'objective') return cur;
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return node.parentId ? byId.get(node.parentId) ?? null : null;
}

export function autoActivityCode(anchor: ObjectiveNode, suffix: 'activities' | 'indicators'): string {
  const base = (anchor.code || anchor.id.slice(0, 8)).replace(/\s+/g, '-');
  return suffix === 'activities' ? `${base}-A` : `${base}-IND`;
}

export function autoActivityTitle(anchor: ObjectiveNode, suffix: 'activities' | 'indicators'): string {
  const label = anchor.code || anchor.title || 'nodo';
  return suffix === 'activities'
    ? `Actividades — ${label}`
    : `Indicadores vinculados — ${label}`;
}

export type RepairPlanItem = {
  indicatorId: string;
  indicatorTitle: string;
  fromParentId: string | null;
  toParentId: string;
  action: 'reparent' | 'reparent_via_new_activity';
  activityCreated?: { id: string; code: string; title: string };
};

export type RepairPlan = {
  items: RepairPlanItem[];
  activitiesToCreate: Array<{
    anchorId: string;
    code: string;
    title: string;
    description: string;
    suffix: 'activities' | 'indicators';
  }>;
};

/**
 * Plan repairs for indicators missing an activity ancestor.
 * Non-destructive: only proposes new activity nodes and parentId updates.
 */
export function planIndicatorActivityRepairs(flat: ObjectiveNode[]): RepairPlan {
  const { byId } = indexObjectives(flat);
  const childrenByParent = new Map<string | null, ObjectiveNode[]>();
  for (const o of flat) {
    const pid = o.parentId ?? null;
    if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
    childrenByParent.get(pid)!.push(o);
  }

  const findExistingAutoActivity = (
    anchorId: string,
    suffix: 'activities' | 'indicators',
  ): ObjectiveNode | undefined =>
    (childrenByParent.get(anchorId) ?? []).find(
      (c) =>
        c.type === 'activity' &&
        c.description === `${AUTO_ACTIVITY_DESC}:${suffix}`,
    );

  const items: RepairPlanItem[] = [];
  const activitiesToCreate: RepairPlan['activitiesToCreate'] = [];
  const createKeys = new Set<string>();

  for (const ind of flat.filter(isReparentableIndicator)) {
    const ancestors = buildAncestorsFromChain(ind.id, byId);
    if (hasActivityAncestor(ancestors)) continue;

    const anchor = findGroupingAnchor(ind, byId);
    if (!anchor) continue;

    const activityChildren = (childrenByParent.get(anchor.id) ?? []).filter((c) => c.type === 'activity');
    let targetActivityId: string | undefined;
    let action: RepairPlanItem['action'] = 'reparent';

    if (activityChildren.length === 1) {
      targetActivityId = activityChildren[0].id;
    } else if (activityChildren.length > 1) {
      const suffix = 'indicators' as const;
      let bucket = findExistingAutoActivity(anchor.id, suffix);
      if (!bucket) {
        const key = `${anchor.id}:${suffix}`;
        if (!createKeys.has(key)) {
          createKeys.add(key);
          activitiesToCreate.push({
            anchorId: anchor.id,
            code: autoActivityCode(anchor, suffix),
            title: autoActivityTitle(anchor, suffix),
            description: `${AUTO_ACTIVITY_DESC}:${suffix}`,
            suffix,
          });
        }
        action = 'reparent_via_new_activity';
      } else {
        targetActivityId = bucket.id;
      }
    } else {
      const suffix = 'activities' as const;
      let bucket = findExistingAutoActivity(anchor.id, suffix);
      if (!bucket) {
        const key = `${anchor.id}:${suffix}`;
        if (!createKeys.has(key)) {
          createKeys.add(key);
          activitiesToCreate.push({
            anchorId: anchor.id,
            code: autoActivityCode(anchor, suffix),
            title: autoActivityTitle(anchor, suffix),
            description: `${AUTO_ACTIVITY_DESC}:${suffix}`,
            suffix,
          });
        }
        action = 'reparent_via_new_activity';
      } else {
        targetActivityId = bucket.id;
      }
    }

    if (!targetActivityId) {
      const suffix = activityChildren.length > 1 ? 'indicators' : 'activities';
      const bucket = findExistingAutoActivity(anchor.id, suffix);
      if (bucket) targetActivityId = bucket.id;
    }

    if (targetActivityId && ind.parentId !== targetActivityId) {
      items.push({
        indicatorId: ind.id,
        indicatorTitle: ind.type === 'indicator' ? (ind.title || '') : (ind.indicator || ind.title || ''),
        fromParentId: ind.parentId ?? null,
        toParentId: targetActivityId,
        action,
      });
    }
  }

  return { items, activitiesToCreate };
}

/** For M&E display: infer activity from children when indicator sits on output/outcome node. */
function enrichActivityForDisplay(
  node: ObjectiveNode,
  ancestors: HierarchyMap,
  flat: ObjectiveNode[],
): HierarchyMap {
  if (ancestors.activity?.id) return ancestors;
  if (!isTrackableIndicator(node)) return ancestors;

  const hostId =
    node.type === 'indicator'
      ? node.parentId
      : ['output', 'outcome', 'objective'].includes(node.type)
        ? node.id
        : node.parentId;

  if (!hostId) return ancestors;

  const activityChild = flat.find((c) => c.parentId === hostId && c.type === 'activity');
  if (!activityChild) return ancestors;

  return {
    ...ancestors,
    activity: {
      code: activityChild.code || '',
      title: activityChild.title || '',
      id: activityChild.id,
    },
  };
}

/** Build M&E maps from project objectives tree (same shape as MonitoringSection). */
export function buildMonitoringMaps(objectives: ObjectiveNode[] | undefined | null) {
  const flat = flattenObjectives(objectives);
  const { byId } = indexObjectives(flat);
  const hierarchyMap = new Map<string, HierarchyMap>();
  const byType: Record<string, any[]> = {
    objective: [],
    outcome: [],
    output: [],
    activity: [],
    indicator: [],
    deliverable: [],
  };

  for (const o of flat) {
    const base = buildAncestorsFromChain(o.id, byId);
    const ancestors = enrichActivityForDisplay(o, base, flat);
    hierarchyMap.set(o.id, ancestors);
    if (byType[o.type]) byType[o.type].push({ ...o, ancestors });
  }

  const indicatorObjs = flat.filter(isTrackableIndicator).map((o) => {
    const metrics = resolveIndicatorMetrics(o);
    return {
      ...o,
      unitOfMeasure: o.unitOfMeasure || metrics.unitOfMeasure || null,
      baseline: o.baseline ?? metrics.baseline ?? null,
      target: o.target ?? metrics.target ?? null,
      actual: o.actual ?? metrics.actual ?? null,
      ancestors: hierarchyMap.get(o.id) ?? {},
    };
  });

  return { allObjectives: flat, indicatorObjs, hierarchyMap, byType };
}

/** Types shown in M&E hierarchy editor (OE → R → OP → A + indicators). */
export const ME_EDITOR_TYPES = [
  'outcome',
  'objective',
  'output',
  'deliverable',
  'activity',
  'indicator',
] as const;

const ALLOWED_PARENT_TYPES: Record<string, string[]> = {
  outcome: ['goal', 'impact'],
  objective: ['outcome', 'goal'],
  output: ['objective', 'outcome'],
  deliverable: ['output', 'objective', 'outcome'],
  activity: ['output', 'deliverable', 'objective'],
  input: ['activity', 'output'],
  indicator: ['activity', 'output', 'deliverable', 'objective', 'outcome', 'goal'],
  assumption: ['objective', 'outcome', 'output', 'activity', 'goal'],
  external_factor: ['objective', 'outcome', 'goal'],
};

export function getAllowedParentTypes(childType: string): string[] {
  return ALLOWED_PARENT_TYPES[childType] ?? ['objective', 'outcome', 'output', 'goal', 'impact'];
}

export function canReparentTo(childType: string, parentType: string): boolean {
  return getAllowedParentTypes(childType).includes(parentType);
}

export function wouldCreateCycle(
  flat: Array<{ id: string; parentId?: string | null }>,
  childId: string,
  newParentId: string | null | undefined,
): boolean {
  if (!newParentId || childId === newParentId) return Boolean(newParentId && childId === newParentId);
  let cur: string | null | undefined = newParentId;
  while (cur) {
    if (cur === childId) return true;
    const node = flat.find((n) => n.id === cur);
    cur = node?.parentId ?? null;
  }
  return false;
}

export function listValidParents(
  child: ObjectiveNode,
  flat: ObjectiveNode[],
): ObjectiveNode[] {
  return flat.filter(
    (p) =>
      p.id !== child.id &&
      canReparentTo(child.type, p.type) &&
      !wouldCreateCycle(flat, child.id, p.id),
  );
}

export function describeReparentError(
  child: ObjectiveNode,
  parent: ObjectiveNode | null | undefined,
  flat: ObjectiveNode[],
): string | null {
  if (!parent) return 'Seleccione um elemento pai.';
  if (child.id === parent.id) return 'Um elemento não pode ser pai de si mesmo.';
  if (!canReparentTo(child.type, parent.type)) {
    return `Um ${child.type} não pode ficar sob ${parent.type}. Tipos válidos: ${getAllowedParentTypes(child.type).join(', ')}.`;
  }
  if (wouldCreateCycle(flat, child.id, parent.id)) return 'Esta ligação criaria um ciclo na árvore.';
  return null;
}

export function formatParentOption(node: ObjectiveNode): string {
  const code = node.code?.trim();
  const title = (node.title || '').trim();
  if (code && title) return `${code} — ${title.length > 48 ? `${title.slice(0, 48)}…` : title}`;
  return code || title || node.id.slice(0, 8);
}
