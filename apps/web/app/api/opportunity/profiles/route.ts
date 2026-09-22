export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { writeOpportunityBriefing } from '@/lib/opportunity/briefing';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import {
  briefingFromOrientationText,
  getActiveProfileId,
  listScanProfiles,
  readScanProfile,
  upsertScanProfile,
} from '@/lib/opportunity/scan-profiles';
import type { OpportunityBriefing, OpportunityClassification } from '@/lib/opportunity/scan-types';
import { OPPORTUNITY_CLASSIFICATIONS } from '@/lib/opportunity/scan-types';

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const [profiles, activeId] = await Promise.all([
    listScanProfiles(ctx.companyId),
    getActiveProfileId(ctx.companyId),
  ]);

  return NextResponse.json({
    companyId: ctx.companyId,
    profiles,
    activeProfileId: activeId,
  });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as {
    name?: string;
    orientationText?: string;
    briefing?: OpportunityBriefing;
    classifications?: OpportunityClassification[];
    id?: string;
    activate?: boolean;
  };

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: 'Nome da varredura obrigatório' }, { status: 400 });
  }

  let briefing: OpportunityBriefing;
  if (body.orientationText?.trim()) {
    briefing = briefingFromOrientationText(body.orientationText, body.briefing);
  } else if (body.briefing) {
    briefing = body.briefing;
  } else {
    return NextResponse.json({ error: 'briefing ou orientationText obrigatório' }, { status: 400 });
  }

  briefing = {
    ...briefing,
    scanName: name,
    searchFeedback: body.orientationText?.trim() || briefing.searchFeedback,
  };

  const classifications = (body.classifications ?? briefing.classifications ?? ['direct']).filter(
    (c): c is OpportunityClassification =>
      (OPPORTUNITY_CLASSIFICATIONS as readonly string[]).includes(c),
  );

  briefing.classifications = classifications;

  const profile = await upsertScanProfile(ctx.companyId, {
    id: body.id,
    name,
    briefing,
    classifications,
  });

  // Sincroniza briefing activo da empresa
  await writeOpportunityBriefing(ctx.companyId, briefing);

  return NextResponse.json({
    companyId: ctx.companyId,
    profile,
    briefing,
  });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const body = (await req.json()) as { profileId?: string };
  if (!body.profileId) {
    return NextResponse.json({ error: 'profileId obrigatório' }, { status: 400 });
  }

  const profile = await readScanProfile(ctx.companyId, body.profileId);
  if (!profile) return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 });

  const { setActiveProfileId } = await import('@/lib/opportunity/scan-profiles');
  await setActiveProfileId(ctx.companyId, profile.id);
  await writeOpportunityBriefing(ctx.companyId, {
    ...profile.briefing,
    scanName: profile.name,
    classifications: profile.classifications,
  });

  return NextResponse.json({ companyId: ctx.companyId, profile, briefing: profile.briefing });
}

export async function DELETE(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const profileId = req.nextUrl.searchParams.get('profileId')?.trim();
  if (!profileId) {
    return NextResponse.json({ error: 'profileId obrigatório' }, { status: 400 });
  }

  const { deleteScanProfile } = await import('@/lib/opportunity/scan-profiles');
  await deleteScanProfile(ctx.companyId, profileId);
  return NextResponse.json({ companyId: ctx.companyId, deleted: profileId });
}
