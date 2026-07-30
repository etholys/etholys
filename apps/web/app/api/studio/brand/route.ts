import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { resolveStudioCompanyId } from '@/lib/studio/access';
import { getStudioBrandKit, saveStudioBrandKit } from '@/lib/studio/brand';
import type { StudioBrandKit } from '@/lib/studio/export';

export const dynamic = 'force-dynamic';

async function authUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;
  return prisma.user.findUnique({ where: { email: session.user.email } });
}

/** GET /api/studio/brand */
export async function GET(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const companyId = await resolveStudioCompanyId(
    user.id,
    req.nextUrl.searchParams.get('companyId'),
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });
  const brand = await getStudioBrandKit(companyId);
  return NextResponse.json({ brand });
}

/** PUT /api/studio/brand */
export async function PUT(req: NextRequest) {
  const user = await authUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = await resolveStudioCompanyId(
    user.id,
    typeof body.companyId === 'string' ? body.companyId : null,
  );
  if (!companyId) return NextResponse.json({ error: 'No company' }, { status: 400 });

  const patch: Partial<StudioBrandKit> = {};
  if (typeof body.primaryColor === 'string') patch.primaryColor = body.primaryColor.trim();
  if (typeof body.secondaryColor === 'string') patch.secondaryColor = body.secondaryColor.trim();
  if (typeof body.logoUrl === 'string') patch.logoUrl = body.logoUrl.trim() || null;
  if (body.logoUrl === null) patch.logoUrl = null;
  if (typeof body.orgName === 'string') patch.orgName = body.orgName.trim();
  if (typeof body.footerText === 'string') patch.footerText = body.footerText.trim();
  if (typeof body.fontFamily === 'string') patch.fontFamily = body.fontFamily.trim();

  const brand = await saveStudioBrandKit(companyId, patch);
  return NextResponse.json({ brand });
}
