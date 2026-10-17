import { prisma } from './prisma';
import { canMutateAuroraFlow } from './aurora-flow-turn';
import { parsePolygon, type GeoPoint } from './aurora-visit';
import { readCompliance, ringCentroid, territorialEligibility, type TerritorialCompliance } from './aurora-territory';
import { ringsFromUpload } from './aurora-shp';
import { buildGcfWorkbook } from './aurora-gcf';
import { generatePresignedUploadUrl } from './s3';

async function ownedProperty(tenantCompanyIds: string[], attendedCompanyId: string, engagementId: string, propertyId: string) {
  if (!(await canMutateAuroraFlow(tenantCompanyIds, attendedCompanyId, engagementId))) return null;
  const property = await prisma.radarProperty.findFirst({
    where: {
      id: propertyId,
      OR: [{ companyId: attendedCompanyId }, { client: { linkedCompanyId: attendedCompanyId } }],
    },
    select: { id: true, companyId: true, lat: true, lng: true, areaHa: true, polygonJson: true, complianceJson: true, name: true },
  });
  return property;
}

export async function savePropertyTerritory(opts: {
  tenantCompanyIds: string[];
  attendedCompanyId: string;
  engagementId: string;
  propertyId: string;
  compliance: unknown;
  polygon: unknown;
}) {
  const property = await ownedProperty(opts.tenantCompanyIds, opts.attendedCompanyId, opts.engagementId, opts.propertyId);
  if (!property) return { error: 'forbidden' as const };
  const compliance = readCompliance(opts.compliance);
  const ring = parsePolygon(opts.polygon);
  const center = ring.length >= 3 ? ringCentroid(ring) : null;
  await prisma.radarProperty.update({
    where: { id: property.id },
    data: {
      complianceJson: compliance,
      polygonJson: ring.length >= 3 ? ring : undefined,
      lat: center?.lat ?? property.lat,
      lng: center?.lng ?? property.lng,
    },
  });
  return { error: null, compliance, eligibility: territorialEligibility(compliance) };
}

export async function importPropertyPolygon(opts: {
  tenantCompanyIds: string[];
  attendedCompanyId: string;
  engagementId: string;
  propertyId: string;
  fileName: string;
  bytes: Uint8Array;
}) {
  const property = await ownedProperty(opts.tenantCompanyIds, opts.attendedCompanyId, opts.engagementId, opts.propertyId);
  if (!property) return { error: 'forbidden' as const };
  const rings = await ringsFromUpload(opts.fileName, opts.bytes);
  const ring = rings[0];
  if (!ring || ring.length < 3) return { error: 'polygon' as const };
  const center = ringCentroid(ring);
  await prisma.radarProperty.update({
    where: { id: property.id },
    data: {
      polygonJson: ring,
      lat: center?.lat ?? property.lat,
      lng: center?.lng ?? property.lng,
    },
  });
  return { error: null, points: ring.length };
}

export async function presignDrone(opts: {
  tenantCompanyIds: string[];
  attendedCompanyId: string;
  engagementId: string;
  propertyId: string;
  fileName: string;
  contentType: string;
}) {
  const property = await ownedProperty(opts.tenantCompanyIds, opts.attendedCompanyId, opts.engagementId, opts.propertyId);
  if (!property) return { error: 'forbidden' as const };
  const safeName = opts.fileName.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'drone.jpg';
  const contentType = opts.contentType.startsWith('image/') ? opts.contentType : 'image/jpeg';
  const signed = await generatePresignedUploadUrl(`drone-${safeName}`, contentType, false);
  return { error: null, uploadUrl: signed.uploadUrl, cloudStoragePath: signed.cloud_storage_path };
}

