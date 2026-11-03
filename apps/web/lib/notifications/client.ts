/** Client helpers for Hub notification center + Web Push. */

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
  type?: string;
  taskId?: string | null;
};

export function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export async function fetchNotifications(opts?: { limit?: number; since?: string; unread?: boolean }) {
  const q = new URLSearchParams();
  if (opts?.limit) q.set('limit', String(opts.limit));
  if (opts?.since) q.set('since', opts.since);
  if (opts?.unread) q.set('unread', 'true');
  const r = await fetch(`/api/notifications?${q}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('notifications_failed');
  return r.json() as Promise<{
    notifications: AppNotification[];
    unreadCount: number;
    serverTime?: string;
  }>;
}

export async function markNotificationRead(id: string) {
  await fetch('/api/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
}

export async function markAllNotificationsRead() {
  await fetch('/api/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markAllRead: true }),
  });
}

/** Register SW (reuse offline shell) and subscribe to Web Push when VAPID is configured. */
export async function ensureWebPushSubscription(): Promise<'subscribed' | 'denied' | 'unavailable' | 'skipped'> {
  if (typeof window === 'undefined') return 'skipped';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unavailable';
  }

  const keyRes = await fetch('/api/push/vapid-public-key', { cache: 'no-store' }).catch(() => null);
  if (!keyRes?.ok) return 'unavailable';
  const keyJson = (await keyRes.json()) as { enabled?: boolean; publicKey?: string | null };
  if (!keyJson.enabled || !keyJson.publicKey) return 'unavailable';

  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'default') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return 'denied';
  }

  const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyJson.publicKey),
    });
  }

  const json = sub.toJSON();
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: json.keys,
    }),
  });

  return 'subscribed';
}
