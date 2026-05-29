import 'server-only';

import { buildForgeInviteUrl } from '@/lib/forge/invite-token';
import type { Locale } from '@/lib/i18n';
import {
  buildForgeInviteEmailHtml,
  buildForgeNudgeEmailHtml,
  parseForgeEmailLocale,
} from '@/lib/forge/email-templates';

export type ForgeEmailResult = { sent: boolean; error?: string };

async function sendForgeHtmlEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<ForgeEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.FORGE_EMAIL_FROM || 'FORGE <onboarding@resend.dev>';

  if (!apiKey) {
    console.info('[forge/email]', { to: opts.to, subject: opts.subject });
    return { sent: false };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('[forge/email] Resend failed:', err);
      return { sent: false, error: err };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}

export type ForgeInviteEmailPayload = {
  to: string;
  courseTitle: string;
  inviteToken: string;
  inviterName?: string | null;
  locale?: Locale;
};

export async function sendForgeInviteEmail(payload: ForgeInviteEmailPayload): Promise<{
  sent: boolean;
  inviteUrl: string;
  error?: string;
}> {
  const inviteUrl = buildForgeInviteUrl(payload.inviteToken);
  const { subject, html } = buildForgeInviteEmailHtml({
    courseTitle: payload.courseTitle,
    inviteUrl,
    inviterName: payload.inviterName,
    toEmail: payload.to,
    locale: parseForgeEmailLocale(payload.locale),
  });

  const result = await sendForgeHtmlEmail({ to: payload.to, subject, html });
  return { ...result, inviteUrl };
}

export async function sendForgeNudgeEmail(opts: {
  to: string;
  userName: string | null;
  courseTitle: string;
  courseUrl: string;
  kind: 'at_risk' | 'inactive';
  progressPercent?: number;
  locale?: Locale;
}): Promise<ForgeEmailResult> {
  const base = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  const link = `${base}${opts.courseUrl}`;
  const loc = parseForgeEmailLocale(opts.locale);
  const { subject, html } = buildForgeNudgeEmailHtml({
    userName: opts.userName,
    courseTitle: opts.courseTitle,
    courseUrl: link,
    kind: opts.kind,
    progressPercent: opts.progressPercent,
    locale: loc,
  });

  return sendForgeHtmlEmail({ to: opts.to, subject, html });
}
