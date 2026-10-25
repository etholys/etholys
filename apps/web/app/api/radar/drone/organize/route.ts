export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import {
  hasLlmApiKey,
  llmGenerateContent,
  publicLlmErrorMessage,
  PUBLIC_LLM_UNAVAILABLE,
  type LlmPart,
} from '@/lib/llm-client';
import { parseRadarLayout } from '@/lib/radar/site-layout';
import { isRadarParcel } from '@/lib/radar/agriculture';
import { sideMetersFromHa } from '@/lib/radar/meters';
import { radarLoc } from '@/lib/radar/i18n';
import { buildDroneMappingSystemPrompt, buildDroneUserPrompt } from '@/lib/radar/drone/prompt';
import { parseDroneOrganizeProposal } from '@/lib/radar/drone/parse-proposal';
import type { DroneImageInput, DroneMapBounds, DroneOrganizeHints } from '@/lib/radar/drone/types';

const MAX_IMAGES = 3;
const MAX_IMAGE_BYTES = 1_800_000;

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

function decodeImage(raw: unknown): DroneImageInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  let b64 = typeof r.base64 === 'string' ? r.base64.trim() : '';
  if (!b64 && typeof r.dataUrl === 'string') {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(r.dataUrl.trim());
    if (m) {
      r.mimeType = m[1].toLowerCase();
      b64 = m[2];
    }
  }
  b64 = b64.replace(/^data:[^;]+;base64,/, '');
  if (!b64 || b64.length < 32) return null;
  // rough size check (base64 ~ 4/3)
  if ((b64.length * 3) / 4 > MAX_IMAGE_BYTES) return null;
  const mime =
    typeof r.mimeType === 'string' && r.mimeType.startsWith('image/')
      ? r.mimeType.toLowerCase()
      : 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return null;
  let gps: { lat: number; lng: number } | null = null;
  if (r.gps && typeof r.gps === 'object') {
    const g = r.gps as Record<string, unknown>;
    const lat = Number(g.lat);
    const lng = Number(g.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) gps = { lat, lng };
  }
  return {
    base64: b64,
    mimeType: mime,
    filename: typeof r.filename === 'string' ? r.filename.slice(0, 120) : undefined,
    gps,
  };
}

function parseBounds(raw: unknown): DroneMapBounds | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Record<string, unknown>;
  if (b.mode === 'center_size') {
    const lat = Number(b.lat);
    const lng = Number(b.lng);
    const widthM = Number(b.widthM);
    const heightM = Number(b.heightM);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      !Number.isFinite(widthM) ||
      !Number.isFinite(heightM) ||
      widthM <= 0 ||
      heightM <= 0
    ) {
      return null;
    }
    return { mode: 'center_size', lat, lng, widthM, heightM };
  }
  if (b.mode === 'corners' && Array.isArray(b.corners)) {
    const corners: Array<{ lat: number; lng: number }> = [];
    for (const c of b.corners) {
      if (!c || typeof c !== 'object') continue;
      const row = c as Record<string, unknown>;
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      corners.push({ lat, lng });
    }
    if (corners.length < 3 || corners.length > 4) return null;
    return { mode: 'corners', corners };
  }
  return null;
}

