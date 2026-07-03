export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getUserCompanyIds } from '@/lib/tenant';
import { getWorkspaceAccessForUser } from '@/lib/integrated-workspace';
import { LICENSE_KEY_TO_HREF } from '@/lib/hub-system-license';
import { isLikelyDbId } from '@/lib/utils';

/** Destino pós-login: hub ou sistema único licenciado. */
export async function GET(req: Request) {
  const tenant = await getUserCompanyIds();
  if (!tenant) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = tenant.userId;
  const url = new URL(req.url);
  const requestedCompanyId = String(url.searchParams.get('companyId') ?? '').trim();

  let companyId = isLikelyDbId(requestedCompanyId) ? requestedCompanyId : '';
  if (!companyId) {
    const cookieHeader = req.headers.get('cookie') ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)rc360_company=([^;]*)/);
    const fromCookie = match?.[1] ? decodeURIComponent(match[1].trim()) : '';
    if (isLikelyDbId(fromCookie)) companyId = fromCookie;
  }
  if (!companyId) {
    const membership = await prisma.companyUser.findFirst({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { companyId: true },
    });
    companyId = membership?.companyId ?? '';
  }

  if (!companyId) {
    return NextResponse.json({ href: '/hub', reason: 'no_company' });
  }

  const access = await getWorkspaceAccessForUser(userId, companyId);
  if (access.ok && access.systems.length === 1) {
    const key = access.systems[0];
    const href = LICENSE_KEY_TO_HREF[key];
    if (href) {
      return NextResponse.json({ href, reason: 'single_system', system: key, companyId });
    }
  }

  return NextResponse.json({ href: '/hub', reason: 'multi_or_unlicensed', companyId });
}
