'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useForgeT } from '@/lib/forge/use-forge-t';

type N = { id: string; title: string; message: string; link?: string | null; read: boolean };

export function ForgeNotificationsBell() {
  const ft = useForgeT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<N[]>([]);

  useEffect(() => {
    const load = () => {
      fetch('/api/notifications?limit=8')
        .then((r) => r.json())
        .then((d) => {
          setCount(d?.unreadCount ?? 0);
          setItems(d?.notifications ?? []);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100"
        aria-label={ft('forge.notifications.title')}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border bg-white shadow-xl">
            <div className="border-b px-3 py-2 text-xs font-bold text-slate-500">
              {ft('forge.notifications.title')}
            </div>
            <ul className="max-h-72 overflow-y-auto">
              {items.length === 0 ? (
                <li className="px-3 py-4 text-sm text-slate-400">{ft('forge.notifications.empty')}</li>
              ) : (
                items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${!n.read ? 'bg-blue-50/50' : ''}`}
                      onClick={() => {
                        if (!n.read) {
                          fetch(`/api/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
                        }
                        setOpen(false);
                        if (n.link) router.push(n.link);
                      }}
                    >
                      <p className="font-semibold text-slate-800">{n.title}</p>
                      <p className="text-xs text-slate-500 line-clamp-2">{n.message}</p>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