export async function commitDrone(opts: {
  tenantCompanyIds: string[];
  userId: string;
  attendedCompanyId: string;
  engagementId: string;
  propertyId: string;
  fileName: string;
  contentType: string;
  cloudStoragePath: string;
}) {
  const property = await ownedProperty(opts.tenantCompanyIds, opts.attendedCompanyId, opts.engagementId, opts.propertyId);
  if (!property) return { error: 'forbidden' as const };
  const path = opts.cloudStoragePath.trim();
  if (!path || path.includes('..')) return { error: 'path' as const };
  const engagement = await prisma.nexusAtEngagement.findUnique({
    where: { id: opts.engagementId },
    select: { operatorCompanyId: true },
  });
  if (!engagement) return { error: 'forbidden' as const };
  const row = await prisma.auroraDroneImage.create({
    data: {
      operatorCompanyId: engagement.operatorCompanyId,
      attendedCompanyId: opts.attendedCompanyId,
      engagementId: opts.engagementId,
      propertyId: property.id,
      authorUserId: opts.userId,
      fileName: opts.fileName.slice(0, 180),
      contentType: opts.contentType.slice(0, 80),
      cloudStoragePath: path.slice(0, 400),
    },
    select: { id: true },
  });
  return { error: null, id: row.id };
}

export async function gcfWorkbookForEngagement(opts: {
  tenantCompanyIds: string[];
  attendedCompanyId: string;
  engagementId: string;
}) {
  if (!(await canMutateAuroraFlow(opts.tenantCompanyIds, opts.attendedCompanyId, opts.engagementId))) return null;
  const engagement = await prisma.nexusAtEngagement.findUnique({
    where: { id: opts.engagementId },
    select: { siepProjectId: true, siepProject: { select: { id: true, name: true, budget: true, spent: true } } },
  });
  if (!engagement?.siepProject) return null;
  const project = engagement.siepProject;
  const [properties, objectives, visits, lines] = await Promise.all([
    prisma.radarProperty.findMany({
      where: { OR: [{ companyId: opts.attendedCompanyId }, { client: { linkedCompanyId: opts.attendedCompanyId } }] },
      select: { id: true, name: true, lat: true, lng: true, areaHa: true, complianceJson: true },
    }),
    prisma.objective.findMany({
      where: { projectId: project.id, isActive: true },
      select: { id: true, code: true, title: true, indicator: true, unitOfMeasure: true },
    }),
    prisma.auroraFieldVisit.findMany({
      where: { siepProjectId: project.id },
      select: { objectiveId: true, onSite: true, indicatorValue: true },
    }),
    prisma.budgetLine.findMany({
      where: { projectId: project.id, isActive: true },
      select: { total: true },
    }),
  ]);
  const indicators = objectives.map((o) => {
    const related = visits.filter((v) => v.objectiveId === o.id);
    const summed = related.reduce((s, v) => s + (Number(v.indicatorValue) || 0), 0);
    return {
      code: o.code || '',
      title: o.title,
      indicator: o.indicator || o.title,
      unit: o.unitOfMeasure || '',
      value: summed ? String(summed) : String(related.length),
      visits: related.length,
      onSite: related.filter((v) => v.onSite).length,
    };
  });
  const budgetFromLines = lines.reduce((s, l) => s + (l.total || 0), 0);
  const buffer = buildGcfWorkbook({
    projectName: project.name,
    properties: properties.map((p) => ({
      id: p.id,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      areaHa: p.areaHa,
      compliance: p.complianceJson ? readCompliance(p.complianceJson) : null,
    })),
    indicators,
    budgetTotal: budgetFromLines || project.budget || 0,
    budgetSpent: project.spent || 0,
  });
  return { name: project.name, buffer };
}

export function propertyGate(complianceJson: unknown, polygon: unknown): { eligible: boolean; reasons: string[]; ring: GeoPoint[] } {
  const compliance: TerritorialCompliance = readCompliance(complianceJson);
  const ring = parsePolygon(polygon);
  const gate = territorialEligibility(compliance);
  return { eligible: gate.eligible, reasons: gate.reasons, ring };
}
