export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { canAccessNexusOpsCompany } from '@/lib/nexus-ops';
import { normalizeModuleId } from '@/lib/radar/property-progress';
import { RADAR_SPACE_KINDS } from '@/lib/radar/space';
import { isRadarParcel } from '@/lib/radar/agriculture';
import { sideMetersFromHa } from '@/lib/radar/meters';
import { parseRadarLayout } from '@/lib/radar/site-layout';
import { radarLoc } from '@/lib/radar/i18n';
import { sanitizeClientProposal } from '@/lib/radar/drone/parse-proposal';
import { mergeDroneIntoLayout } from '@/lib/radar/drone/merge';

async function authorize(companyId: string, engagementId: string | null) {
  const tenant = await getUserCompanyIds();
  if (!tenant) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  if (!companyId || !(await canAccessNexusOpsCompany(tenant.companyIds, companyId, engagementId))) {
    return { error: NextResponse.json({ error: 'Empresa inválida.' }, { status: 403 }) };
  }
  return { tenant };
}

/**
 * POST /api/radar/drone/accept
 * Body: { companyId, propertyId, proposal, createUnits? }
 * Writes layoutJson only after explicit user accept — preserves devices/commands/sensors.
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
  const createUnits = body.createUnits !== false;

  if (!propertyId) {
    return NextResponse.json({ error: 'propertyId obrigatório.' }, { status: 400 });
  }

  const auth = await authorize(companyId, engagementId);
  if ('error' in auth && auth.error) return auth.error;

  const property = await prisma.radarProperty.findFirst({
    where: { id: propertyId, companyId, archivedAt: null },
    include: {
      units: { where: { isActive: true }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!property) {
    return NextResponse.json({ error: 'Propriedade inválida.' }, { status: 404 });
  }

  const knownIds = property.units.filter(isRadarParcel).map((u) => u.id);
  const proposal = sanitizeClientProposal(body.proposal, knownIds, loc);
  if (!proposal || proposal.spaces.length === 0) {
    return NextResponse.json(
      {
        error:
          loc === 'es'
            ? 'Propuesta inválida o sin espacios.'
            : loc === 'en'
              ? 'Invalid proposal or no spaces.'
              : 'Proposta inválida ou sem espaços.',
      },
      { status: 400 },
    );
  }

  const moduleId = normalizeModuleId(property.moduleId) || 'agriculture';
  const kind = RADAR_SPACE_KINDS[moduleId].unitKind;
  const layout = parseRadarLayout(property.layoutJson);
  const siteSideM =
    proposal.siteSideM || layout?.siteSideM || sideMetersFromHa(property.areaHa);

  const unitIdByTempId = new Map<string, string>();
  const created: Array<{ id: string; name: string; tempId: string }> = [];
  const reused: Array<{ id: string; name: string; tempId: string }> = [];

  for (const space of proposal.spaces) {
    if (space.reuseUnitId && knownIds.includes(space.reuseUnitId)) {
      const unit = property.units.find((u) => u.id === space.reuseUnitId);
      if (unit) {
        const data: { name?: string; crop?: string | null } = {};
        if (space.name.length >= 2 && space.name !== unit.name) data.name = space.name.slice(0, 120);
        if (space.crop !== undefined) data.crop = space.crop;
        if (Object.keys(data).length) {
          await prisma.nexusOpsUnit.update({ where: { id: unit.id }, data });
        }
        unitIdByTempId.set(space.tempId, unit.id);
        reused.push({ id: unit.id, name: space.name, tempId: space.tempId });
        continue;
      }
    }

    if (!createUnits) {
      continue;
    }

    const areaHa =
      space.widthM != null && space.lengthM != null && space.widthM > 0 && space.lengthM > 0
        ? Math.round(((space.widthM * space.lengthM) / 10000) * 10000) / 10000
        : null;

    const unit = await prisma.nexusOpsUnit.create({
      data: {
        companyId,
        propertyId,
        sectorId: moduleId,
        kind,
        name: space.name.slice(0, 120),
        crop: space.crop,
        areaHa,
      },
    });
    unitIdByTempId.set(space.tempId, unit.id);
    created.push({ id: unit.id, name: unit.name, tempId: space.tempId });
  }

  if (unitIdByTempId.size === 0) {
    return NextResponse.json(
      {
        error:
          loc === 'es'
            ? 'Ningún espacio se pudo aplicar.'
            : loc === 'en'
              ? 'No spaces could be applied.'
              : 'Nenhum espaço pôde ser aplicado.',
      },
      { status: 400 },
    );
  }

  const merged = mergeDroneIntoLayout(property.layoutJson, proposal, unitIdByTempId, siteSideM);

  await prisma.radarProperty.update({
    where: { id: propertyId },
    data: {
      layoutJson: merged as object,
      ...(proposal.crops[0]?.name && !property.crop
        ? { crop: proposal.crops[0].name.slice(0, 80) }
        : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    layout: merged,
    created,
    reused,
    propertyId,
    message:
      loc === 'es'
        ? 'Layout aéreo aplicado. Revisá en el mapa de la propiedad.'
        : loc === 'en'
          ? 'Aerial layout applied. Review it on the property map.'
          : 'Layout aéreo aplicado. Revê no mapa da propriedade.',
  });
}
