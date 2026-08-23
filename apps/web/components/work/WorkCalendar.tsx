'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUS_STYLE } from './work-ui';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  assignee?: { name?: string | null } | null;
  parentId?: string | null;
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function WorkCalendar({
  tasks,
  onSelect,
  t,
}: {
  tasks: Task[];
  onSelect: (id: string) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const today = useMemo(() => {
    const n = new Date();
    n.setHours(0, 0, 0, 0);
    return n;
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.parentId || !task.dueDate) continue;
      const d = new Date(task.dueDate);
      const key = dayKey(d);
      const list = map.get(key) || [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const startPad = (first.getDay() + 6) % 7; // Monday-first
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startPad);
    const out: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      out.push(d);
    }
    return out;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weekdays = [1, 2, 3, 4, 5, 6, 0].map((dow) => {
    const d = new Date(2024, 0, 1 + dow); // Mon..Sun sample week
    return d.toLocaleDateString(undefined, { weekday: 'short' });
  });

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold capitalize text-slate-800">{monthLabel}</h3>
          <p className="text-[11px] text-slate-400">
            {t('Tasks by due date', 'Tareas por fecha límite', 'Tarefas por prazo')}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, -1))}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
          >
            {t('Today', 'Hoy', 'Hoje')}
          </button>
          <button
            type="button"
            onClick={() => setCursor((c) => addMonths(c, 1))}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
        {weekdays.map((label) => (
          <div key={label} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const inMonth = day.getMonth() === cursor.getMonth();
          const key = dayKey(day);
          const dayTasks = byDay.get(key) || [];
          const isToday = sameDay(day, today);
          return (
            <div
              key={key}
              className={cn(
                'min-h-[88px] border-b border-r border-slate-100 p-1.5 sm:min-h-[104px]',
                !inMonth && 'bg-slate-50/50',
              )}
            >
              <div
                className={cn(
                  'mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs tabular-nums',
                  isToday ? 'bg-cyan-600 font-semibold text-white' : inMonth ? 'text-slate-700' : 'text-slate-300',
                )}
              >
                {day.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayTasks.slice(0, 3).map((task) => {
                  const st = STATUS_STYLE[task.status] || STATUS_STYLE.TODO;
                  return (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => onSelect(task.id)}
                      className={cn(
                        'block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium leading-tight',
                        st.bg,
                        st.text,
                      )}
                      title={task.title}
                    >
                      {task.title}
                    </button>
                  );
                })}
                {dayTasks.length > 3 && (
                  <p className="px-1 text-[10px] text-slate-400">+{dayTasks.length - 3}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
