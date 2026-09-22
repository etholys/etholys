import 'server-only';

import { prisma } from '@/lib/prisma';
import type {
  OpportunityBriefing,
  OpportunityClassification,
  ScanProfile,
} from '@/lib/opportunity/scan-types';
import { OPPORTUNITY_CLASSIFICATIONS } from '@/lib/opportunity/scan-types';

export const SCAN_PROFILE_CATEGORY = 'opportunity_scan_profile';
export const ACTIVE_PROFILE_KEY = '_active';

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 80);
}

function parseProfile(raw: string | null | undefined): ScanProfile | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Partial<ScanProfile>;
    if (!d.id || !d.name || !d.briefing) return null;
    return {
      id: d.id,
      name: d.name,
      briefing: d.briefing,
      classifications: Array.isArray(d.classifications)
        ? d.classifications.filter((c): c is OpportunityClassification =>
            (OPPORTUNITY_CLASSIFICATIONS as readonly string[]).includes(c),
          )
        : ['direct'],
      updatedAt: d.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function listScanProfiles(companyId: string): Promise<ScanProfile[]> {
  const rows = await prisma.aiCompanyMemory.findMany({
    where: {
      companyId,
      category: SCAN_PROFILE_CATEGORY,
      NOT: { key: ACTIVE_PROFILE_KEY },
    },
    orderBy: { updatedAt: 'desc' },
  });
  return rows.map((r) => parseProfile(r.value)).filter((p): p is ScanProfile => Boolean(p));
}

export async function getActiveProfileId(companyId: string): Promise<string | null> {
  const row = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: SCAN_PROFILE_CATEGORY, key: ACTIVE_PROFILE_KEY },
  });
  return row?.value?.trim() || null;
}

export async function setActiveProfileId(companyId: string, profileId: string | null): Promise<void> {
  const existing = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: SCAN_PROFILE_CATEGORY, key: ACTIVE_PROFILE_KEY },
  });
  const value = profileId ?? '';
  if (existing) {
    await prisma.aiCompanyMemory.update({ where: { id: existing.id }, data: { value, source: 'ui' } });
  } else {
    await prisma.aiCompanyMemory.create({
      data: {
        companyId,
        category: SCAN_PROFILE_CATEGORY,
        key: ACTIVE_PROFILE_KEY,
        value,
        source: 'ui',
      },
    });
  }
}

export async function upsertScanProfile(
  companyId: string,
  input: {
    id?: string;
    name: string;
    briefing: OpportunityBriefing;
    classifications?: OpportunityClassification[];
  },
): Promise<ScanProfile> {
  const id = input.id?.trim() || slugify(input.name) || `profile_${Date.now()}`;
  const profile: ScanProfile = {
    id,
    name: input.name.trim().slice(0, 120),
    briefing: input.briefing,
    classifications: input.classifications?.length ? input.classifications : ['direct'],
    updatedAt: new Date().toISOString(),
  };
  const value = JSON.stringify(profile);
  const existing = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: SCAN_PROFILE_CATEGORY, key: id },
  });
  if (existing) {
    await prisma.aiCompanyMemory.update({ where: { id: existing.id }, data: { value, source: 'ui' } });
  } else {
    await prisma.aiCompanyMemory.create({
      data: {
        companyId,
        category: SCAN_PROFILE_CATEGORY,
        key: id,
        value,
        source: 'ui',
      },
    });
  }
  await setActiveProfileId(companyId, id);
  return profile;
}

export async function readScanProfile(
  companyId: string,
  profileId: string,
): Promise<ScanProfile | null> {
  const row = await prisma.aiCompanyMemory.findFirst({
    where: { companyId, category: SCAN_PROFILE_CATEGORY, key: profileId },
  });
  return parseProfile(row?.value);
}

export async function deleteScanProfile(companyId: string, profileId: string): Promise<void> {
  await prisma.aiCompanyMemory.deleteMany({
    where: { companyId, category: SCAN_PROFILE_CATEGORY, key: profileId },
  });
  const active = await getActiveProfileId(companyId);
  if (active === profileId) {
    await setActiveProfileId(companyId, null);
  }
}

/** Converte texto longo de orientação num briefing estruturado (heurística). */
export function briefingFromOrientationText(
  text: string,
  base?: Partial<OpportunityBriefing>,
): OpportunityBriefing {
  const lower = text.toLowerCase();
  const themesFromText: string[] = [];
  const themeHints = [
    ['desenvolvimento rural', 'desenvolvimento rural'],
    ['mudanças climáticas', 'mudanças climáticas'],
    ['mudancas climaticas', 'mudanças climáticas'],
    ['economia verde', 'economia verde'],
    ['economia circular', 'economia circular'],
    ['digitalização', 'digitalização'],
    ['digitalizacao', 'digitalização'],
    ['empreendedorismo', 'empreendedorismo'],
    ['emprendedorismo', 'empreendedorismo'],
    ['inovação', 'inovação'],
    ['inovacao', 'inovação'],
    ['tecnologia', 'tecnologia'],
    ['desenvolvimento social', 'desenvolvimento social'],
    ['desenvolvimento de negócio', 'desenvolvimento de negócio'],
    ['negocios', 'negócios'],
    ['negócios', 'negócios'],
  ];
  for (const [needle, label] of themeHints) {
    if (lower.includes(needle) && !themesFromText.includes(label)) themesFromText.push(label);
  }

  const countries: string[] = [];
  if (/brasil|brazil/i.test(text)) countries.push('Brasil');
  if (/estados unidos|united states|\beua\b|\busa\b/i.test(text)) countries.push('Estados Unidos');
  if (/qualquer lugar do mundo|worldwide|global|mundo/i.test(text)) {
    if (!countries.includes('Global')) countries.push('Global');
  }

  let amountMax = base?.amountMax;
  const m = text.match(/(\d[\d.\s]*)\s*(?:mil|k)\s*(?:d[oó]lares|usd|\$)/i);
  if (m) {
    const n = parseFloat(m[1].replace(/\s/g, '').replace(/\./g, ''));
    if (Number.isFinite(n)) amountMax = n * 1000;
  } else {
    const m2 = text.match(/at[eé]\s+(\d[\d.,]*)\s*(?:usd|d[oó]lares|\$)/i);
    if (m2) {
      const n = parseFloat(m2[1].replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(n)) amountMax = n;
    }
  }

  const grantOnly =
    /n[aã]o reembols[aá]vel|non[- ]?reimbursable|grant|nada de empr[eé]stimo|sem empr[eé]stimo|no loan/i.test(
      text,
    );

  return {
    themes: themesFromText.length ? themesFromText : base?.themes ?? [],
    countries: countries.length ? countries : base?.countries ?? [],
    kinds: grantOnly ? ['grant'] : base?.kinds ?? ['grant'],
    amountMin: base?.amountMin,
    amountMax: amountMax ?? base?.amountMax,
    notes: base?.notes,
    searchFeedback: text.trim(),
    privateEligible: /empresas privadas|empresa privada|private compan/i.test(text),
    reimbursable: false,
  };
}
