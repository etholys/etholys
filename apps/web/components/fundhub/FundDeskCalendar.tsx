'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type CalendarFund = {
  id: string;
  name: string;
  institution: string;
  deadline?: string | null;
  pipelineStatus?: string;
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function FundDeskCalendar({
  funds,
  locale,
  onSelect,
}: {
  funds: CalendarFund[];
  locale: string;
  onSelect?: (fundId: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarFund[]>();
    for (const f of funds) {
      if (!f.deadline) continue;
      const d = new Date(f.deadline);
      if (Number.isNaN(d.getTime())) continue;
      const k = dayKey(d);
      const list = map.get(k) ?? [];
      list.push(f);
      map.set(k, list);
    }
    return map;
  }, [funds]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i++) cells.push({ day: null, key: `e${i}` });
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    cells.push({ day: d, key: dayKey(dt) });
  }

  const title = cursor.toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es', {
    month: 'long',
    year: 'numeric',
  });

  const weekdays =
    locale === 'pt'
      ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
      : locale === 'es'
        ? ['D', 'L', 'M', 'X', 'J', 'V', 'S']
        : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
          onClick={() => setCursor(new Date(year, month - 1, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-sm font-semibold capitalize text-gray-900">{title}</h3>
        <button
          type="button"
          className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
          onClick={() => setCursor(new Date(year, month + 1, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-gray-400">
        {weekdays.map((w, i) => (
          <div key={`${w}-${i}`}>{w}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c) => {
          const items = c.day ? byDay.get(c.key) ?? [] : [];
          const isToday = c.key === dayKey(new Date()) && monthKey(cursor) === monthKey(new Date());
          return (
            <div
              key={c.key}
              className={`min-h-[72px] rounded-lg border p-1 ${
                c.day ? 'border-gray-100 bg-gray-50/50' : 'border-transparent'
              } ${isToday ? 'ring-1 ring-amber-400' : ''}`}
            >
              {c.day != null && (
                <>
                  <div className="text-[10px] font-medium text-gray-500">{c.day}</div>
                  <ul className="mt-0.5 space-y-0.5">
                    {items.slice(0, 3).map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => onSelect?.(f.id)}
                          className="w-full truncate rounded bg-amber-100 px-1 py-0.5 text-left text-[10px] font-medium text-amber-950 hover:bg-amber-200"
                          title={`${f.name} · ${f.institution}`}
                        >
                          {f.name}
                        </button>
                      </li>
                    ))}
                    {items.length > 3 && (
                      <li className="text-[9px] text-gray-400">+{items.length - 3}</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
