export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveOpportunityCompanyId } from '@/lib/opportunity/resolve-company';
import {
  emptyContentLibrary,
  parseContentLibrary,
  type ContentLibrary,
} from '@/lib/opportunity/content-library';

const PREF_KEY = 'contentLibrary';

async function readPrefs(companyId: string): Promise<Record<string, unknown>> {
  const profile = await prisma.fundingCaptureProfile.findUnique({
    where: { companyId },
    select: { preferencesJson: true },
  });
  if (!profile?.preferencesJson) return {};
  try {
    return JSON.parse(profile.preferencesJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function writePrefs(companyId: string, prefs: Record<string, unknown>) {
  const existing = await prisma.fundingCaptureProfile.findUnique({
    where: { companyId },
    select: { id: true },
  });
  const json = JSON.stringify(prefs);
  if (existing) {
    await prisma.fundingCaptureProfile.update({
      where: { companyId },
      data: { preferencesJson: json },
    });
  } else {
    await prisma.fundingCaptureProfile.create({
      data: { companyId, preferencesJson: json },
    });
  }
}

export async function GET(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const prefs = await readPrefs(ctx.companyId);
  return NextResponse.json({
    library: parseContentLibrary(prefs[PREF_KEY]) ?? emptyContentLibrary(),
  });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveOpportunityCompanyId(req.nextUrl.searchParams.get('companyId'));
  if (!ctx) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  const body = (await req.json()) as { library?: ContentLibrary };
  const library = parseContentLibrary(body.library);
  const prefs = await readPrefs(ctx.companyId);
  prefs[PREF_KEY] = library;
  await writePrefs(ctx.companyId, prefs);
  return NextResponse.json({ library });
}
