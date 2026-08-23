'use client';

import { useMemo, useState } from 'react';
import { cn, formatDate } from '@/lib/utils';
import { PRIORITY_STYLE, STATUS_STYLE } from './work-ui';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  assignee?: { name?: string | null } | null;
  parentId?: string | null;
};

const OPEN = new Set(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW']);

export function WorkList({
  tasks,
  onSelect,
  t,
}: {
  tasks: Task[];
  onSelect: (id: string) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [hideDone, setHideDone] = useState(true);

  const rows = useMemo(() => {
    const list = tasks.filter((task) => !task.parentId);
    const filtered = hideDone ? list.filter((task) => OPEN.has(task.status)) : list;
    return [...filtered].sort((a, b) => {
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      return a.title.localeCompare(b.title);
    });
  }, [tasks, hideDone]);

  const now = Date.now();

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center text-sm text-slate-400">
        {t('No tasks in this list', 'Sin tareas en esta lista', 'Sem tarefas nesta lista')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{t('List', 'Lista', 'Lista')}</h3>
          <p className="text-[11px] text-slate-400">
            {rows.length} {t('tasks', 'tareas', 'tarefas')}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
            className="rounded border-slate-300"
          />
          {t('Hide done', 'Ocultar hechas', 'Ocultar concluídas')}
        </label>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((task) => {
          const st = STATUS_STYLE[task.status] || STATUS_STYLE.TODO;
          const pr = PRIORITY_STYLE[task.priority] || PRIORITY_STYLE.MEDIUM;
          const overdue =
            task.dueDate && OPEN.has(task.status) && new Date(task.dueDate).getTime() < now;
          return (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onSelect(task.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', st.dot)} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {task.title}
                </span>
                <span className={cn('hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline', pr.bg, pr.text)}>
                  {task.priority}
                </span>
                <span className={cn('hidden rounded-md px-1.5 py-0.5 text-[10px] font-medium md:inline', st.bg, st.text)}>
                  {task.status.replace('_', ' ')}
                </span>
                <span className="hidden w-24 truncate text-xs text-slate-500 sm:block">
                  {task.assignee?.name || '—'}
                </span>
                <span
                  className={cn(
                    'w-20 shrink-0 text-right text-xs tabular-nums',
                    overdue ? 'font-semibold text-rose-600' : 'text-slate-500',
                  )}
                >
                  {task.dueDate ? formatDate(task.dueDate) : '—'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
