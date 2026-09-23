import type { PrismaClient } from '@prisma/client';
import type { OpportunityBriefing } from '@/lib/opportunity/scan-types';

const SCAN_PROFILE_CATEGORY = 'opportunity_scan_profile';
const ACTIVE_PROFILE_KEY = '_active';

export const HORIZONTE_OPEN_SCAN_NAME = 'Rural Uruguay — abertos agora';

export const HORIZONTE_SEARCH_FEEDBACK = `Buscar convocatorias OFICIALES ABIERTAS HOY (no catálogo demo) para Uruguay y Cono Sur:
temas agro, agricultura familiar, rural, clima, juventud rural, educación rural, economía circular, bioeconomía.
Portales: gub.uy (MGAP, ANDE, ANII, INIA, OPP), bidlab.org, iadb.org, fonplata.org, caf.com, fao.org, ifad.org, ec.europa.eu, funding-tenders.europa.eu.
Elegibles: ONG, cooperativas, consorcios; empresa privada OK si el llamado lo permite.
Nunca devolver fondos ficticios del sandbox (Agencia Demo, Fundación Horizonte, Municipio Sierra Norte).
Preferir URL oficial del financiador; si solo hay agregador, incluir la oportunidad con linkOficial vacío.`;

export function horizonteOpportunityBriefing(): OpportunityBriefing {
  return {
    themes: ['agro', 'clima', 'educación', 'juventud', 'rural', 'economia circular'],
    countries: ['Uruguay', 'Argentina', 'Brasil'],
    kinds: ['grant', 'alliance', 'credit'],
    notes:
      'ONG en el norte de Uruguay. Fortalece cadenas agroalimentarias sostenibles, forma jóvenes rurales y articula cooperativas, gobiernos locales y cooperación internacional.',
    searchFeedback: HORIZONTE_SEARCH_FEEDBACK,
    scanName: HORIZONTE_OPEN_SCAN_NAME,
    classifications: ['direct', 'joint', 'client_bridge'],
    privateEligible: true,
    reimbursable: false,
  };
}

export async function applyHorizonteOpportunityBriefing(
  prisma: PrismaClient,
  companyId: string,
): Promise<void> {
  const briefing = horizonteOpportunityBriefing();
  const prefs = {
    briefingNotes: briefing.notes,
    opportunityKinds: briefing.kinds,
    searchFeedback: briefing.searchFeedback,
    scanName: briefing.scanName,
    classifications: briefing.classifications,
    privateEligible: true,
    reimbursable: false,
  };
  const data = {
    subscriptionTier: 'pro' as const,
    countriesCsv: 'Uruguay, Argentina, Brasil',
    themesCsv: briefing.themes.join(', '),
    fundTypesCsv: 'grant,prize,credit,alliance',
    institutionWishlistCsv: 'BID Lab,Unión Europea,CAF,FONPLATA,MGAP,ANII,ANDE',
    crossEtholysOptIn: true,
    preferencesJson: JSON.stringify(prefs),
  };

  await prisma.fundingCaptureProfile.upsert({
    where: { companyId },
    create: { companyId, ...data },
    update: data,
  });

  const profileId = 'rural_uruguay_abertos';
  const profileValue = JSON.stringify({
    id: profileId,
    name: HORIZONTE_OPEN_SCAN_NAME,
    briefing,
    classifications: briefing.classifications,
    updatedAt: new Date().toISOString(),
  });

  const existing = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: SCAN_PROFILE_CATEGORY, key: profileId },
  });
  if (existing) {
    await prisma.aiCompanyMemory.update({
      where: { id: existing.id },
      data: { value: profileValue, source: 'sandbox-seed' },
    });
  } else {
    await prisma.aiCompanyMemory.create({
      data: {
        companyId,
        category: SCAN_PROFILE_CATEGORY,
        key: profileId,
        value: profileValue,
        source: 'sandbox-seed',
      },
    });
  }

  const active = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: SCAN_PROFILE_CATEGORY, key: ACTIVE_PROFILE_KEY },
  });
  if (active) {
    await prisma.aiCompanyMemory.update({
      where: { id: active.id },
      data: { value: profileId, source: 'sandbox-seed' },
    });
  } else {
    await prisma.aiCompanyMemory.create({
      data: {
        companyId,
        category: SCAN_PROFILE_CATEGORY,
        key: ACTIVE_PROFILE_KEY,
        value: profileId,
        source: 'sandbox-seed',
      },
    });
  }
}
