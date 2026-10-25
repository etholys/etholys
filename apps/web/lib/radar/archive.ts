import { prisma } from '@/lib/prisma';

/** Soft-archive a property: hide from lists + deactivate units/sensors (recoverable). */
export async function archiveRadarProperty(companyId: string, propertyId: string) {
  const property = await prisma.radarProperty.findFirst({
    where: { id: propertyId, companyId, archivedAt: null },
    select: { id: true },
  });
  if (!property) return null;

  const units = await prisma.nexusOpsUnit.findMany({
    where: { propertyId, companyId, isActive: true },
    select: { id: true },
  });
  const unitIds = units.map((u) => u.id);

  await prisma.$transaction([
    prisma.radarProperty.update({
      where: { id: propertyId },
      data: { archivedAt: new Date() },
    }),
    ...(unitIds.length
      ? [
          prisma.nexusOpsUnit.updateMany({
            where: { id: { in: unitIds }, companyId },
            data: { isActive: false },
          }),
          prisma.nexusSensor.updateMany({
            where: { companyId, unitId: { in: unitIds }, isActive: true },
            data: { isActive: false },
          }),
        ]
      : []),
  ]);

  return { id: propertyId };
}

/** Soft-archive a client and all of its active properties. */
export async function archiveRadarClient(providerCompanyId: string, clientId: string) {
  const client = await prisma.radarClient.findFirst({
    where: { id: clientId, providerCompanyId, archivedAt: null },
    select: { id: true },
  });
  if (!client) return null;

  const properties = await prisma.radarProperty.findMany({
    where: { clientId, companyId: providerCompanyId, archivedAt: null },
    select: { id: true },
  });

  await prisma.radarClient.update({
    where: { id: clientId },
    data: { archivedAt: new Date() },
  });

  for (const p of properties) {
    await archiveRadarProperty(providerCompanyId, p.id);
  }

  return { id: clientId, propertiesArchived: properties.length };
}
