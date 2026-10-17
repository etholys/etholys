import 'server-only';

import { buildMeetIcs } from '@/lib/meet/ics';
import { sendAuthHtmlEmail } from '@/lib/send-auth-email';

export type BookingLocale = 'pt' | 'es' | 'en';

export function bookingLocale(value: string | null | undefined): BookingLocale {
  if (value === 'pt' || value === 'en') return value;
  return 'es';
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fromAddress(): string {
  return (
    process.env.MEET_EMAIL_FROM ||
    process.env.AUTH_EMAIL_FROM ||
    process.env.FORGE_EMAIL_FROM ||
    'Etholys <onboarding@resend.dev>'
  );
}

export function bookingWhen(date: Date, locale: BookingLocale, timeZone: string): string {
  const intl = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
  return date.toLocaleString(intl, {
    timeZone: timeZone || 'UTC',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

export async function sendChorusBookingEmail(opts: {
  to: string;
  subject: string;
  html: string;
  ics?: { uid: string; title: string; description?: string; location?: string; startsAt: Date; endsAt: Date } | null;
}): Promise<{ sent: boolean }> {
  const to = opts.to.trim().toLowerCase();
  if (!to.includes('@')) return { sent: false };

  let html = opts.html;
  if (opts.ics) {
    const icsBody = buildMeetIcs({
      uid: opts.ics.uid,
      title: opts.ics.title,
      description: opts.ics.description,
      locationUrl: opts.ics.location,
      startsAt: opts.ics.startsAt,
      endsAt: opts.ics.endsAt,
    }).replace('PRODID:-//Etholys//Meet//EN', 'PRODID:-//Etholys//CHORUS//EN');
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.info('[chorus/agenda-email]', { to, subject: opts.subject });
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
          from: fromAddress(),
          to: [to],
          subject: opts.subject,
          html,
          attachments: [
            {
              filename: 'chorus-agenda.ics',
              content: Buffer.from(icsBody, 'utf8').toString('base64'),
            },
          ],
        }),
      });
      if (!res.ok) {
        console.warn('[chorus/agenda-email] retry without ics', (await res.text()).slice(0, 200));
        return sendAuthHtmlEmail({ to, subject: opts.subject, html });
      }
      return { sent: true };
    } catch (error) {
      console.warn('[chorus/agenda-email]', error);
      return { sent: false };
    }
  }

  const result = await sendAuthHtmlEmail({ to, subject: opts.subject, html });
  return { sent: result.sent };
}

export function bookingEmailHtml(opts: {
  locale: BookingLocale;
  intro: string;
  title: string;
  when?: string | null;
  lines?: string[];
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): string {
  const extra = (opts.lines || [])
    .filter(Boolean)
    .map((line) => `<p>${htmlEscape(line)}</p>`)
    .join('');
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<p><a href="${htmlEscape(opts.ctaUrl)}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">${htmlEscape(opts.ctaLabel)}</a></p>`
      : '';
  return `<!DOCTYPE html><html lang="${opts.locale}"><body style="font-family:sans-serif;line-height:1.5;color:#111">
<p>${htmlEscape(opts.intro)}</p>
<p><strong>${htmlEscape(opts.title)}</strong></p>
${opts.when ? `<p>${htmlEscape(opts.when)}</p>` : ''}
${extra}
${cta}
<p style="font-size:12px;color:#999">CHORUS · Etholys</p>
</body></html>`;
}
