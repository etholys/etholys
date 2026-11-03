import { prisma } from '@/lib/prisma';

export type WebPushPayload = {
  title: string;
  body: string;
  url?: string | null;
  tag?: string;
};

function vapidConfigured() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:ops@etholys.com';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function getVapidPublicKey(): string | null {
  return vapidConfigured()?.publicKey || null;
}

/** Send browser Web Push to all stored subscriptions for a user. No-op if VAPID unset. */
export async function sendWebPushToUser(userId: string, payload: WebPushPayload) {
  const vapid = vapidConfigured();
  if (!vapid) return { sent: 0, skipped: 'vapid_unset' as const };

  let webpush: typeof import('web-push');
  try {
    webpush = await import('web-push');
  } catch (e) {
    console.warn('[web-push] package unavailable', e);
    return { sent: 0, skipped: 'package' as const };
  }

  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (!subs.length) return { sent: 0, skipped: 'no_subs' as const };

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/hub',
    tag: payload.tag || 'etholys',
  });

  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
        { TTL: 60 * 60 * 12 },
      );
      sent += 1;
    } catch (err: unknown) {
      const status = (err as { statusCode?: number })?.statusCode;
      // Gone / invalid subscription — drop it
      if (status === 404 || status === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      } else {
        console.warn('[web-push] send failed', status || err);
      }
    }
  }
  return { sent, skipped: null };
}
