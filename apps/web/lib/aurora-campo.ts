import { prisma } from './prisma';
import { canMutateAuroraFlow } from './aurora-flow-turn';
import { parsePolygon, visitPresence, type GeoPoint } from './aurora-visit';
import { readCompliance, territorialEligibility } from './aurora-territory';

const PHOTO_MAX = 700_000;

export async function loadAuroraCampo(opts: {
  tenantCompanyIds: string[];
  attendedCompanyId: string;
  engagementId: string;
}) {
  if (!(await canMutateAuroraFlow(opts.tenantCompanyIds, opts.attendedCompanyId, opts.engagementId))) {
    return null;
  }
  const engagement = await prisma.nexusAtEngagement.findFirst({
    where: { id: opts.engagementId, isActive: true },
    select: {
      id: true,
      title: true,
      operatorCompanyId: true,
      siepProjectId: true,
      siepProject: { select: { id: true, name: true, code: true } },
    },
  });
  if (!engagement) return null;

  const [properties, objectives, visits] = await Promise.all([
    prisma.radarProperty.findMany({
      where: {
        OR: [
          { companyId: opts.attendedCompanyId },
          { client: { linkedCompanyId: opts.attendedCompanyId } },
        ],
      },
      select: { id: true, name: true, lat: true, lng: true, areaHa: true, crop: true, complianceJson: true, polygonJson: true },
      orderBy: { name: 'asc' },
      take: 80,
    }),
    engagement.siepProjectId
      ? prisma.objective.findMany({
          where: { projectId: engagement.siepProjectId, isActive: true },
          select: { id: true, code: true, title: true, indicator: true, unitOfMeasure: true },
          orderBy: { order: 'asc' },
          take: 80,
        })
      : Promise.resolve([]),
    prisma.auroraFieldVisit.findMany({
      where: { engagementId: engagement.id, attendedCompanyId: opts.attendedCompanyId },
      orderBy: { occurredAt: 'desc' },
      take: 30,
      select: {
        id: true,
        activityLabel: true,
        whatDone: true,
        lat: true,
        lng: true,
        onSite: true,
        distanceM: true,
        occurredAt: true,
        propertyId: true,
        objectiveId: true,
        photoData: true,
      },
    }),
  ]);

  return {
    engagement: {
      id: engagement.id,
      title: engagement.title,
      mode: engagement.siepProjectId ? 'project' : 'permanent',
      project: engagement.siepProject,
    },
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      areaHa: p.areaHa,
      crop: p.crop,
      compliance: p.complianceJson ? readCompliance(p.complianceJson) : null,
      polygonPoints: parsePolygon(p.polygonJson).length,
    })),
    objectives,
    visits: visits.map((v) => ({ ...v, hasPhoto: Boolean(v.photoData), photoData: undefined, occurredAt: v.occurredAt.toISOString() })),
  };
}

export async function createAuroraVisit(opts: {
  tenantCompanyIds: string[];
  userId: string;
  attendedCompanyId: string;
  engagementId: string;
  propertyId: string | null;
  objectiveId: string | null;
  activityLabel: string;
  whatDone: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  photoData: string | null;
  polygon: unknown;
  indicatorValue: string | null;
}) {
  const campo = await loadAuroraCampo({
    tenantCompanyIds: opts.tenantCompanyIds,
    attendedCompanyId: opts.attendedCompanyId,
    engagementId: opts.engagementId,
  });
  if (!campo) return { error: 'forbidden' as const };

  const activityLabel = opts.activityLabel.trim().slice(0, 200);
  if (!activityLabel) return { error: 'activity' as const };
  if (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lng) || Math.abs(opts.lat) > 90 || Math.abs(opts.lng) > 180) {
    return { error: 'geo' as const };
  }
  const photo = opts.photoData && opts.photoData.startsWith('data:image/') ? opts.photoData.slice(0, PHOTO_MAX) : null;
  if (opts.photoData && !photo) return { error: 'photo' as const };
  if (opts.photoData && opts.photoData.length > PHOTO_MAX) return { error: 'photo' as const };

  const property = opts.propertyId ? campo.properties.find((p) => p.id === opts.propertyId) : null;
  if (opts.propertyId && !property) return { error: 'property' as const };

  const objective = opts.objectiveId ? campo.objectives.find((o) => o.id === opts.objectiveId) : null;
  if (opts.objectiveId && !objective) return { error: 'objective' as const };

  const polygon = parsePolygon(opts.polygon);
  const stored = await prisma.radarProperty.findUnique({
    where: { id: property?.id || '__none__' },
    select: { polygonJson: true, complianceJson: true, lat: true, lng: true },
  });
  const areaRing = polygon.length >= 3 ? polygon : parsePolygon(stored?.polygonJson);
  if (objective) {
    if (!property) return { error: 'property' as const };
    const gate = territorialEligibility(readCompliance(stored?.complianceJson));
    if (!gate.eligible) return { error: 'ineligible' as const, reasons: gate.reasons };
  }
  const propertyPoint: GeoPoint | null =
    stored && stored.lat != null && stored.lng != null
      ? { lat: stored.lat, lng: stored.lng }
      : property && property.lat != null && property.lng != null
        ? { lat: property.lat, lng: property.lng }
        : null;
  const presence = visitPresence({ lat: opts.lat, lng: opts.lng, property: propertyPoint, polygon: areaRing });

  const engagement = await prisma.nexusAtEngagement.findUnique({
    where: { id: opts.engagementId },
    select: { operatorCompanyId: true, siepProjectId: true },
  });
  if (!engagement) return { error: 'forbidden' as const };

  const visit = await prisma.auroraFieldVisit.create({
    data: {
      operatorCompanyId: engagement.operatorCompanyId,
      attendedCompanyId: opts.attendedCompanyId,
      engagementId: opts.engagementId,
      propertyId: property?.id || null,
      authorUserId: opts.userId,
      siepProjectId: objective ? engagement.siepProjectId : null,
      objectiveId: objective?.id || null,
      activityLabel,
      whatDone: opts.whatDone.trim().slice(0, 2000),
      indicatorValue: opts.indicatorValue?.trim().slice(0, 40) || null,
      lat: opts.lat,
      lng: opts.lng,
      accuracyM: opts.accuracyM,
      distanceM: presence.distanceM,
      onSite: presence.onSite,
      photoData: photo,
      polygonJson: areaRing.length >= 3 ? areaRing : undefined,
      occurredAt: new Date(),
    },
    select: { id: true, onSite: true, distanceM: true },
  });

  if (objective && engagement.siepProjectId) {
    const period = new Date().toISOString().slice(0, 7);
    await prisma.indicatorMeasurement.create({
      data: {
        projectId: engagement.siepProjectId,
        objectiveId: objective.id,
        period,
        value: opts.indicatorValue?.trim() || '1',
        notes: `${activityLabel}${opts.whatDone.trim() ? ` — ${opts.whatDone.trim().slice(0, 400)}` : ''}`.slice(0, 800),
        source: `aurora-visit:${visit.id}`,
        collectedBy: opts.userId,
        status: visit.onSite ? 'reported' : 'draft',
      },
    });
  }

  return { error: null, visit };
}
