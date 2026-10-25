/**
 * Caderno de campo — field schemas by entry kind.
 * Modelled after real field-notebook practices (parcels, inputs/PHI, irrigation,
 * fertilization, cultural practices, scouting, harvest, weather) without cloning
 * every paper form page.
 */
import type { FieldEntryKind } from '@/lib/nexus-sector-modules';
import { radarT, type RadarLoc } from '@/lib/radar/i18n';

export type CadernoFieldId =
  | 'note'
  | 'product'
  | 'dose'
  | 'adjuvant'
  | 'targetPest'
  | 'sprayVolumeL'
  | 'areaHa'
  | 'phiDays'
  | 'mm'
  | 'duration'
  | 'frequencyDays'
  | 'cultivar'
  | 'plantsCount'
  | 'density'
  | 'practice'
  | 'quantity'
  | 'equipment'
  | 'pestName'
  | 'present'
  | 'level'
  | 'weightKg'
  | 'yieldKgHa'
  | 'eventType';

export type CadernoFieldDef = {
  id: CadernoFieldId;
  input: 'text' | 'textarea' | 'number' | 'select';
  required?: boolean;
  options?: Array<{ value: string; pt: string; es: string; en: string }>;
};

/** Fields farmers fill repeatedly — keyed by agriculture-first kinds. */
const BY_KIND: Partial<Record<FieldEntryKind, CadernoFieldDef[]>> = {
  planting: [
    { id: 'cultivar', input: 'text' },
    { id: 'plantsCount', input: 'number' },
    { id: 'density', input: 'text' },
    { id: 'areaHa', input: 'number' },
    { id: 'note', input: 'textarea' },
  ],
  fertilization: [
    { id: 'product', input: 'text', required: true },
    { id: 'dose', input: 'text' },
    { id: 'areaHa', input: 'number' },
    { id: 'note', input: 'textarea' },
  ],
  input: [
    { id: 'product', input: 'text', required: true },
    { id: 'dose', input: 'text' },
    { id: 'adjuvant', input: 'text' },
    { id: 'targetPest', input: 'text' },
    { id: 'sprayVolumeL', input: 'number' },
    { id: 'areaHa', input: 'number' },
    { id: 'phiDays', input: 'number' },
    { id: 'note', input: 'textarea' },
  ],
  irrigation: [
    { id: 'mm', input: 'number' },
    { id: 'duration', input: 'text' },
    { id: 'frequencyDays', input: 'number' },
    { id: 'note', input: 'textarea' },
  ],
  cultural: [
    {
      id: 'practice',
      input: 'select',
      required: true,
      options: [
        { value: 'bagging', pt: 'Ensacamento', es: 'Enfundado', en: 'Bagging' },
        { value: 'staking', pt: 'Escoramento / amarrio', es: 'Tutorado / amarre', en: 'Staking / tying' },
        { value: 'thinning', pt: 'Desbaste', es: 'Raleo', en: 'Thinning' },
        { value: 'defoliation', pt: 'Desfolha', es: 'Deshoje', en: 'Defoliation' },
        { value: 'mowing', pt: 'Roçada', es: 'Roza', en: 'Mowing' },
        { value: 'weeding', pt: 'Capina', es: 'Escarda', en: 'Weeding' },
        { value: 'other', pt: 'Outro trato', es: 'Otro trato', en: 'Other practice' },
      ],
    },
    { id: 'quantity', input: 'text' },
    { id: 'equipment', input: 'text' },
    { id: 'note', input: 'textarea' },
  ],
  pest: [
    { id: 'pestName', input: 'text' },
    {
      id: 'present',
      input: 'select',
      options: [
        { value: 'yes', pt: 'Sim / presente', es: 'Sí / presente', en: 'Yes / present' },
        { value: 'no', pt: 'Não / ausente', es: 'No / ausente', en: 'No / absent' },
      ],
    },
    { id: 'level', input: 'text' },
    { id: 'note', input: 'textarea' },
  ],
  harvest: [
    { id: 'quantity', input: 'text' },
    { id: 'weightKg', input: 'number' },
    { id: 'yieldKgHa', input: 'number' },
    { id: 'note', input: 'textarea' },
  ],
  weather: [
    {
      id: 'eventType',
      input: 'select',
      required: true,
      options: [
        { value: 'frost', pt: 'Geada', es: 'Helada', en: 'Frost' },
        { value: 'hail', pt: 'Granizo', es: 'Granizo', en: 'Hail' },
        { value: 'flood', pt: 'Cheia / inundação', es: 'Crecida / inundación', en: 'Flood' },
        { value: 'drought', pt: 'Seca', es: 'Sequía', en: 'Drought' },
        { value: 'wind', pt: 'Vento forte', es: 'Viento fuerte', en: 'Strong wind' },
        { value: 'rain', pt: 'Chuva torrencial', es: 'Lluvia torrencial', en: 'Heavy rain' },
        { value: 'other', pt: 'Outro', es: 'Otro', en: 'Other' },
      ],
    },
    { id: 'mm', input: 'number' },
    { id: 'note', input: 'textarea' },
  ],
  observation: [{ id: 'note', input: 'textarea', required: true }],
  visit: [{ id: 'note', input: 'textarea', required: true }],
  note: [{ id: 'note', input: 'textarea', required: true }],
  // Non-ag keep light parallels
  health: [
    { id: 'product', input: 'text' },
    { id: 'dose', input: 'text' },
    { id: 'phiDays', input: 'number' },
    { id: 'note', input: 'textarea' },
  ],
  feed: [
    { id: 'product', input: 'text' },
    { id: 'dose', input: 'text' },
    { id: 'note', input: 'textarea' },
  ],
  hygiene: [
    { id: 'product', input: 'text' },
    { id: 'note', input: 'textarea', required: true },
  ],
  process: [
    { id: 'product', input: 'text' },
    { id: 'note', input: 'textarea' },
  ],
  qc: [{ id: 'note', input: 'textarea', required: true }],
  milking: [
    { id: 'quantity', input: 'text' },
    { id: 'note', input: 'textarea' },
  ],
  egg: [
    { id: 'quantity', input: 'text' },
    { id: 'note', input: 'textarea' },
  ],
  biosecurity: [{ id: 'note', input: 'textarea', required: true }],
  hive_inspect: [
    { id: 'level', input: 'text' },
    { id: 'note', input: 'textarea' },
  ],
};

