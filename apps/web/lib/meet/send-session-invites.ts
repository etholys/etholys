import 'server-only';

import { sendMeetInviteEmail } from '@/lib/meet/send-meet-email';
import { meetPublicJoinUrl } from '@/lib/meet/types';

export async function sendMeetSessionInvites(opts: {
  session: {
    id: string;
    title: string;
    /** URL da sala de vídeo (legado); o convite usa sempre o Hub CHORUS. */
    meetingUrl?: string | null;
    scheduledAt?: Date | null;
    endsAt?: Date | null;
  };
  companyId: string;
  emails: string[];
  locale?: string;
  hostName?: string | null;
  timeZone?: string;
}): Promise<{ email: string; sent: boolean; error?: string }[]> {
  const joinUrl = meetPublicJoinUrl(opts.session.id, opts.companyId);
  const unique = [
    ...new Set(opts.emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))),
  ];
  const results: { email: string; sent: boolean; error?: string }[] = [];
  for (const email of unique) {
    const r = await sendMeetInviteEmail({
      to: email,
      title: opts.session.title,
      meetingUrl: joinUrl,
      sessionId: opts.session.id,
      scheduledAt: opts.session.scheduledAt,
      endsAt: opts.session.endsAt,
      hostName: opts.hostName,
      locale: opts.locale,
      timeZone: opts.timeZone,
    });
    results.push({ email, ...r });
  }
  return results;
}
