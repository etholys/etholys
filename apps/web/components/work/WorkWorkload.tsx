'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

type Task = {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  assignee?: { id?: string; name?: string | null } | null;
  estimatedHours?: number | null;
  parentId?: string | null;
};

const OPEN = new Set(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW']);

type PersonRow = {
  key: string;
  name: string;
  open: number;
  overdue: number;
  hours: number;
  taskIds: string[];
};

export function WorkWorkload({
  tasks,
  onSelectPerson,
  onOpenTask,
  t,
}: {
  tasks: Task[];
  onSelectPerson?: (assigneeId: string | null) => void;
  onOpenTask: (id: string) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const now = Date.now();

  const rows = useMemo(() => {
    const map = new Map<string, PersonRow>();
    const ensure = (key: string, name: string) => {
      let row = map.get(key);
      if (!row) {
        row = { key, name, open: 0, overdue: 0, hours: 0, taskIds: [] };
        map.set(key, row);
      }
      return row;
    };

    for (const task of tasks) {
      if (task.parentId || !OPEN.has(task.status)) continue;
      const key = task.assigneeId || task.assignee?.id || '__unassigned__';
      const name =
        key === '__unassigned__'
          ? t('Unassigned', 'Sin asignar', 'Sem responsável')
          : task.assignee?.name || t('Unknown', 'Desconocido', 'Desconhecido');
      const row = ensure(key, name);
      row.open += 1;
      row.taskIds.push(task.id);
      if (task.dueDate && new Date(task.dueDate).getTime() < now) row.overdue += 1;
      if (typeof task.estimatedHours === 'number' && !Number.isNaN(task.estimatedHours)) {
        row.hours += task.estimatedHours;
      }
    }

    return [...map.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  }, [tasks, now, t]);

  const maxOpen = Math.max(1, ...rows.map((r) => r.open));

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center text-sm text-slate-400">
        {t('No open workload to show', 'Sin carga abierta', 'Sem carga aberta')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{t('Workload', 'Carga', 'Carga')}</h3>
        <p className="text-[11px] text-slate-400">
          {t('Open tasks by assignee', 'Tareas abiertas por persona', 'Tarefas abertas por pessoa')}
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.key} className="px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  onSelectPerson?.(row.key === '__unassigned__' ? null : row.key)
                }
                className="text-sm font-semibold text-slate-800 hover:text-cyan-800"
              >
                {row.name}
              </button>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>
                  <span className="font-semibold tabular-nums text-slate-800">{row.open}</span>{' '}
                  {t('open', 'abiertas', 'abertas')}
                </span>
                {row.overdue > 0 && (
                  <span className="font-semibold text-rose-600">
                    {row.overdue} {t('overdue', 'atrasadas', 'atrasadas')}
                  </span>
                )}
                {row.hours > 0 && (
                  <span className="tabular-nums">
                    {row.hours.toFixed(1)}h
                  </span>
                )}
              </div>
            </div>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  row.overdue > 0 ? 'bg-rose-500' : 'bg-cyan-600',
                )}
                style={{ width: `${Math.round((row.open / maxOpen) * 100)}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {row.taskIds.slice(0, 5).map((id) => {
                const task = tasks.find((x) => x.id === id);
                if (!task) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onOpenTask(id)}
                    className="max-w-[160px] truncate rounded-md bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600 hover:bg-cyan-50 hover:text-cyan-800"
                  >
                    {task.title}
                  </button>
                );
              })}
              {row.taskIds.length > 5 && (
                <span className="px-1 text-[10px] text-slate-400">+{row.taskIds.length - 5}</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