const DEFAULT_FIELDS: CadernoFieldDef[] = [{ id: 'note', input: 'textarea', required: true }];

export function cadernoFieldsForKind(kind: string): CadernoFieldDef[] {
  return BY_KIND[kind as FieldEntryKind] || DEFAULT_FIELDS;
}

export function cadernoFieldLabel(id: CadernoFieldId, loc: RadarLoc): string {
  const map: Record<CadernoFieldId, [string, string, string]> = {
    note: ['Notas', 'Notas', 'Notes'],
    product: ['Produto / fertilizante', 'Producto / fertilizante', 'Product / fertilizer'],
    dose: ['Dose', 'Dosis', 'Dose'],
    adjuvant: ['Coadjuvante', 'Coadyuvante', 'Adjuvant'],
    targetPest: ['Praga / doença alvo', 'Plaga / enfermedad', 'Target pest / disease'],
    sprayVolumeL: ['Volume de calda (L)', 'Volumen de caldo (L)', 'Spray volume (L)'],
    areaHa: ['Área tratada (ha)', 'Área tratada (ha)', 'Treated area (ha)'],
    phiDays: ['Carência / PHI (dias)', 'Carencia / PHI (días)', 'PHI (days)'],
    mm: ['Lâmina / precipitação (mm)', 'Lámina / precipitación (mm)', 'Depth / precip (mm)'],
    duration: ['Tempo de irrigação', 'Tiempo de riego', 'Irrigation duration'],
    frequencyDays: ['Frequência (dias)', 'Frecuencia (días)', 'Frequency (days)'],
    cultivar: ['Cultivar / cultura', 'Cultivar / cultivo', 'Cultivar / crop'],
    plantsCount: ['N.º de plantas', 'N.º de plantas', 'Plant count'],
    density: ['Densidade', 'Densidad', 'Density'],
    practice: ['Trato cultural', 'Labor cultural', 'Cultural practice'],
    quantity: ['Quantidade', 'Cantidad', 'Quantity'],
    equipment: ['Equipamento / material', 'Equipo / material', 'Equipment / material'],
    pestName: ['Praga / doença', 'Plaga / enfermedad', 'Pest / disease'],
    present: ['Ocorrência', 'Ocurrencia', 'Occurrence'],
    level: ['Nível / resultado', 'Nivel / resultado', 'Level / result'],
    weightKg: ['Peso (kg)', 'Peso (kg)', 'Weight (kg)'],
    yieldKgHa: ['Rendimento (kg/ha)', 'Rendimiento (kg/ha)', 'Yield (kg/ha)'],
    eventType: ['Evento climático', 'Evento climático', 'Weather event'],
  };
  const row = map[id];
  return radarT(loc, row[0], row[1], row[2]);
}