/**
 * POST /api/radar/drone/organize
 * Body: { companyId, propertyId, images[], hints?, locale? }
 * Returns a reviewable proposal — does NOT write layoutJson.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const companyId = String(body.companyId || '').trim();
  const engagementId = String(body.engagementId || '').trim() || null;
  const propertyId = String(body.propertyId || '').trim();
  const loc = radarLoc(String(body.locale || 'pt'));

  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId obrigatório.' }, { status: 400 });
  }

  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  if (!hasLlmApiKey()) {
    return NextResponse.json({ error: PUBLIC_LLM_UNAVAILABLE, code: 'llm_unavailable' }, { status: 503 });
  }

  const images: DroneImageInput[] = [];
  if (Array.isArray(body.images)) {
    for (const row of body.images) {
      const img = decodeImage(row);
      if (img) images.push(img);
      if (images.length >= MAX_IMAGES) break;
    }
  }

  const hintsRaw = (body.hints && typeof body.hints === 'object' ? body.hints : {}) as Record<
    string,
    unknown
  >;
  const hints: DroneOrganizeHints = {
    plantTypes: String(hintsRaw.plantTypes || '').trim().slice(0, 400) || undefined,
    notes: String(hintsRaw.notes || '').trim().slice(0, 800) || undefined,
    siteSideM:
      hintsRaw.siteSideM == null || hintsRaw.siteSideM === ''
        ? null
        : Number.isFinite(Number(hintsRaw.siteSideM)) && Number(hintsRaw.siteSideM) > 0
          ? Number(hintsRaw.siteSideM)
          : null,
    bounds: parseBounds(hintsRaw.bounds),
  };

  if (images.length === 0 && !hints.plantTypes && !hints.notes && !hints.bounds) {
    return NextResponse.json(
      {
        error:
          loc === 'es'
            ? 'Subí al menos una imagen de drone o pistas (cultivos / límites).'
            : loc === 'en'
              ? 'Upload at least one drone image or provide hints (crops / bounds).'
              : 'Carrega pelo menos uma imagem de drone ou pistas (culturas / limites).',
      },
      { status: 400 },
    );
  }

  const property = await prisma.radarProperty.findFirst({
    where: { id: propertyId, companyId, archivedAt: null },
    include: {
      units: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!property) {
    return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 404 });
  }

  const layout = parseRadarLayout(property.layoutJson);
  const parcels = property.units.filter(isRadarParcel);
  const existingSpaces = parcels.map((u) => {
    const rect = layout?.spaces.find((s) => s.id === u.id);
    return {
      id: u.id,
      name: u.name,
      crop: u.crop,
      placed: rect?.placed === true,
    };
  });

  const siteSideM =
    hints.siteSideM ||
    (hints.bounds?.mode === 'center_size'
      ? Math.max(hints.bounds.widthM, hints.bounds.heightM)
      : null) ||
    layout?.siteSideM ||
    sideMetersFromHa(property.areaHa);

  const visionUsed = images.length > 0;
  const systemInstruction = buildDroneMappingSystemPrompt(loc);
  const userText = buildDroneUserPrompt({
    locale: loc,
    propertyName: property.name,
    moduleId: property.moduleId,
    areaHa: property.areaHa,
    siteSideM,
    existingSpaces,
    hints,
    visionUsed,
    imageCount: images.length,
  });

  const userParts: LlmPart[] = [{ text: userText }];
  if (visionUsed) {
    for (const img of images) {
      userParts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } });
    }
  }

  let rawText: string;
  try {
    const result = await llmGenerateContent({
      systemInstruction,
      userParts,
      maxOutputTokens: 2200,
      temperature: 0.2,
      responseMimeType: 'application/json',
    });
    rawText = result.text;
  } catch (e: unknown) {
    console.error('[radar/drone/organize]', e);
    return NextResponse.json({ error: publicLlmErrorMessage(e) }, { status: 502 });
  }

  const proposal = parseDroneOrganizeProposal(rawText, {
    locale: loc,
    visionUsed,
    knownUnitIds: parcels.map((u) => u.id),
    fallbackSiteSideM: siteSideM,
  });

  const gpsFromImages = images.map((i) => i.gps).filter(Boolean);

  return NextResponse.json({
    ok: true,
    proposal,
    property: {
      id: property.id,
      name: property.name,
      moduleId: property.moduleId,
      areaHa: property.areaHa,
      lat: property.lat,
      lng: property.lng,
      siteSideM,
    },
    meta: {
      visionUsed,
      imageCount: images.length,
      gpsFromImages,
      honest:
        loc === 'es'
          ? 'Boceto asistido — no sustituye fotogrametría.'
          : loc === 'en'
            ? 'Assisted sketch — not a photogrammetry substitute.'
            : 'Esboço assistido — não substitui fotogrametria.',
    },
  });
}
