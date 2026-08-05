import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isPublicForgePath } from '@/lib/forge/public-paths';
import { isPublicFundhubPath } from '@/lib/fundhub/public-paths';
import { apiPathToLicensedSystem, isApiLicenseExempt } from '@/lib/api-system-license-map';
import {
  defaultCourseOnlyHome,
  isApiAllowedForCourseOnlyUser,
  isPageAllowedForCourseOnlyUser,
} from '@/lib/forge/course-only-guard';
import {
  defaultStudioShareOnlyHome,
  isApiAllowedForStudioShareOnly,
  isPageAllowedForStudioShareOnly,
  type StudioShareTargetRef,
} from '@/lib/studio/share-guard';
import {
  isHubShellPath,
  isPathAllowedForSystems,
  isPrecommercialMode,
  type WorkspaceAccessMode,
} from '@/lib/platform-access';
import type { WorkspaceSystemKey } from '@/lib/integrated-workspace-shared';

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
  '/acesso',
  '/studio',
];

function isProtectedPage(pathname: string): boolean {
  if (isPublicForgePath(pathname) || isPublicFundhubPath(pathname)) return false;
  return PAGE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type AccessToken = {
  sub?: string;
  id?: string;
  forgeAccessMode?: string;
  allowedCourseIds?: string[];
  forgeHomePath?: string;
  workspaceAccessMode?: WorkspaceAccessMode;
  allowedSystems?: string[];
  workspaceHomePath?: string;
  platformAdmin?: boolean;
  studioAccessMode?: string;
  studioTargets?: StudioShareTargetRef[];
  studioHomePath?: string;
};

type ForgeScope = {
  mode: 'organization' | 'course_only';
  allowedCourseIds: string[];
  homePath: string;
};

type WorkspaceScope = {
  mode: WorkspaceAccessMode;
  allowedSystems: WorkspaceSystemKey[];
  homePath: string;
};

async function resolveForgeScope(req: NextRequest, token: AccessToken): Promise<ForgeScope | null> {
  if (token.forgeAccessMode === 'organization') {
    return { mode: 'organization', allowedCourseIds: [], homePath: '/hub' };
  }
  if (token.forgeAccessMode === 'course_only' && Array.isArray(token.allowedCourseIds)) {
    return {
      mode: 'course_only',
      allowedCourseIds: token.allowedCourseIds,
      homePath:
        typeof token.forgeHomePath === 'string'
          ? token.forgeHomePath
          : defaultCourseOnlyHome({ allowedCourseIds: token.allowedCourseIds }),
    };
  }

  try {
    const checkUrl = new URL('/api/internal/forge-scope', req.nextUrl.origin);
    const res = await fetch(checkUrl.toString(), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as ForgeScope;
  } catch (e) {
    console.error('[middleware] forge-scope check failed', e);
    return null;
  }
}

async function resolveWorkspaceScope(req: NextRequest, token: AccessToken): Promise<WorkspaceScope | null> {
  if (token.platformAdmin || token.workspaceAccessMode === 'full') {
    return { mode: 'full', allowedSystems: [], homePath: '/hub' };
  }
  if (token.workspaceAccessMode === 'function_only' || token.workspaceAccessMode === 'none') {
    return {
      mode: token.workspaceAccessMode,
      allowedSystems: (token.allowedSystems || []) as WorkspaceSystemKey[],
      homePath: typeof token.workspaceHomePath === 'string' ? token.workspaceHomePath : '/acesso',
    };
  }

  try {
    const checkUrl = new URL('/api/internal/workspace-scope', req.nextUrl.origin);
    const res = await fetch(checkUrl.toString(), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as WorkspaceScope;
  } catch (e) {
    console.error('[middleware] workspace-scope check failed', e);
    return null;
  }
}

function courseOnlyRedirect(req: NextRequest, scope: ForgeScope) {
  const home = defaultCourseOnlyHome({
    allowedCourseIds: scope.allowedCourseIds,
    homePath: scope.homePath,
  });
  return NextResponse.redirect(new URL(home, req.url));
}

async function enforceStudioShareOnlyScope(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (pathname === '/api/internal/studio-scope') return null;

  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as AccessToken | null;

  if (!token?.sub && !token?.id) return null;

  let mode = token.studioAccessMode;
  let targets = Array.isArray(token.studioTargets) ? token.studioTargets : [];
  let homePath = typeof token.studioHomePath === 'string' ? token.studioHomePath : '/studio/shared';

  if (mode !== 'share_only') {
    // Pode estar desatualizado no JWT — confirmar via API só se não for member explícito
    if (mode === 'member') return null;
    try {
      const checkUrl = new URL('/api/internal/studio-scope', req.nextUrl.origin);
      const res = await fetch(checkUrl.toString(), {
        headers: { cookie: req.headers.get('cookie') ?? '' },
        cache: 'no-store',
      });
      if (!res.ok) return null;
      const scope = (await res.json()) as {
        mode?: string;
        targets?: StudioShareTargetRef[];
        homePath?: string;
      };
      if (scope.mode !== 'share_only') return null;
      mode = 'share_only';
      targets = scope.targets || [];
      homePath = scope.homePath || defaultStudioShareOnlyHome(targets);
    } catch {
      return null;
    }
  }

  if (pathname.startsWith('/api/')) {
    if (isApiAllowedForStudioShareOnly(pathname)) return null;
    return NextResponse.json(
      { error: 'Acesso restrito: apenas o conteúdo Studio partilhado consigo.', code: 'STUDIO_SHARE_ONLY' },
      { status: 403 },
    );
  }

  if (isPageAllowedForStudioShareOnly(pathname, targets)) return null;

  if (isProtectedPage(pathname) || pathname === '/hub' || pathname.startsWith('/hub/')) {
    return NextResponse.redirect(new URL(homePath || '/studio/shared', req.url));
  }

  return null;
}

async function enforceCourseOnlyScope(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (pathname === '/api/internal/forge-scope') return null;

  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as AccessToken | null;

  if (!token?.sub && !token?.id) return null;
  if (token.forgeAccessMode === 'organization') return null;

  const needsScopeCheck =
    token.forgeAccessMode === 'course_only' ||
    !token.forgeAccessMode ||
    isProtectedPage(pathname) ||
    pathname.startsWith('/api/');

  if (!needsScopeCheck) return null;

  const scope = await resolveForgeScope(req, token);
  if (!scope || scope.mode !== 'course_only') return null;

  if (pathname.startsWith('/api/')) {
    if (isApiAllowedForCourseOnlyUser(pathname)) return null;
    return NextResponse.json(
      { error: 'Acceso restringido: solo el curso FORGE asignado.' },
      { status: 403 },
    );
  }

  if (isPageAllowedForCourseOnlyUser(pathname, scope.allowedCourseIds)) return null;

  if (isProtectedPage(pathname) || pathname === '/hub' || pathname.startsWith('/hub/')) {
    return courseOnlyRedirect(req, scope);
  }

  return null;
}

async function enforceFunctionOnlyScope(req: NextRequest): Promise<NextResponse | null> {
  if (!isPrecommercialMode()) return null;

  const pathname = req.nextUrl.pathname;
  if (
    pathname === '/api/internal/workspace-scope' ||
    pathname === '/api/internal/forge-scope' ||
    pathname === '/api/internal/studio-scope' ||
    pathname.startsWith('/api/auth')
  ) {
    return null;
  }

  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as AccessToken | null;

  if (!token?.sub && !token?.id) return null;
  if (token.forgeAccessMode === 'course_only') return null;
  if (token.studioAccessMode === 'share_only') return null;

  const scope = await resolveWorkspaceScope(req, token);
  if (!scope || scope.mode === 'full') return null;

  if (pathname.startsWith('/api/')) {
    if (scope.mode === 'none') {
      return NextResponse.json({ error: 'Acceso restringido.' }, { status: 403 });
    }
    const system = apiPathToLicensedSystem(pathname);
    if (!system) return null;
    if (!scope.allowedSystems.includes(system)) {
      return NextResponse.json(
        { error: 'Sin permiso para este módulo.', code: 'FUNCTION_ONLY' },
        { status: 403 },
      );
    }
    return null;
  }

  if (pathname === '/acesso' || pathname.startsWith('/acesso/')) return null;

  // Studio = ferramenta transversal com atalho em todos os sistemas (não é Hub shell).
  if (
    (pathname === '/hub/studio' || pathname.startsWith('/hub/studio/')) &&
    scope.allowedSystems.length > 0
  ) {
    return null;
  }

  if (scope.mode === 'none') {
    if (isProtectedPage(pathname)) {
      return NextResponse.redirect(new URL('/acesso', req.url));
    }
    return null;
  }

  if (isHubShellPath(pathname)) {
    return NextResponse.redirect(new URL(scope.homePath || '/acesso', req.url));
  }

  if (isProtectedPage(pathname) && !isPathAllowedForSystems(pathname, scope.allowedSystems)) {
    return NextResponse.redirect(new URL(scope.homePath || '/acesso', req.url));
  }

  return null;
}

async function enforceApiLicense(req: NextRequest): Promise<NextResponse | null> {
  const pathname = req.nextUrl.pathname;
  if (!pathname.startsWith('/api/') || isApiLicenseExempt(pathname)) return null;

  const system = apiPathToLicensedSystem(pathname);
  if (!system) return null;

  const token = (await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })) as AccessToken | null;
  if (!token?.sub) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  if (token.forgeAccessMode === 'course_only' || !token.forgeAccessMode) {
    const scope = await resolveForgeScope(req, token);
    if (scope?.mode === 'course_only') {
      if (isApiAllowedForCourseOnlyUser(pathname)) return null;
      return NextResponse.json(
        { error: 'Acceso restringido: solo el curso FORGE asignado.' },
        { status: 403 },
      );
    }
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
    console.error('[middleware] license check failed — allowing request', e);
  }

  return null;
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const courseOnlyBlock = await enforceCourseOnlyScope(req);
  if (courseOnlyBlock) return courseOnlyBlock;

  const studioShareBlock = await enforceStudioShareOnlyScope(req);
  if (studioShareBlock) return studioShareBlock;

  const functionOnlyBlock = await enforceFunctionOnlyScope(req);
  if (functionOnlyBlock) return functionOnlyBlock;

  const apiBlock = await enforceApiLicense(req);
  if (apiBlock) return apiBlock;

  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (isProtectedPage(pathname)) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (!token) {
      if (isPrecommercialMode()) {
        return NextResponse.redirect(new URL('/', req.url));
      }
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
    '/acesso',
    '/acesso/:path*',
    '/studio',
    '/studio/:path*',
  ],
};
