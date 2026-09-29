import { prisma } from '@/lib/prisma';

/** If producer already has ops units but no RadarProperty, bootstrap one so the funnel is visible. */
export async function ensureProducerBootstrap(companyId: string) {
  const existing = await prisma.radarProperty.count({ where: { companyId, clientId: null } });
  if (existing > 0) return null;

  const orphanUnits = await prisma.nexusOpsUnit.findMany({
    where: { companyId, isActive: true, propertyId: null },
    orderBy: { createdAt: 'asc' },
    take: 40,
  });
  if (orphanUnits.length === 0) return null;

  const first = orphanUnits[0];
  const dossier = await prisma.businessDossier.findUnique({
    where: { companyId },
    select: { pulsoModule: true },
  });
  const layout = await prisma.radarSiteLayout.findUnique({
    where: { companyId },
    select: { layoutJson: true },
  });

  const property = await prisma.radarProperty.create({
    data: {
      companyId,
      name: 'Exploração principal',
      moduleId: dossier?.pulsoModule || first.sectorId || 'agriculture',
      crop: first.crop,
      areaHa: first.areaHa,
      layoutJson: layout?.layoutJson ?? undefined,
    },
  });

  await prisma.nexusOpsUnit.updateMany({
    where: { id: { in: orphanUnits.map((u) => u.id) } },
    data: { propertyId: property.id },
  });

  return property;
}

export async function propertySensorCount(companyId: string, propertyId: string, unitIds: string[]) {
  if (unitIds.length === 0) {
    return prisma.nexusSensor.count({ where: { companyId, isActive: true, unitId: null } });
  }
  return prisma.nexusSensor.count({
    where: {
      companyId,
      isActive: true,
      OR: [{ unitId: { in: unitIds } }, { unitId: null }],
    },
  });
}
