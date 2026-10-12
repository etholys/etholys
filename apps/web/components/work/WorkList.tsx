'use client';

import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { PRIORITY_STYLE, STATUS_STYLE, workPriorityLabel, workStatusLabel } from './work-ui';
import { WorkBulkBar } from './WorkBulkBar';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  assignee?: { name?: string | null } | null;
  project?: { name?: string } | null;
  department?: { name?: string } | null;
  folder?: { name?: string } | null;
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
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="flex items-center justify-end border-b border-[color:var(--sys-line)] px-3 py-2">
            <label className="flex items-center gap-2 text-[11px] font-medium text-[color:var(--sys-muted)]">
              <input
                type="checkbox"
                checked={hideDone}
                onChange={(e) => setHideDone(e.target.checked)}
                className="rounded border-slate-300"
              />
              {t('Hide done', 'Ocultar hechas', 'Ocultar concluídas')}
            </label>
          </div>
          <div
            className="grid items-center gap-4 border-b border-[color:var(--sys-line)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--sys-faint)]"
            style={{ gridTemplateColumns: '28px 28px minmax(240px,1fr) 96px 120px 160px 96px' }}
          >
            {onBulk ? (
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={() =>
                  setSelected(allVisibleSelected ? new Set() : new Set(rows.map((r) => r.id)))
                }
                className="h-4 w-4 justify-self-center rounded border-slate-300 text-teal-600"
                aria-label={t('Select all', 'Seleccionar todo', 'Selecionar tudo')}
              />
            ) : (
              <span />
            )}
            <span />
            <span>{t('Task', 'Tarea', 'Tarefa')}</span>
            <span>{t('Priority', 'Prioridad', 'Prioridade')}</span>
            <span>{t('Status', 'Estado', 'Estado')}</span>
            <span>{t('Assignee', 'Responsable', 'Responsável')}</span>
            <span className="text-right">{t('Due', 'Fecha', 'Prazo')}</span>
          </div>
          <ul>
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
                    'grid items-center gap-3 border-b border-[color:var(--sys-line)] px-3 py-2.5 hover:bg-[color:var(--sys-nav-hover)]',
                    isSel && 'bg-teal-500/10',
                  )}
                  style={{ gridTemplateColumns: '28px 28px minmax(240px,1fr) 96px 120px 160px 96px' }}
                >
                  {onBulk ? (
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(task.id)}
                      className="h-4 w-4 justify-self-center rounded border-slate-300 text-teal-600"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span />
                  )}
                  {onToggleDone ? (
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
                        'flex h-5 w-5 items-center justify-center justify-self-center rounded-full border transition',
                        done
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : 'border-[color:var(--sys-line)] text-transparent hover:border-teal-400 hover:text-teal-300',
                      )}
                      title={done ? t('Reopen', 'Reabrir', 'Reabrir') : t('Mark done', 'Marcar hecha', 'Marcar concluída')}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  ) : (
                    <span className={cn('h-2 w-2 justify-self-center rounded-full', st.dot)} />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelect(task.id)}
                    className="min-w-0 truncate text-left text-sm font-medium text-[color:var(--sys-ink)]"
                    title={task.title}
                  >
                    <span className={cn(done && 'text-[color:var(--sys-faint)] line-through')}>{task.title}</span>
                    {(task._count?.subtasks || 0) > 0 && (
                      <span className="ml-2 text-[10px] font-normal text-[color:var(--sys-faint)]">
                        {task._count?.subtasks} sub
                      </span>
                    )}
                  </button>
                  <span className={cn('w-fit max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold', pr.bg, pr.text)}>
                    {workPriorityLabel(task.priority, t)}
                  </span>
                  <span className={cn('w-fit max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium', st.bg, st.text)}>
                    {workStatusLabel(task.status, t)}
                  </span>
                  <span className="truncate text-xs text-[color:var(--sys-muted)]">
                    {task.assignee?.name || '—'}
                  </span>
                  <span
                    className={cn(
                      'text-right text-xs tabular-nums',
                      overdue ? 'font-semibold text-rose-400' : 'text-[color:var(--sys-muted)]',
                    )}
                  >
                    {task.dueDate ? formatDate(task.dueDate) : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