export function cadernoFieldPlaceholder(id: CadernoFieldId, loc: RadarLoc): string {
  const map: Partial<Record<CadernoFieldId, [string, string, string]>> = {
    note: ['O que viste ou fizeste…', 'Qué viste o hiciste…', 'What you saw or did…'],
    product: ['ex.: Ureia, cobre, Roundup', 'ej.: Urea, cobre, Roundup', 'e.g. Urea, copper, Roundup'],
    dose: ['ex.: 50 kg/ha ou 2 L/ha', 'ej.: 50 kg/ha o 2 L/ha', 'e.g. 50 kg/ha or 2 L/ha'],
    adjuvant: ['Nome e quantidade (opcional)', 'Nombre y cantidad (opc.)', 'Name and amount (opt.)'],
    targetPest: ['ex.: Sigatoka, ácaro', 'ej.: Sigatoka, ácaro', 'e.g. Sigatoka, mite'],
    duration: ['ex.: 1h30', 'ej.: 1h30', 'e.g. 1h30'],
    density: ['ex.: 1600 plantas/ha', 'ej.: 1600 plantas/ha', 'e.g. 1600 plants/ha'],
    quantity: ['ex.: 40 cachos / 12 plantas', 'ej.: 40 racimos / 12 plantas', 'e.g. 40 bunches / 12 plants'],
    equipment: ['ex.: Pulverizador, tesoura', 'ej.: Pulverizador, tijera', 'e.g. Sprayer, shears'],
    pestName: ['Nome comum ou científico', 'Nombre común o científico', 'Common or scientific name'],
    level: ['ex.: 3 adultos/isca', 'ej.: 3 adultos/cebo', 'e.g. 3 adults/trap'],
    cultivar: ['ex.: Prata, lechuga crespa', 'ej.: Prata, lechuga crespa', 'e.g. Prata, crisp lettuce'],
  };
  const row = map[id];
  return row ? radarT(loc, row[0], row[1], row[2]) : '';
}

export type CadernoPayloadInput = Partial<Record<CadernoFieldId, string | number | null | undefined>> & {
  protocol?: string | null;
  text?: string | null;
};

