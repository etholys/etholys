/**
 * RADAR 3D visual families — procedural meshes, not photoreal GLBs.
 * Map crop name / variety / device sku → a distinct silhouette.
 */

export type CropVisualFamily =
  | 'lettuce_bed'
  | 'fruit_tree'
  | 'maize'
  | 'vine_squash'
  | 'tomato_stake'
  | 'generic_green';

export type DeviceVisualFamily = 'dehydrator' | 'valve' | 'gateway' | 'probe' | 'generic_machine';

const CROP_RULES: Array<{ family: CropVisualFamily; keys: string[] }> = [
  { family: 'lettuce_bed', keys: ['lechuga', 'lettuce', 'alface', 'salad', 'folha', 'crespa'] },
  { family: 'fruit_tree', keys: ['manzana', 'maçã', 'maca', 'apple', 'árvore', 'arvore', 'tree', 'fruta', 'citrico', 'cítrico'] },
  { family: 'maize', keys: ['maíz', 'maiz', 'milho', 'corn', 'choclo', 'zea'] },
  { family: 'vine_squash', keys: ['zapallo', 'abóbora', 'abobora', 'pumpkin', 'squash', 'cabutia', 'melon', 'melão'] },
  { family: 'tomato_stake', keys: ['tomate', 'tomato', 'perita', 'cherry'] },
];

export function cropVisualFamily(cropName: string | null | undefined, variety?: string | null): CropVisualFamily {
  const hay = `${cropName || ''} ${variety || ''}`.toLowerCase();
  for (const rule of CROP_RULES) {
    if (rule.keys.some((k) => hay.includes(k))) return rule.family;
  }
  return 'generic_green';
}

export function deviceVisualFamily(sku: string | null | undefined, name?: string | null): DeviceVisualFamily {
  const s = `${sku || ''} ${name || ''}`.toUpperCase();
  if (s.includes('DEHYDR') || s.includes('SECADOR') || s.includes('DESHIDR')) return 'dehydrator';
  if (s.includes('SVC') || s.includes('VALVE') || s.includes('VÁLVULA') || s.includes('VALVULA')) return 'valve';
  if (s.includes('LPS') || s.includes('GATEWAY')) return 'gateway';
  if (s.includes('SE01') || s.includes('LHT') || s.includes('SW3') || s.includes('PROBE') || s.includes('SENSOR')) return 'probe';
  return 'generic_machine';
}

/** Default real sizes (m) when user has not entered dimensions. */
export const DEFAULT_SIZE_M: Record<CropVisualFamily | DeviceVisualFamily, { w: number; l: number; h: number }> = {
  lettuce_bed: { w: 1.2, l: 4, h: 0.35 },
  fruit_tree: { w: 3, l: 3, h: 4 },
  maize: { w: 0.8, l: 0.8, h: 2.2 },
  vine_squash: { w: 2, l: 2, h: 0.5 },
  tomato_stake: { w: 0.6, l: 0.6, h: 1.6 },
  generic_green: { w: 1, l: 1, h: 0.5 },
  dehydrator: { w: 2.4, l: 1.2, h: 2.0 },
  valve: { w: 0.4, l: 0.4, h: 0.5 },
  gateway: { w: 0.35, l: 0.25, h: 0.45 },
  probe: { w: 0.15, l: 0.15, h: 0.35 },
  generic_machine: { w: 1.5, l: 1.0, h: 1.2 },
};
