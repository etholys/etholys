import { randomBytes } from 'crypto';

const INVITE_TTL_DAYS = 30;

export function generateForgeInviteToken(): string {
  return randomBytes(24).toString('base64url');
}

export function forgeInviteExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + INVITE_TTL_DAYS);
  return d;
}

export function buildForgeInviteUrl(token: string, baseUrl?: string): string {
  const root = (baseUrl || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${root}/hub/forge/activar?token=${encodeURIComponent(token)}`;
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const head = local.slice(0, 1);
  return `${head}***@${domain}`;
}
