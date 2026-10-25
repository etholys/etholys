import type {
  DroneOrganizeProposal,
  DroneProposedCrop,
  DroneProposedSpace,
} from '@/lib/radar/drone/types';
import {
  DRONE_MAPPING_HONEST_LIMIT_EN,
  DRONE_MAPPING_HONEST_LIMIT_ES,
  DRONE_MAPPING_HONEST_LIMIT_PT,
} from '@/lib/radar/drone/prompt';
import type { DroneLoc } from '@/lib/radar/drone/types';

const CLAMP = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function optPositiveM(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

function stripJsonFences(text: string): string {
  const t = text.trim();
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  return m ? m[1].trim() : t;
}

function honestDefault(locale: DroneLoc): string {
  if (locale === 'es') return DRONE_MAPPING_HONEST_LIMIT_ES;
  if (locale === 'en') return DRONE_MAPPING_HONEST_LIMIT_EN;
  return DRONE_MAPPING_HONEST_LIMIT_PT;
}

function parseSpace(row: unknown, idx: number, knownUnitIds: Set<string>): DroneProposedSpace | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const name = String(r.name || '').trim().slice(0, 120);
  if (name.length < 2) return null;
  const tempId = String(r.tempId || `s${idx + 1}`)
    .trim()
    .slice(0, 40) || `s${idx + 1}`;
  const x = CLAMP(num(r.x, 10 + (idx % 3) * 28), 0, 92);
  const y = CLAMP(num(r.y, 10 + Math.floor(idx / 3) * 28), 0, 92);
  const w = CLAMP(num(r.w, 22), 8, 100 - x);
  const h = CLAMP(num(r.h, 18), 8, 100 - y);
  const reuseRaw = r.reuseUnitId == null || r.reuseUnitId === '' ? null : String(r.reuseUnitId).trim();
  const reuseUnitId = reuseRaw && knownUnitIds.has(reuseRaw) ? reuseRaw : null;
  return {
    tempId,
    name,
    crop: String(r.crop || '').trim().slice(0, 80) || null,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    w: Math.round(w * 10) / 10,
    h: Math.round(h * 10) / 10,
    widthM: optPositiveM(r.widthM),
    lengthM: optPositiveM(r.lengthM),
    notes: String(r.notes || '').trim().slice(0, 240) || null,
    reuseUnitId,
  };
}

function parseCrop(row: unknown): DroneProposedCrop | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const name = String(r.name || '').trim().slice(0, 80);
  if (name.length < 2) return null;
  return {
    name,
    variety: String(r.variety || '').trim().slice(0, 80) || null,
    season: String(r.season || '').trim().slice(0, 80) || null,
  };
}

/** Parse + sanitize LLM JSON into a reviewable proposal. */
export function parseDroneOrganizeProposal(
  raw: string,
  opts: {
    locale: DroneLoc;
    visionUsed: boolean;
    knownUnitIds?: string[];
    fallbackSiteSideM?: number | null;
  },
): DroneOrganizeProposal {
  const known = new Set(opts.knownUnitIds || []);
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(stripJsonFences(raw)) as Record<string, unknown>;
  } catch {
    parsed = {};
  }

  const spacesRaw = Array.isArray(parsed.spaces) ? parsed.spaces : [];
  const spaces: DroneProposedSpace[] = [];
  for (let i = 0; i < spacesRaw.length && spaces.length < 24; i++) {
    const s = parseSpace(spacesRaw[i], i, known);
    if (s) spaces.push(s);
  }

  const cropsRaw = Array.isArray(parsed.crops) ? parsed.crops : [];
  const crops: DroneProposedCrop[] = [];
  const seenCrop = new Set<string>();
  for (const row of cropsRaw) {
    const c = parseCrop(row);
    if (!c) continue;
    const key = c.name.toLowerCase();
    if (seenCrop.has(key)) continue;
    seenCrop.add(key);
    crops.push(c);
  }
  for (const s of spaces) {
    if (!s.crop) continue;
    const key = s.crop.toLowerCase();
    if (seenCrop.has(key)) continue;
    seenCrop.add(key);
    crops.push({ name: s.crop, variety: null, season: null });
  }

  const confRaw = String(parsed.confidence || '').toLowerCase();
  const confidence: DroneOrganizeProposal['confidence'] =
    confRaw === 'high' || confRaw === 'medium' || confRaw === 'low'
      ? confRaw
      : spaces.length
        ? 'medium'
        : 'low';

  const limitations: string[] = [];
  if (Array.isArray(parsed.limitations)) {
    for (const L of parsed.limitations) {
      const t = String(L || '').trim().slice(0, 240);
      if (t) limitations.push(t);
    }
  }
  const honest = honestDefault(opts.locale);
  if (!limitations.some((l) => /fotogrametr|photogrammetr|centim|cm-accur|esboço|boceto|sketch/i.test(l))) {
    limitations.unshift(honest);
  }
  if (!opts.visionUsed) {
    const noVision =
      opts.locale === 'es'
        ? 'Las imágenes no se analizaron visualmente; layout basado en pistas estructuradas.'
        : opts.locale === 'en'
          ? 'Images were not analysed visually; layout is based on structured hints only.'
          : 'As imagens não foram analisadas visualmente; layout baseado só em pistas estruturadas.';
    if (!limitations.some((l) => /visual|vision|imagem|imagen|image/i.test(l))) {
      limitations.push(noVision);
    }
  }

  return {
    summary: String(parsed.summary || '')
      .trim()
      .slice(0, 800) ||
      (opts.locale === 'es'
        ? 'Propuesta de layout aéreo (revisar antes de aceptar).'
        : opts.locale === 'en'
          ? 'Aerial layout proposal (review before accepting).'
          : 'Proposta de layout aéreo (rever antes de aceitar).'),
    confidence,
    siteSideM: optPositiveM(parsed.siteSideM) ?? opts.fallbackSiteSideM ?? null,
    spaces,
    crops: crops.slice(0, 40),
    limitations: limitations.slice(0, 12),
    visionUsed: opts.visionUsed,
  };
}

/** Re-sanitize a client-submitted proposal before accept/merge. */
export function sanitizeClientProposal(
  body: unknown,
  knownUnitIds: string[],
  locale: DroneLoc,
): DroneOrganizeProposal | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  return parseDroneOrganizeProposal(JSON.stringify(b), {
    locale,
    visionUsed: b.visionUsed === true,
    knownUnitIds,
    fallbackSiteSideM: optPositiveM(b.siteSideM),
  });
}
