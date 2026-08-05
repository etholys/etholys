import 'server-only';

import { buildMeetIcs } from '@/lib/meet/ics';
import { sendAuthHtmlEmail } from '@/lib/send-auth-email';

export type MeetInviteEmailResult = { sent: boolean; error?: string };

function meetEmailFrom(): string {
  return (
    process.env.MEET_EMAIL_FROM ||
    process.env.AUTH_EMAIL_FROM ||
    process.env.FORGE_EMAIL_FROM ||
    'Etholys Meet <onboarding@resend.dev>'
  );
}

function htmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function compactUtc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildMeetInviteEmailHtml(opts: {
  title: string;
  meetingUrl: string;
  scheduledAt?: Date | null;
  endsAt?: Date | null;
  hostName?: string | null;
  locale?: string;
}): { subject: string; html: string } {
  const loc = opts.locale === 'pt' ? 'pt' : opts.locale === 'en' ? 'en' : 'es';
  const subject =
    loc === 'pt'
      ? `Convite: ${opts.title}`
      : loc === 'en'
        ? `Invite: ${opts.title}`
        : `Invitación: ${opts.title}`;

  const when =
    opts.scheduledAt != null
      ? opts.scheduledAt.toLocaleString(loc === 'pt' ? 'pt-BR' : loc === 'en' ? 'en-US' : 'es-ES')
      : null;

  const intro =
    loc === 'pt'
      ? `${opts.hostName ? `${opts.hostName} convidou` : 'Foi convidado'} para uma reunião Etholys Meet.`
      : loc === 'en'
        ? `${opts.hostName ? `${opts.hostName} invited you` : 'You are invited'} to an Etholys Meet session.`
        : `${opts.hostName ? `${opts.hostName} te invitó` : 'Estás invitado'} a una reunión Etholys Meet.`;

  const cta = loc === 'pt' ? 'Entrar na sala' : loc === 'en' ? 'Join room' : 'Entrar a la sala';
  const cal =
    loc === 'pt'
      ? 'Anexo: ficheiro de calendário (.ics) para Google/Outlook.'
      : loc === 'en'
        ? 'Attachment: calendar file (.ics) for Google/Outlook.'
        : 'Adjunto: archivo de calendario (.ics) para Google/Outlook.';
  const starts = opts.scheduledAt ?? new Date();
  const ends = opts.endsAt ?? new Date(starts.getTime() + 60 * 60 * 1000);
  const googleCalendar = new URL('https://calendar.google.com/calendar/render');
  googleCalendar.searchParams.set('action', 'TEMPLATE');
  googleCalendar.searchParams.set('text', opts.title);
  googleCalendar.searchParams.set('dates', `${compactUtc(starts)}/${compactUtc(ends)}`);
  googleCalendar.searchParams.set('details', opts.meetingUrl);
  googleCalendar.searchParams.set('location', opts.meetingUrl);
  const outlookCalendar = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  outlookCalendar.searchParams.set('subject', opts.title);
  outlookCalendar.searchParams.set('startdt', starts.toISOString());
  outlookCalendar.searchParams.set('enddt', ends.toISOString());
  outlookCalendar.searchParams.set('body', opts.meetingUrl);
  outlookCalendar.searchParams.set('location', opts.meetingUrl);
  const addLabel =
    loc === 'pt' ? 'Adicionar ao calendário' : loc === 'en' ? 'Add to calendar' : 'Añadir al calendario';

  const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;line-height:1.5;color:#111">
<p>${intro}</p>
<p><strong>${htmlEscape(opts.title)}</strong></p>
${when ? `<p>${when}</p>` : ''}
<p><a href="${htmlEscape(opts.meetingUrl)}" style="display:inline-block;background:#0284c7;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">${cta}</a></p>
<p style="font-size:14px"><strong>${addLabel}:</strong>
  <a href="${htmlEscape(googleCalendar.toString())}">Google Calendar</a>
  &nbsp;·&nbsp;
  <a href="${htmlEscape(outlookCalendar.toString())}">Outlook</a>
</p>
<p style="font-size:12px;color:#666;word-break:break-all">${htmlEscape(opts.meetingUrl)}</p>
<p style="font-size:12px;color:#666">${cal}</p>
<p style="font-size:12px;color:#999">— Etholys Meet</p>
</body></html>`;

  return { subject, html };
}

/** Envia convite via Resend (com .ics em anexo se API key existir). */
export async function sendMeetInviteEmail(opts: {
  to: string;
  title: string;
  meetingUrl: string;
  sessionId: string;
  scheduledAt?: Date | null;
  endsAt?: Date | null;
  hostName?: string | null;
  locale?: string;
}): Promise<MeetInviteEmailResult> {
  const { subject, html } = buildMeetInviteEmailHtml(opts);
  const apiKey = process.env.RESEND_API_KEY;

  const starts = opts.scheduledAt ?? new Date();
  const ends =
    opts.endsAt ?? new Date(starts.getTime() + 60 * 60 * 1000);
  const ics = buildMeetIcs({
    uid: `${opts.sessionId}@etholys.meet`,
    title: opts.title,
    description: opts.meetingUrl,
    locationUrl: opts.meetingUrl,
    startsAt: starts,
    endsAt: ends,
  });

  if (!apiKey) {
    console.info('[meet/email]', { to: opts.to, subject, meetingUrl: opts.meetingUrl });
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
        from: meetEmailFrom(),
        to: [opts.to],
        subject,
        html,
        attachments: [
          {
            filename: 'etholys-meet.ics',
            content: Buffer.from(ics, 'utf8').toString('base64'),
          },
        ],
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      // Fallback sem anexo se o provedor rejeitar
      console.warn('[meet/email] Resend failed, retry without ICS:', err);
      return sendAuthHtmlEmail({ to: opts.to, subject, html });
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}
