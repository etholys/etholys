'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { PRIORITY_STYLE, STATUS_STYLE } from './work-ui';
import { WorkBulkBar } from './WorkBulkBar';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  assignee?: { name?: string | null } | null;
  parentId?: string | null;
  _count?: { subtasks?: number; comments?: number };
};

type UserOpt = { id: string; name: string | null; email?: string };

const OPEN = new Set(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW']);

export function WorkList({
  tasks,
  users = [],
  onSelect,
  onToggleDone,
  onBulk,
  t,
}: {
  tasks: Task[];
  users?: UserOpt[];
  onSelect: (id: string) => void;
  onToggleDone?: (id: string, nextStatus: string) => Promise<void>;
  onBulk?: (ids: string[], patch: Record<string, unknown>) => Promise<void>;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [hideDone, setHideDone] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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
  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runBulk = async (patch: Record<string, unknown>) => {
    if (!onBulk || selected.size === 0) return;
    setBulkBusy(true);
    try {
      await onBulk([...selected], patch);
      setSelected(new Set());
    } finally {
      setBulkBusy(false);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-white to-slate-50/80 px-6 py-16 text-center">
        <p className="text-sm font-medium text-slate-500">
          {t('No tasks in this list', 'Sin tareas en esta lista', 'Sem tarefas nesta lista')}
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {t('Use quick add above to create one', 'Usa el campo de arriba para crear', 'Usa a criação rápida acima')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {onBulk && (
        <WorkBulkBar
          count={selected.size}
          users={users}
          busy={bulkBusy}
          onClear={() => setSelected(new Set())}
          onSelectAll={() => setSelected(new Set(rows.map((r) => r.id)))}
          onBulk={runBulk}
          t={t}
        />
      )}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-3">
            {onBulk && (
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() =>
                  setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id)))
                }
                className="h-4 w-4 rounded border-slate-300 text-cyan-600"
              />
            )}
            <div>
              <h3 className="text-sm font-semibold text-slate-800">{t('List', 'Lista', 'Lista')}</h3>
              <p className="text-[11px] text-slate-400">
                {rows.length} {t('tasks', 'tareas', 'tarefas')}
              </p>
            </div>
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
            const done = task.status === 'DONE';
            const isSel = selected.has(task.id);
            return (
              <li
                key={task.id}
                className={cn(
                  'group flex items-center gap-1 pr-2 hover:bg-slate-50/80',
                  isSel && 'bg-cyan-50/60',
                )}
              >
                {onBulk && (
                  <input
                    type="checkbox"
                    checked={isSel}
                    onChange={() => toggle(task.id)}
                    className="ml-3 h-4 w-4 shrink-0 rounded border-slate-300 text-cyan-600"
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                {onToggleDone && (
                  <button
                    type="button"
                    disabled={busyId === task.id}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setBusyId(task.id);
                      try {
                        await onToggleDone(task.id, done ? 'TODO' : 'DONE');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                    className={cn(
                      'ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition',
                      done
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-slate-300 text-transparent hover:border-cyan-500 hover:text-cyan-600',
                    )}
                    title={done ? t('Reopen', 'Reabrir', 'Reabrir') : t('Mark done', 'Marcar hecha', 'Marcar concluída')}
                  >
                    <Check className="h-3 w-3" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelect(task.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                >
                  {!onToggleDone && !onBulk && (
                    <span className={cn('h-2 w-2 shrink-0 rounded-full', st.dot)} />
                  )}
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-sm font-medium',
                      done ? 'text-slate-400 line-through' : 'text-slate-800',
                    )}
                  >
                    {task.title}
                    {(task._count?.subtasks || 0) > 0 && (
                      <span className="ml-2 text-[10px] font-normal text-slate-400">
                        {task._count?.subtasks} sub
                      </span>
                    )}
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
    </div>
  );
}
