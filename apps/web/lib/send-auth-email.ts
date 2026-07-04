import 'server-only';

import { randomBytes } from 'crypto';

export type AuthEmailResult = { sent: boolean; error?: string };

export async function sendAuthHtmlEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<AuthEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from =
    process.env.AUTH_EMAIL_FROM ||
    process.env.FORGE_EMAIL_FROM ||
    'Etholys <onboarding@resend.dev>';

  if (!apiKey) {
    console.info('[auth/email]', { to: opts.to, subject: opts.subject });
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
      console.warn('[auth/email] Resend failed:', err);
      return { sent: false, error: err };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}

export function buildPasswordResetUrl(token: string): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://app.etholys.com';
  return `${base.replace(/\/$/, '')}/login/reset?token=${encodeURIComponent(token)}`;
}

export function newPasswordResetToken(): string {
  return randomBytes(32).toString('base64url');
}

export function buildPasswordResetEmailHtml(opts: {
  name?: string | null;
  resetUrl: string;
  locale?: string;
}): string {
  const loc = opts.locale === 'pt' ? 'pt' : opts.locale === 'en' ? 'en' : 'es';
  const greeting =
    loc === 'pt'
      ? `Olá${opts.name ? ` ${opts.name}` : ''},`
      : loc === 'en'
        ? `Hello${opts.name ? ` ${opts.name}` : ''},`
        : `Hola${opts.name ? ` ${opts.name}` : ''},`;
  const body =
    loc === 'pt'
      ? 'Recebemos um pedido para redefinir a sua senha no Etholys. O link expira em 1 hora.'
      : loc === 'en'
        ? 'We received a request to reset your Etholys password. This link expires in 1 hour.'
        : 'Recibimos una solicitud para restablecer tu contraseña en Etholys. El enlace expira en 1 hora.';
  const cta = loc === 'pt' ? 'Redefinir senha' : loc === 'en' ? 'Reset password' : 'Restablecer contraseña';
  const ignore =
    loc === 'pt'
      ? 'Se não foi você, ignore este email.'
      : loc === 'en'
        ? 'If you did not request this, ignore this email.'
        : 'Si no fuiste tú, ignora este correo.';

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.5;color:#111">
<p>${greeting}</p>
<p>${body}</p>
<p><a href="${opts.resetUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">${cta}</a></p>
<p style="font-size:12px;color:#666;word-break:break-all">${opts.resetUrl}</p>
<p style="font-size:12px;color:#666">${ignore}</p>
<p style="font-size:12px;color:#999">— Etholys</p>
</body></html>`;
}
