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
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session?.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
        (session.user as any).locale = token.locale;
      }
      return session;
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
