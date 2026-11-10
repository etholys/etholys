'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { X } from 'lucide-react';
import {
  fetchNotifications,
  markNotificationRead,
  resolveNotificationHref,
  type AppNotification,
} from '@/lib/notifications/client';

type Toast = AppNotification & { dismissAt: number };

/**
 * In-app “push-up” banners while the user is online (polls unread since last check).
 * Complements the bell + browser Web Push.
 */
export function NotificationToasts() {
  const { status } = useSession();
  const router = useRouter();
  const sinceRef = useRef<string>(new Date().toISOString());
  const seenRef = useRef<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    // Ensure SW is registered so Web Push can deliver when subscribed.
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {});
    }

    const tick = () => {
      if (document.visibilityState === 'hidden') return;
      const since = sinceRef.current;
      fetchNotifications({ limit: 8, since })
        .then((d) => {
          if (d.serverTime) sinceRef.current = d.serverTime;
          const fresh = (d.notifications || []).filter((n) => !n.read && !seenRef.current.has(n.id));
          if (!fresh.length) return;
          for (const n of fresh) seenRef.current.add(n.id);
          const now = Date.now();
          setToasts((prev) => [
            ...fresh.map((n) => ({ ...n, dismissAt: now + 8_000 })),
            ...prev,
          ].slice(0, 4));
        })
        .catch(() => {});
    };

    const interval = setInterval(tick, 25_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [status]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setInterval(() => {
      const now = Date.now();
      setToasts((prev) => prev.filter((x) => x.dismissAt > now));
    }, 500);
    return () => clearInterval(t);
  }, [toasts.length]);

  if (status !== 'authenticated' || !toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto animate-in slide-in-from-bottom-2 fade-in rounded-xl border border-white/10 bg-[#0C1822]/95 p-3 shadow-2xl backdrop-blur-md"
          role="status"
        >
          <div className="flex items-start gap-2">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                void markNotificationRead(n.id);
                setToasts((prev) => prev.filter((x) => x.id !== n.id));
                const href = resolveNotificationHref(n);
                if (href) router.push(href);
              }}
            >
              <p className="text-sm font-semibold text-white">{n.title}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-white/55">{n.message}</p>
            </button>
            <button
              type="button"
              className="rounded p-0.5 text-white/40 hover:text-white"
              aria-label="Dismiss"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== n.id))}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
