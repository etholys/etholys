'use client';

import { useMemo } from 'react';
import { cn, formatDate } from '@/lib/utils';
import { STATUS_STYLE, workStatusLabel } from './work-ui';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
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
  tasks: Task[];
};

export function WorkWorkload({
  tasks,
  onSelectPerson,
  onOpenTask,
  onReassign,
  t,
}: {
  tasks: Task[];
  onSelectPerson?: (assigneeId: string | null) => void;
  onOpenTask: (id: string) => void;
  onReassign?: (taskId: string, assigneeId: string | null) => Promise<void>;
  t: (en: string, es: string, pt: string) => string;
}) {
  const now = Date.now();

  const rows = useMemo(() => {
    const map = new Map<string, PersonRow>();
    const ensure = (key: string, name: string) => {
      let row = map.get(key);
      if (!row) {
        row = { key, name, open: 0, overdue: 0, hours: 0, tasks: [] };
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
      row.tasks.push(task);
      if (task.dueDate && new Date(task.dueDate).getTime() < now) row.overdue += 1;
      if (typeof task.estimatedHours === 'number' && !Number.isNaN(task.estimatedHours)) {
        row.hours += task.estimatedHours;
      }
    }

    for (const row of map.values()) {
      row.tasks.sort((a, b) => {
        const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
        const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
        return ad - bd || a.title.localeCompare(b.title);
      });
    }

    return [...map.values()].sort((a, b) => b.open - a.open || a.name.localeCompare(b.name));
  }, [tasks, now, t]);

  const maxOpen = Math.max(1, ...rows.map((r) => r.open));

  if (rows.length === 0) {
    return (
      <div className="px-6 py-16 text-center text-sm text-slate-500">
        <p>{t('No open work in this view', 'No hay trabajo abierto en esta vista', 'Não há trabalho aberto nesta vista')}</p>
        <p className="mt-1 text-xs text-slate-400">
          {t('Switch to the board to add a task', 'Pasa al tablero para crear una tarea', 'Passa ao quadro para criar uma tarefa')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">{t('Workload', 'Carga', 'Carga')}</h3>
        <p className="text-xs text-slate-500">
          {t(
            'Capacity reading. Open a person to filter the board.',
            'Lectura de capacidad. Abre una persona para filtrar el tablero.',
            'Leitura de capacidade. Abre uma pessoa para filtrar o quadro.',
          )}
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li
            key={row.key}
            className="px-4 py-3"
            onDragOver={(e) => {
              if (!onReassign) return;
              e.preventDefault();
            }}
            onDrop={(e) => {
              const id = e.dataTransfer.getData('text/plain');
              if (!id || !onReassign) return;
              e.preventDefault();
              void onReassign(id, row.key === '__unassigned__' ? null : row.key);
            }}
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => onSelectPerson?.(row.key === '__unassigned__' ? null : row.key)}
                className="text-sm font-semibold text-slate-900 hover:text-teal-800"
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
                {row.hours > 0 && <span className="tabular-nums">{row.hours.toFixed(1)}h</span>}
              </div>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={cn('h-full rounded-full', row.overdue > 0 ? 'bg-rose-500' : 'bg-teal-600')}
                style={{ width: `${Math.round((row.open / maxOpen) * 100)}%` }}
              />
            </div>
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
              {row.tasks.map((task) => {
                const overdue = task.dueDate && new Date(task.dueDate).getTime() < now;
                const st = STATUS_STYLE[task.status] || STATUS_STYLE.TODO;
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      draggable={Boolean(onReassign)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', task.id);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onClick={() => onOpenTask(task.id)}
                      className="flex w-full items-center gap-3 px-2 py-2 text-left text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">{task.title}</span>
                      <span className={cn('hidden shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium sm:inline', st.bg, st.text)}>
                        {workStatusLabel(task.status, t)}
                      </span>
                      <span className={cn('w-24 shrink-0 text-right text-xs tabular-nums', overdue ? 'font-semibold text-rose-600' : 'text-slate-500')}>
                        {task.dueDate ? formatDate(task.dueDate) : '—'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
