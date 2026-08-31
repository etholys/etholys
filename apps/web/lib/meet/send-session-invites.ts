import 'server-only';

import { sendMeetInviteEmail } from '@/lib/meet/send-meet-email';

export async function sendMeetSessionInvites(opts: {
  session: {
    id: string;
    title: string;
    meetingUrl: string;
    scheduledAt?: Date | null;
    endsAt?: Date | null;
  };
  emails: string[];
  locale?: string;
  hostName?: string | null;
}): Promise<{ email: string; sent: boolean; error?: string }[]> {
  const unique = [...new Set(opts.emails.map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@')))];
  const results: { email: string; sent: boolean; error?: string }[] = [];
  for (const email of unique) {
    const r = await sendMeetInviteEmail({
      to: email,
      title: opts.session.title,
      meetingUrl: opts.session.meetingUrl,
      sessionId: opts.session.id,
      scheduledAt: opts.session.scheduledAt,
      endsAt: opts.session.endsAt,
      hostName: opts.hostName,
      locale: opts.locale,
    });
    results.push({ email, ...r });
  }
  return results;
}
