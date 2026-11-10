'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { useApp } from '@/app/providers';
import { cn } from '@/lib/utils';
import {
  ensureWebPushSubscription,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotificationHref,
  type AppNotification,
} from '@/lib/notifications/client';

type Tone = 'dark' | 'light';

function relativeTime(iso: string, locale: string) {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  const tag = locale === 'pt' ? 'pt-BR' : locale === 'en' ? 'en-US' : 'es-ES';
  if (diff < 60) return locale === 'en' ? 'now' : locale === 'pt' ? 'agora' : 'ahora';
  try {
    const rtf = new Intl.RelativeTimeFormat(tag, { numeric: 'auto' });
    if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
    if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
    return rtf.format(-Math.round(diff / 86400), 'day');
  } catch {
    return d.toLocaleString(tag);
  }
}

export function NotificationsBell({
  tone = 'dark',
  className,
  enablePushOnOpen = true,
}: {
  tone?: Tone;
  className?: string;
  /** Ask for browser push permission the first time the panel opens. */
  enablePushOnOpen?: boolean;
}) {
  const { locale } = useApp();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [pushHint, setPushHint] = useState<string | null>(null);
  const loc = locale === 'es' || locale === 'en' || locale === 'pt' ? locale : 'es';

  const copy = {
    title: loc === 'pt' ? 'Notificações' : loc === 'en' ? 'Notifications' : 'Notificaciones',
    empty: loc === 'pt' ? 'Sem novidades' : loc === 'en' ? 'Nothing new' : 'Sin novedades',
    markAll: loc === 'pt' ? 'Marcar tudo lido' : loc === 'en' ? 'Mark all read' : 'Marcar todo leído',
    enablePush:
      loc === 'pt'
        ? 'Ativar alertas no browser'
        : loc === 'en'
          ? 'Enable browser alerts'
          : 'Activar alertas del navegador',
  };

  const load = useCallback(() => {
    fetchNotifications({ limit: 30 })
      .then((d) => {
        setCount(d.unreadCount ?? 0);
        setItems(d.notifications ?? []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 45_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [load]);

  const onOpen = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      load();
      if (enablePushOnOpen && typeof window !== 'undefined') {
        const asked = sessionStorage.getItem('etholys.pushAsked');
        if (!asked && 'Notification' in window && Notification.permission === 'default') {
          sessionStorage.setItem('etholys.pushAsked', '1');
          const result = await ensureWebPushSubscription().catch(() => 'unavailable' as const);
          if (result === 'subscribed') {
            setPushHint(
              loc === 'pt'
                ? 'Alertas do browser ativados'
                : loc === 'en'
                  ? 'Browser alerts on'
                  : 'Alertas del navegador activados',
            );
          } else if (result === 'unavailable') {
            setPushHint(null);
          }
        }
      }
    }
  };

  const dark = tone === 'dark';

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => void onOpen()}
        className={cn(
          'relative rounded-lg p-2 transition',
          dark
            ? 'text-white/55 hover:bg-white/5 hover:text-white'
            : 'text-[color:var(--sys-muted,#64748b)] hover:bg-[color:var(--sys-nav-hover,rgba(0,0,0,0.04))] hover:text-[color:var(--sys-ink,#0f172a)]',
        )}
        aria-label={copy.title}
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-teal-500 px-1 text-[10px] font-bold text-slate-950">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className={cn(
              'absolute right-0 top-full z-50 mt-1 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border shadow-xl',
              dark
                ? 'border-white/10 bg-[#0C1822] text-white'
                : 'border-[color:var(--sys-line,#e2e8f0)] bg-[color:var(--sys-panel,#fff)] text-[color:var(--sys-ink,#0f172a)]',
            )}
          >
            <div
              className={cn(
                'flex items-center justify-between gap-2 border-b px-3 py-2',
                dark ? 'border-white/10' : 'border-[color:var(--sys-line,#e2e8f0)]',
              )}
            >
              <p className={cn('text-xs font-bold uppercase tracking-wider', dark ? 'text-white/50' : 'text-slate-500')}>
                {copy.title}
              </p>
              {count > 0 && (
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium',
                    dark ? 'text-teal-300/90 hover:text-teal-200' : 'text-teal-700 hover:text-teal-900',
                  )}
                  onClick={() => {
                    void markAllNotificationsRead().then(() => {
                      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
                      setCount(0);
                    });
                  }}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {copy.markAll}
                </button>
              )}
            </div>

            {pushHint && (
              <p className={cn('px-3 py-1.5 text-[11px]', dark ? 'bg-teal-500/10 text-teal-200' : 'bg-teal-50 text-teal-800')}>
                {pushHint}
              </p>
            )}

            <ul className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <li className={cn('px-3 py-6 text-center text-sm', dark ? 'text-white/35' : 'text-slate-400')}>
                  {copy.empty}
                </li>
              ) : (
                items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full px-3 py-2.5 text-left transition',
                        dark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-50',
                        !n.read && (dark ? 'bg-teal-500/[0.07]' : 'bg-teal-50/60'),
                      )}
                      onClick={() => {
                        if (!n.read) {
                          void markNotificationRead(n.id);
                          setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                          setCount((c) => Math.max(0, c - 1));
                        }
                        setOpen(false);
                        const href = resolveNotificationHref(n);
                        if (href) router.push(href);
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm font-semibold leading-snug', dark ? 'text-white' : 'text-slate-800')}>
                          {n.title}
                        </p>
                        <span className={cn('shrink-0 text-[10px]', dark ? 'text-white/35' : 'text-slate-400')}>
                          {relativeTime(n.createdAt, loc)}
                        </span>
                      </div>
                      <p className={cn('mt-0.5 line-clamp-2 text-xs', dark ? 'text-white/50' : 'text-slate-500')}>
                        {n.message}
                      </p>
                    </button>
                  </li>
                ))
              )}
            </ul>

            {typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'default' && (
                <div className={cn('border-t px-3 py-2', dark ? 'border-white/10' : 'border-slate-100')}>
                  <button
                    type="button"
                    className={cn(
                      'w-full rounded-lg px-2 py-1.5 text-xs font-medium',
                      dark ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    )}
                    onClick={() => {
                      void ensureWebPushSubscription().then((r) => {
                        if (r === 'subscribed') {
                          setPushHint(
                            loc === 'pt'
                              ? 'Alertas do browser ativados'
                              : loc === 'en'
                                ? 'Browser alerts on'
                                : 'Alertas del navegador activados',
                          );
                        }
                      });
                    }}
                  >
                    {copy.enablePush}
                  </button>
                </div>
              )}
          </div>
        </>
      )}
    </div>
  );
}
