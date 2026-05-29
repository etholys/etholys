import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { isPublicForgePath } from '@/lib/forge/public-paths';

export default withAuth(
  function middleware(req) {
    if (isPublicForgePath(req.nextUrl.pathname)) {
      return NextResponse.next();
    }
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized: ({ token, req }) => {
        if (isPublicForgePath(req.nextUrl.pathname)) return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
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
