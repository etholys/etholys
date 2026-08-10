import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { findEnrollmentByMagicToken } from '@/lib/forge/invite-auth';

const googleCalendarEnabled = process.env.GOOGLE_CALENDAR_ENABLED === '1';
const azureClientId =
  process.env.AZURE_AD_CLIENT_ID?.trim() || process.env.AZURE_AD_CLIENTID?.trim() || '';
const azureClientSecret =
  process.env.AZURE_AD_CLIENT_SECRET?.trim() || process.env.AZURE_AD_CLIENTSECRET?.trim() || '';
const azureTenant =
  process.env.AZURE_AD_TENANT_ID?.trim() || process.env.AZURE_AD_TENANTID?.trim() || 'common';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      allowDangerousEmailAccountLinking: true,
      ...(googleCalendarEnabled
        ? {
            authorization: {
              params: {
                scope:
                  'openid email profile https://www.googleapis.com/auth/calendar.events',
                access_type: 'offline',
                prompt: 'consent',
              },
            },
          }
        : {}),
    }),
    ...(azureClientId && azureClientSecret
      ? [
          AzureADProvider({
            clientId: azureClientId,
            clientSecret: azureClientSecret,
            tenantId: azureTenant,
            authorization: {
              params: {
                scope: 'openid email profile offline_access Calendars.ReadWrite',
              },
            },
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
          forgeMagicToken: { label: 'Forge Magic', type: 'text' },
          studioMagicToken: { label: 'Studio Magic', type: 'text' },
        },
        async authorize(credentials) {
        try {
          const studioMagic = (credentials as { studioMagicToken?: string })?.studioMagicToken?.trim();
          if (studioMagic) {
            const { findShareByMagicToken } = await import('@/lib/studio/share');
            const share = await findShareByMagicToken(studioMagic);
            const user = share?.user;
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
        // Forçar reavaliação do system admin no login (Google / credentials)
        token.workspaceScopeCheckedAt = 0;
        if (typeof user.email === 'string') token.email = user.email;
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
          // System admin Etholys (allowlist) — NÃO confundir com Hub full via admin de empresa
          token.platformAdmin = Boolean(ws.isSystemAdmin);
        } catch (e) {
          console.error('[next-auth][jwt] workspace scope refresh failed', e);
        }
      }

      const stCheckedAt = typeof token.studioScopeCheckedAt === 'number' ? token.studioScopeCheckedAt : 0;
      const stStale = Date.now() - stCheckedAt > 5 * 60 * 1000;
      if (userId && (user || stStale || !token.studioAccessMode)) {
        try {
          const { resolveStudioJwtScope } = await import('@/lib/studio/share');
          const st = await resolveStudioJwtScope(userId);
          token.studioAccessMode = st.mode;
          token.studioTargets = st.targets;
          token.studioHomePath = st.homePath;
          token.studioScopeCheckedAt = Date.now();
        } catch (e) {
          console.error('[next-auth][jwt] studio scope refresh failed', e);
        }
      }

      const siepCheckedAt = typeof token.siepScopeCheckedAt === 'number' ? token.siepScopeCheckedAt : 0;
      const siepStale = Date.now() - siepCheckedAt > 5 * 60 * 1000;
      if (userId && (user || siepStale || !token.siepAccessMode)) {
        try {
          const { resolveSiepJwtScope } = await import('@/lib/siep/permissions');
          const siep = await resolveSiepJwtScope(userId);
          token.siepAccessMode = siep.mode;
          token.allowedProjectIds = siep.allowedProjectIds;
          token.siepHomePath = siep.homePath;
          token.siepScopeCheckedAt = Date.now();
        } catch (e) {
          console.error('[next-auth][jwt] siep scope refresh failed', e);
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
        (session.user as any).studioAccessMode = token.studioAccessMode;
        (session.user as any).studioTargets = token.studioTargets ?? [];
        (session.user as any).studioHomePath = token.studioHomePath;
        (session.user as any).siepAccessMode = token.siepAccessMode;
        (session.user as any).allowedProjectIds = token.allowedProjectIds ?? [];
        (session.user as any).siepHomePath = token.siepHomePath;
      }
      return session;
    },
    async signIn({ user }) {
      const { isPrecommercialMode, isSystemAdmin } = await import('@/lib/platform-access');
      if (!isPrecommercialMode()) return true;
      const email = user?.email?.trim().toLowerCase();
      if (!email) {
        console.warn('[next-auth][signIn] blocked: no email');
        return false;
      }
      // System admin Etholys — sempre permitido (mesmo conta Google nova)
      if (isSystemAdmin(email)) return true;

      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });
      // Contas novas sem allowlist / convite → bloquear em pré-comercial
      if (!existing) {
        console.warn('[next-auth][signIn] blocked (precommercial, unknown email):', email);
        return false;
      }
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
