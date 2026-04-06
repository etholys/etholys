import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: { signIn: '/login' },
});

export const config = {
  matcher: [
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
