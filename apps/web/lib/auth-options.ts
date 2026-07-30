import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { findEnrollmentByMagicToken } from '@/lib/forge/invite-auth';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        forgeMagicToken: { label: 'Forge Magic', type: 'text' },
      },
      async authorize(credentials) {
        try {
          const magic = (credentials as { forgeMagicToken?: string })?.forgeMagicToken?.trim();
          if (magic) {
            const enrollment = await findEnrollmentByMagicToken(magic);
            const user = enrollment?.user;
            if (!user?.isActive || !user.email) return null;
            if (credentials?.email && user.email.toLowerCase() !== credentials.email.trim().toLowerCase()) {
              return null;
            }
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              locale: user.locale,
              image: user.avatar || user.image,
            } as any;
          }

          if (!credentials?.email || !credentials?.password) return null;
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.trim() },
          });
          if (!user || !user.isActive || !user.password) return null;
          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            locale: user.locale,
            image: user.avatar || user.image,
          } as any;
        } catch (e) {
          // Erro de DB/rede aparecia como "credenciais inválidas" — regista no servidor para diagnóstico.
          console.error('[next-auth][credentials] Falha ao validar login (muito provável: base de dados ou DATABASE_URL):', e);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.id = user.id;
        token.role = user.role || 'COLLABORATOR';
        token.locale = user.locale || 'es';
        token.forgeScopeCheckedAt = 0;
      }

      const userId = (token.id as string) || (token.sub as string);
      const checkedAt = typeof token.forgeScopeCheckedAt === 'number' ? token.forgeScopeCheckedAt : 0;
      const stale = Date.now() - checkedAt > 5 * 60 * 1000;
      if (userId && (user || stale || !token.forgeAccessMode)) {
        try {
          const { resolveForgeJwtScope } = await import('@/lib/forge/access-context');
          const scope = await resolveForgeJwtScope(userId);
          token.forgeAccessMode = scope.mode;
          token.allowedCourseIds = scope.allowedCourseIds;
          token.forgeHomePath = scope.homePath;
          token.forgeScopeCheckedAt = Date.now();
        } catch (e) {
          console.error('[next-auth][jwt] forge scope refresh failed', e);
        }
      }

      const wsCheckedAt = typeof token.workspaceScopeCheckedAt === 'number' ? token.workspaceScopeCheckedAt : 0;
      const wsStale = Date.now() - wsCheckedAt > 5 * 60 * 1000;
      if (userId && (user || wsStale || !token.workspaceAccessMode)) {
        try {
          const { resolveWorkspaceJwtScope } = await import('@/lib/workspace-access-scope');
          const ws = await resolveWorkspaceJwtScope(userId);
          token.workspaceAccessMode = ws.mode;
          token.allowedSystems = ws.allowedSystems;
          token.workspaceHomePath = ws.homePath;
          token.workspaceScopeCheckedAt = Date.now();
          token.platformAdmin = ws.mode === 'full';
        } catch (e) {
          console.error('[next-auth][jwt] workspace scope refresh failed', e);
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).locale = token.locale;
        (session.user as any).forgeAccessMode = token.forgeAccessMode;
        (session.user as any).allowedCourseIds = token.allowedCourseIds ?? [];
        (session.user as any).forgeHomePath = token.forgeHomePath;
        (session.user as any).workspaceAccessMode = token.workspaceAccessMode;
        (session.user as any).allowedSystems = token.allowedSystems ?? [];
        (session.user as any).workspaceHomePath = token.workspaceHomePath;
        (session.user as any).platformAdmin = Boolean(token.platformAdmin);
      }
      return session;
    },
    async signIn({ user }) {
      const { isPrecommercialMode, isPlatformAdminEmail } = await import('@/lib/platform-access');
      if (!isPrecommercialMode()) return true;
      const email = user?.email?.trim().toLowerCase();
      if (!email) return false;
      if (isPlatformAdminEmail(email)) return true;
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });
      if (existing?.role === 'ADMIN') return true;
      // Contas novas (ex.: Google) sem convite prévio → bloquear
      if (!existing) return false;
      return true;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    state: {
      name: 'next-auth.state',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    pkceCodeVerifier: {
      name: 'next-auth.pkce.code_verifier',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
};
