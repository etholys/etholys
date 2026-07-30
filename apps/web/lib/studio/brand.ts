import { prisma } from '@/lib/prisma';
import { DEFAULT_STUDIO_BRAND, type StudioBrandKit } from '@/lib/studio/export';

const BRAND_CATEGORY = 'studio_brand';
const BRAND_KEY = 'kit';

export async function getStudioBrandKit(companyId: string): Promise<StudioBrandKit> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, shortName: true, logo: true, color: true },
  });

  let override: Partial<StudioBrandKit> = {};
  try {
    const mem = await prisma.aiCompanyMemory.findFirst({
      where: { companyId, category: BRAND_CATEGORY, key: BRAND_KEY },
    });
    if (mem?.value) {
      const parsed = JSON.parse(mem.value) as Partial<StudioBrandKit>;
      if (parsed && typeof parsed === 'object') override = parsed;
    }
  } catch {
    // ignore
  }

  return {
    ...DEFAULT_STUDIO_BRAND,
    primaryColor: override.primaryColor || company?.color || DEFAULT_STUDIO_BRAND.primaryColor,
    secondaryColor: override.secondaryColor || DEFAULT_STUDIO_BRAND.secondaryColor,
    logoUrl: override.logoUrl !== undefined ? override.logoUrl : company?.logo || null,
    orgName: override.orgName || company?.shortName || company?.name || null,
    footerText: override.footerText || `${company?.shortName || 'Etholys'} · Studio`,
    fontFamily: override.fontFamily || DEFAULT_STUDIO_BRAND.fontFamily,
  };
}

export async function saveStudioBrandKit(
  companyId: string,
  patch: Partial<StudioBrandKit>,
): Promise<StudioBrandKit> {
  const current = await getStudioBrandKit(companyId);
  const next: StudioBrandKit = {
    ...current,
    ...patch,
    primaryColor: patch.primaryColor || current.primaryColor,
  };

  const existing = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: BRAND_CATEGORY, key: BRAND_KEY },
  });
  const value = JSON.stringify({
    primaryColor: next.primaryColor,
    secondaryColor: next.secondaryColor,
    logoUrl: next.logoUrl,
    orgName: next.orgName,
    footerText: next.footerText,
    fontFamily: next.fontFamily,
  });

  if (existing) {
    await prisma.aiCompanyMemory.update({
      where: { id: existing.id },
      data: { value, source: 'studio' },
    });
  } else {
    await prisma.aiCompanyMemory.create({
      data: {
        companyId,
        category: BRAND_CATEGORY,
        key: BRAND_KEY,
        value,
        source: 'studio',
      },
    });
  }

  return next;
}
