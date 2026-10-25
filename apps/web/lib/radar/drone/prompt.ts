import type { DroneLoc, DroneOrganizeHints } from '@/lib/radar/drone/types';

const HONEST_LIMIT =
  'This is an assisted sketch from an aerial / drone photo — NOT photogrammetry, NOT RTK, NOT cm-accurate (not Pix4D). Approximate parcel layout in meters only.';

export function buildDroneMappingSystemPrompt(locale: DroneLoc): string {
  const lang =
    locale === 'es' ? 'Spanish (es)' : locale === 'en' ? 'English (en)' : 'Portuguese (pt)';

  return `You are the RADAR drone-mapping specialist inside Etholys.
Your job: turn one or more aerial / orthophoto images (plus optional user hints) into an organized property layout proposal.

${HONEST_LIMIT}

Hard rules:
- Respond in ${lang}.
- Output ONLY valid JSON (no markdown fences).
- Coordinates x,y,w,h are percentages of the property site canvas (0–100). Origin top-left; y grows downward.
- Prefer a few clear parcels/spaces over dozens of tiny ones.
- Use user plant-type hints when given; otherwise infer plausible crops/zones from the image and label them provisional.
- If you cannot see clear boundaries, propose a coarse grid and set confidence to "low".
- Never claim surveying accuracy. Always include limitations acknowledging the sketch nature.
- If reuseUnitId matches an existing unit id from CONTEXT, prefer reusing it for that footprint.
- widthM / lengthM are approximate real-world meters for each space when site scale is known; otherwise null.
- Do not invent sensor devices or irrigation hardware.

JSON schema:
{
  "summary": "short explanation of the proposed layout",
  "confidence": "low" | "medium" | "high",
  "siteSideM": number | null,
  "spaces": [
    {
      "tempId": "s1",
      "name": "short label",
      "crop": "crop or zone type or null",
      "x": 0-95, "y": 0-95, "w": 8-100, "h": 8-100,
      "widthM": number | null,
      "lengthM": number | null,
      "notes": "optional",
      "reuseUnitId": "existing unit id or null"
    }
  ],
  "crops": [{ "name": "string", "variety": null, "season": null }],
  "limitations": ["string — always include honesty about sketch accuracy"]
}
`;
}

export function buildDroneUserPrompt(opts: {
  locale: DroneLoc;
  propertyName: string;
  moduleId: string | null;
  areaHa: number | null;
  siteSideM: number;
  existingSpaces: Array<{ id: string; name: string; crop: string | null; placed: boolean }>;
  hints: DroneOrganizeHints;
  visionUsed: boolean;
  imageCount: number;
}): string {
  const { locale, propertyName, moduleId, areaHa, siteSideM, existingSpaces, hints, visionUsed, imageCount } =
    opts;

  const lines: string[] = [];
  lines.push(`Property: ${propertyName}`);
  lines.push(`Module: ${moduleId || 'agriculture'}`);
  lines.push(`Area ha: ${areaHa ?? 'unknown'}`);
  lines.push(`Site side (approx meters): ${siteSideM}`);
  lines.push(`Existing spaces/units: ${JSON.stringify(existingSpaces)}`);
  if (hints.plantTypes) lines.push(`User plant / zone hints: ${hints.plantTypes}`);
  if (hints.notes) lines.push(`User notes: ${hints.notes}`);
  if (hints.bounds) lines.push(`User map bounds: ${JSON.stringify(hints.bounds)}`);
  if (hints.siteSideM) lines.push(`User siteSideM override: ${hints.siteSideM}`);

  if (visionUsed) {
    lines.push(
      `Vision: ${imageCount} aerial image(s) attached. Use them to propose spaces. Still approximate only.`,
    );
  } else {
    lines.push(
      'Vision unavailable or no usable image bytes — propose layout ONLY from structured hints and existing spaces. Tell the user (in summary + limitations) that images were not analysed visually.',
    );
  }

  lines.push(
    locale === 'es'
      ? 'Propón un layout organizado para revisar y aceptar.'
      : locale === 'en'
        ? 'Propose an organized layout for the user to review and accept.'
        : 'Propõe um layout organizado para o utilizador rever e aceitar.',
  );

  return lines.join('\n');
}

export const DRONE_MAPPING_HONEST_LIMIT_PT =
  'Esboço assistido a partir de foto aérea — não é fotogrametria nem precisão centimétrica.';
export const DRONE_MAPPING_HONEST_LIMIT_ES =
  'Boceto asistido desde foto aérea — no es fotogrametría ni precisión centimétrica.';
export const DRONE_MAPPING_HONEST_LIMIT_EN =
  'Assisted sketch from an aerial photo — not photogrammetry and not centimetre-accurate.';
