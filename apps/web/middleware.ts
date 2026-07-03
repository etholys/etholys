import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isPublicForgePath } from '@/lib/forge/public-paths';
import { isPublicFundhubPath } from '@/lib/fundhub/public-paths';
import { apiPathToLicensedSystem, isApiLicenseExempt } from '@/lib/api-system-license-map';

const PAGE_PREFIXES = [
  '/hub',
  '/dashboard',
  '/siep',
  '/tasks',
  '/reports',
  '/settings',
  '/team',
  '/templates',
  '/onboarding',
  '/finance',
  '/invoices',
  '/suppliers',
  '/hr',
  '/inventory',
  '/clients',
  '/planning',
  '/calculator',
  '/documents',
  '/chat',
  '/lab',
];

function isProtectedPage(pathname: string): boolean {
  if (isPublicForgePath(pathname) || isPublicFundhubPath(pathname)) return false;
  return PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

async function enforceApiLicense(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith('/api/') || isApiLicenseExempt(pathname)) return null;

  const system = apiPathToLicensedSystem(pathname);
  if (!system) return null;

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  try {
    const checkUrl = new URL('/api/internal/system-license', req.nextUrl.origin);
    checkUrl.searchParams.set('system', system);
    const companyId = req.nextUrl.searchParams.get('companyId');
    if (companyId) checkUrl.searchParams.set('companyId', companyId);

    const licenseRes = await fetch(checkUrl.toString(), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });

    if (licenseRes.status === 403) {
      const body = await licenseRes.text();
      return new NextResponse(body, { status: 403, headers: { 'content-type': 'application/json' } });
    }
    if (licenseRes.status === 401) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
  } catch (e) {
    // Falha aberta: não bloquear acesso se o check interno falhar (protege dados existentes).
    console.error('[middleware] license check failed — allowing request', e);
  }

  return null;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const apiBlock = await enforceApiLicense(req);
  if (apiBlock) return apiBlock;

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (isProtectedPage(pathname)) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/fundhub/share/:path*',
    '/api/:path*',
    '/hub',
    '/hub/:path*',
    '/dashboard/:path*',
    '/siep/:path*',
    '/tasks/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/team/:path*',
    '/templates/:path*',
    '/onboarding/:path*',
    '/finance/:path*',
    '/invoices/:path*',
    '/suppliers/:path*',
    '/hr/:path*',
    '/inventory/:path*',
    '/clients/:path*',
    '/planning/:path*',
    '/calculator/:path*',
    '/documents/:path*',
    '/chat/:path*',
    '/lab/:path*',
  ],
};