/** Normalize POST body / form into payloadJson keys used by Caderno + PHI. */
export function buildCadernoPayload(
  kind: string,
  raw: CadernoPayloadInput,
): { payload: Record<string, unknown>; error: string | null } {
  const fields = cadernoFieldsForKind(kind);
  const payload: Record<string, unknown> = {};

  const str = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
  const num = (v: unknown) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  for (const f of fields) {
    const v = raw[f.id];
    if (f.input === 'number') {
      const n = num(v);
      if (n != null) payload[f.id] = n;
    } else if (f.input === 'select' || f.input === 'text' || f.input === 'textarea') {
      const s = str(v, f.id === 'note' ? 2000 : 160);
      if (s) payload[f.id] = s;
    }
  }

  // Legacy aliases
  const protocol = str(raw.protocol, 160);
  if (protocol && !payload.dose && kind === 'input') payload.dose = protocol;
  if (protocol && !payload.product && (kind === 'hygiene' || kind === 'process')) {
    payload.protocol = protocol;
  }
  const text = str(raw.text, 2000);
  if (text && !payload.note) payload.note = text;

  const hasContent = Object.keys(payload).length > 0;
  if (!hasContent) {
    return { payload, error: 'Escreve o que aconteceu ou preenche os campos do tipo.' };
  }

  for (const f of fields) {
    if (!f.required) continue;
    const val = payload[f.id];
    if (val == null || val === '') {
      return { payload, error: `Campo obrigatório em falta.` };
    }
  }

  if (kind === 'input' && !payload.product && !payload.protocol) {
    return { payload, error: 'Insumo pede produto.' };
  }
  if (kind === 'fertilization' && !payload.product) {
    return { payload, error: 'Adubação pede fertilizante.' };
  }
  if (kind === 'irrigation' && payload.mm == null && !payload.note) {
    return { payload, error: 'Irrigação pede milímetros ou uma nota.' };
  }
  if (kind === 'cultural' && !payload.practice && !payload.note) {
    return { payload, error: 'Trato cultural pede a prática ou uma nota.' };
  }
  if (kind === 'weather' && !payload.eventType && !payload.note) {
    return { payload, error: 'Clima pede o tipo de evento ou uma nota.' };
  }

  return { payload, error: null };
}

/** One-line summary for list / WhatsApp when note is empty. */
export function summarizeCadernoPayload(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const row = payload as Record<string, unknown>;
  const note = String(row.note || row.text || '').trim();
  if (note) return note;

  const bits: string[] = [];
  if (row.practice) bits.push(String(row.practice));
  if (row.eventType) bits.push(String(row.eventType));
  if (row.protocol) bits.push(String(row.protocol));
  if (row.product) bits.push(String(row.product));
  if (row.cultivar) bits.push(String(row.cultivar));
  if (row.pestName) bits.push(String(row.pestName));
  if (row.dose) bits.push(String(row.dose));
  if (row.targetPest) bits.push(`→ ${row.targetPest}`);
  if (row.adjuvant) bits.push(`+ ${row.adjuvant}`);
  if (row.mm != null) bits.push(`${row.mm} mm`);
  if (row.phiDays != null) bits.push(`PHI ${row.phiDays}d`);
  if (row.areaHa != null) bits.push(`${row.areaHa} ha`);
  if (row.weightKg != null) bits.push(`${row.weightKg} kg`);
  if (row.yieldKgHa != null) bits.push(`${row.yieldKgHa} kg/ha`);
  if (row.quantity) bits.push(String(row.quantity));
  if (row.level) bits.push(String(row.level));
  if (row.present) bits.push(String(row.present));
  if (row.duration) bits.push(String(row.duration));
  if (row.equipment) bits.push(String(row.equipment));
  if (row.plantsCount != null) bits.push(`${row.plantsCount} pl.`);
  if (row.density) bits.push(String(row.density));
  if (row.sprayVolumeL != null) bits.push(`${row.sprayVolumeL} L`);
  if (row.frequencyDays != null) bits.push(`${row.frequencyDays}d`);

  return bits.filter(Boolean).join(' · ');
}

export function optionLabel(
  field: CadernoFieldDef,
  value: string,
  loc: RadarLoc,
): string {
  const opt = field.options?.find((o) => o.value === value);
  if (!opt) return value;
  return radarT(loc, opt.pt, opt.es, opt.en);
}
