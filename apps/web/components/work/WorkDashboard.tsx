'use client';

import { formatDate, getInitials, cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock3, UserRound } from 'lucide-react';
import type { WorkNav } from './WorkSidebar';
import { STATUS_STYLE } from './work-ui';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  assignee?: { id: string; name: string | null } | null;
  department?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  departmentId?: string | null;
  projectId?: string | null;
};

const OPEN = new Set(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW']);

export function WorkDashboard({
  tasks,
  currentUserId,
  onOpenTask,
  onNav,
  t,
}: {
  tasks: Task[];
  currentUserId?: string | null;
  onOpenTask: (id: string) => void;
  onNav: (n: WorkNav) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const top = tasks.filter((task) => !('parentId' in task && (task as any).parentId));
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const open = top.filter((task) => OPEN.has(task.status));
  const overdue = open.filter((task) => task.dueDate && new Date(task.dueDate) < now);
  const mine = open.filter((task) => currentUserId && task.assigneeId === currentUserId);
  const dueThisWeek = open.filter((task) => {
    if (!task.dueDate) return false;
    const d = new Date(task.dueDate);
    return d >= startOfWeek && d < endOfWeek;
  });
  const done = top.filter((task) => task.status === 'DONE');

  const byDept = new Map<string, { name: string; open: number; overdue: number }>();
  for (const task of open) {
    const key = task.department?.id || task.departmentId || '__none';
    const name = task.department?.name || t('No department', 'Sin sector', 'Sem setor');
    const row = byDept.get(key) || { name, open: 0, overdue: 0 };
    row.open += 1;
    if (task.dueDate && new Date(task.dueDate) < now) row.overdue += 1;
    byDept.set(key, row);
  }

  const byPerson = new Map<string, { name: string; open: number }>();
  for (const task of open) {
    const key = task.assigneeId || '__unassigned';
    const name = task.assignee?.name || t('Unassigned', 'Sin asignar', 'Sem responsável');
    const row = byPerson.get(key) || { name, open: 0 };
    row.open += 1;
    byPerson.set(key, row);
  }

  const people = [...byPerson.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.open - a.open)
    .slice(0, 8);

  const depts = [...byDept.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.open - a.open);

  const cards = [
    {
      label: t('Open', 'Abiertas', 'Abertas'),
      value: open.length,
      icon: Clock3,
      tone: 'text-cyan-700 bg-cyan-50',
      go: () => onNav({ kind: 'all' }),
    },
    {
      label: t('Overdue', 'Atrasadas', 'Atrasadas'),
      value: overdue.length,
      icon: AlertTriangle,
      tone: 'text-rose-700 bg-rose-50',
      go: () => onNav({ kind: 'all' }),
    },
    {
      label: t('My tasks', 'Mis tareas', 'As minhas'),
      value: mine.length,
      icon: UserRound,
      tone: 'text-slate-700 bg-slate-100',
      go: () => onNav({ kind: 'all' }),
    },
    {
      label: t('Due this week', 'Esta semana', 'Esta semana'),
      value: dueThisWeek.length,
      icon: CheckCircle2,
      tone: 'text-emerald-700 bg-emerald-50',
      go: () => onNav({ kind: 'all' }),
    },
  ];

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {t('Work dashboard', 'Panel de Work', 'Painel Work')}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {t(
            'Load across departments and projects — click a card or row to jump into the board.',
            'Carga por sectores y proyectos — clic para abrir el tablero.',
            'Carga por setores e projetos — clica para abrir o quadro.',
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.go}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:border-cyan-200 hover:shadow-md"
          >
            <div className={cn('mb-3 inline-flex rounded-xl p-2', c.tone)}>
              <c.icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold tabular-nums text-slate-900">{c.value}</p>
            <p className="text-xs font-medium text-slate-500">{c.label}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {t('By department', 'Por sector', 'Por setor')}
          </h3>
          <ul className="space-y-2">
            {depts.length === 0 && (
              <li className="text-sm text-slate-400">{t('No open tasks', 'Sin tareas abiertas', 'Sem tarefas abertas')}</li>
            )}
            {depts.map((d) => (
              <li key={d.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-slate-50"
                  onClick={() =>
                    d.id === '__none'
                      ? onNav({ kind: 'company' })
                      : onNav({ kind: 'department', id: d.id, name: d.name })
                  }
                >
                  <span className="truncate text-sm font-medium text-slate-800">{d.name}</span>
                  <span className="flex items-center gap-2 text-xs tabular-nums text-slate-500">
                    {d.overdue > 0 && <span className="text-rose-600">{d.overdue} late</span>}
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{d.open}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-400">
            {done.length} {t('completed in view', 'completadas en vista', 'concluídas na vista')}
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {t('Workload', 'Carga', 'Carga')}
          </h3>
          <ul className="space-y-2">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-bold text-cyan-800">
                  {p.id === '__unassigned' ? '?' : getInitials(p.name)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{p.name}</span>
                <span className="text-xs tabular-nums text-slate-500">{p.open}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">
          {t('Needs attention', 'Requieren atención', 'Precisam de atenção')}
        </h3>
        <div className="divide-y divide-slate-50">
          {[...overdue, ...dueThisWeek.filter((t) => !overdue.some((o) => o.id === t.id))]
            .slice(0, 12)
            .map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => onOpenTask(task.id)}
                className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-slate-50"
              >
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full',
                    STATUS_STYLE[task.status]?.dot || 'bg-slate-300',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                  <p className="truncate text-[11px] text-slate-400">
                    {task.project?.name || task.department?.name || '—'}
                    {task.assignee?.name ? ` · ${task.assignee.name}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-[11px] tabular-nums',
                    task.dueDate && new Date(task.dueDate) < now ? 'font-semibold text-rose-600' : 'text-slate-400',
                  )}
                >
                  {task.dueDate ? formatDate(task.dueDate) : '—'}
                </span>
              </button>
            ))}
          {overdue.length === 0 && dueThisWeek.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">
              {t('Nothing urgent right now', 'Nada urgente ahora', 'Nada urgente agora')}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
