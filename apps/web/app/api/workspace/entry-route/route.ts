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

  // Convidados FORGE sem empresa: nunca mandar para /hub do ecossistema
  if (tenant.companyIds.length === 0) {
    const { getForgeAccessContext, defaultRedirectForCourseOnly } = await import(
      '@/lib/forge/access-context'
    );
    const ctx = await getForgeAccessContext();
    if (ctx?.mode === 'course_only') {
      return NextResponse.json({
        href: defaultRedirectForCourseOnly(ctx),
        reason: 'course_only',
      });
    }
    return NextResponse.json({ href: '/hub/forge/mis-cursos', reason: 'no_company_forge' });
  }

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
  if (access.ok && access.systems.length >= 1) {
    const { isPrecommercialMode } = await import('@/lib/platform-access');
    const { isCompanyAdmin } = await import('@/lib/integrated-workspace');
    const admin = await isCompanyAdmin(userId, companyId);
    // Pré-comercial + não-admin: nunca mandar ao Hub — ir à função (ou primeira se várias)
    if (isPrecommercialMode() && !admin) {
      const key = access.systems[0];
      const href = LICENSE_KEY_TO_HREF[key];
      if (href) {
        return NextResponse.json({
          href,
          reason: access.systems.length === 1 ? 'single_system' : 'function_only',
          system: key,
          companyId,
        });
      }
      return NextResponse.json({ href: '/acesso', reason: 'no_href', companyId });
    }
    if (access.systems.length === 1) {
      const key = access.systems[0];
      const href = LICENSE_KEY_TO_HREF[key];
      if (href) {
        return NextResponse.json({ href, reason: 'single_system', system: key, companyId });
      }
    }
  }

  return NextResponse.json({ href: '/hub', reason: 'multi_or_unlicensed', companyId });
}
