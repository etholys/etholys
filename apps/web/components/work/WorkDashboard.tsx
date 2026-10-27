'use client';

import { useMemo, useState } from 'react';
import { formatDate, cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  Lock,
  Settings2,
  UserRound,
  Users,
} from 'lucide-react';
import type { WorkFolderRow, WorkNav } from './WorkSidebar';
import { STATUS_STYLE } from './work-ui';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  folderId?: string | null;
  assigneeId?: string | null;
  assigneeIds?: string[] | null;
  collaboratorIds?: unknown;
  people?: Array<{ userId: string; role: string; user?: { name?: string | null } }> | null;
  assignee?: { id: string; name: string | null } | null;
  department?: { id: string; name: string } | null;
  project?: { id: string; name: string } | null;
  departmentId?: string | null;
  projectId?: string | null;
  parentId?: string | null;
};

const OPEN = new Set(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW']);

function isBoard(f: WorkFolderRow) {
  return f.kind !== 'FOLDER';
}

function isShared(f: WorkFolderRow) {
  return f.visibility === 'SHARED' || (f.members?.length ?? f._count?.members ?? 0) > 0;
}

export function WorkDashboard({
  tasks,
  folders,
  selectedBoardIds,
  personalized,
  onSaveBoardIds,
  currentUserId,
  onOpenTask,
  onNav,
  t,
}: {
  tasks: Task[];
  folders: WorkFolderRow[];
  selectedBoardIds: string[];
  personalized: boolean;
  onSaveBoardIds: (ids: string[]) => Promise<void>;
  currentUserId?: string | null;
  onOpenTask: (id: string) => void;
  onNav: (n: WorkNav) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>(selectedBoardIds);
  const [saving, setSaving] = useState(false);

  const boards = useMemo(() => folders.filter(isBoard), [folders]);
  const selectedSet = useMemo(() => new Set(selectedBoardIds), [selectedBoardIds]);

  const scopedTasks = useMemo(() => {
    if (!selectedBoardIds.length) return tasks.filter((task) => !task.parentId);
    return tasks.filter((task) => !task.parentId && task.folderId && selectedSet.has(task.folderId));
  }, [tasks, selectedBoardIds, selectedSet]);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  const open = scopedTasks.filter((task) => OPEN.has(task.status));
  const overdue = open.filter((task) => task.dueDate && new Date(task.dueDate) < now);
  const executorIds = (task: Task) => {
    if (Array.isArray(task.assigneeIds) && task.assigneeIds.length) return task.assigneeIds.map(String);
    if (Array.isArray(task.people) && task.people.some((p) => p.role === 'EXECUTOR')) {
      return task.people.filter((p) => p.role === 'EXECUTOR').map((p) => p.userId);
    }
    const extra = Array.isArray(task.collaboratorIds) ? task.collaboratorIds.map(String) : [];
    return [task.assigneeId, ...extra].filter(Boolean).map(String);
  };
  const mine = open.filter((task) => currentUserId && executorIds(task).includes(currentUserId));
  const dueThisWeek = open.filter((task) => {
    if (!task.dueDate) return false;
    const d = new Date(task.dueDate);
    return d >= startOfWeek && d < endOfWeek;
  });

  const boardStats = boards
    .filter((b) => selectedSet.has(b.id) || !selectedBoardIds.length)
    .map((b) => {
      const boardOpen = open.filter((task) => task.folderId === b.id);
      const boardOverdue = boardOpen.filter((task) => task.dueDate && new Date(task.dueDate) < now);
      return { board: b, open: boardOpen.length, overdue: boardOverdue.length };
    })
    .filter((row) => selectedBoardIds.length === 0 || selectedSet.has(row.board.id))
    .sort((a, b) => b.open - a.open);

  const cards = [
    {
      label: t('Open', 'Abiertas', 'Abertas'),
      value: open.length,
      icon: Clock3,
      tone: 'text-cyan-200 bg-cyan-500/15',
      go: () => onNav({ kind: 'mine' }),
    },
    {
      label: t('Overdue', 'Atrasadas', 'Atrasadas'),
      value: overdue.length,
      icon: AlertTriangle,
      tone: 'text-rose-200 bg-rose-500/15',
      go: () => onNav({ kind: 'overdue' }),
    },
    {
      label: t('My tasks', 'Mis tareas', 'As minhas'),
      value: mine.length,
      icon: UserRound,
      tone: 'text-[color:var(--sys-ink)] bg-[color:var(--sys-panel-soft)]',
      go: () => onNav({ kind: 'mine' }),
    },
    {
      label: t('Due this week', 'Esta semana', 'Esta semana'),
      value: dueThisWeek.length,
      icon: CheckCircle2,
      tone: 'text-emerald-200 bg-emerald-500/15',
      go: () => onNav({ kind: 'week' }),
    },
  ];

  const startEdit = () => {
    setDraftIds(selectedBoardIds.length ? selectedBoardIds : boards.map((b) => b.id));
    setEditing(true);
  };

  const toggleDraft = (id: string) => {
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSaveBoardIds(draftIds);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-1 sm:p-2">
      <div className="relative overflow-hidden rounded-2xl border border-cyan-100 bg-gradient-to-br from-cyan-50 via-white to-teal-50/40 px-5 py-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-etholys-display)] text-xl font-bold tracking-tight text-[color:var(--sys-ink,#0f172a)]">
              {t('My home', 'Mi inicio', 'O meu início')}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-[color:var(--sys-muted,#475569)]">
              {t(
                'Your personal synthesis — pick which boards appear here. Other people keep their own layout.',
                'Tu síntesis personal — elige qué tableros ves aquí. Cada persona tiene su propio panel.',
                'A tua síntese pessoal — escolhe que tableros aparecem aqui. Cada pessoa tem o seu painel.',
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--sys-line,#cbd5e1)] bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--sys-ink,#0f172a)] hover:bg-[color:var(--sys-nav-hover)]"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {t('Customize', 'Personalizar', 'Personalizar')}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[color:var(--sys-faint,#94a3b8)]">
          {personalized
            ? t(
                `${selectedBoardIds.length} boards in your home`,
                `${selectedBoardIds.length} tableros en tu inicio`,
                `${selectedBoardIds.length} tableros no teu início`,
              )
            : t(
                'Showing your boards by default — customize to save your layout',
                'Mostrando tus tableros por defecto — personaliza para guardar tu panel',
                'A mostrar os teus tableros por defeito — personaliza para guardar o painel',
              )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNav({ kind: 'mine' })}
            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500"
          >
            {t('My work', 'Mi trabajo', 'O meu trabalho')}
          </button>
          <button
            type="button"
            onClick={() => onNav({ kind: 'week' })}
            className="rounded-lg border border-[color:var(--sys-line,#cbd5e1)] bg-[color:var(--sys-panel,#fff)] px-3 py-1.5 text-xs font-semibold text-[color:var(--sys-ink,#0f172a)] hover:bg-[color:var(--sys-nav-hover)]"
          >
            {t('This week', 'Esta semana', 'Esta semana')}
          </button>
        </div>
      </div>

      {editing && (
        <section className="rounded-2xl border border-teal-200/80 bg-white p-4 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-slate-800">
            {t('Boards on my home', 'Tableros en mi inicio', 'Tableros no meu início')}
          </h3>
          <p className="mb-3 text-[11px] text-slate-500">
            {t(
              'Only you see this selection. Sharing a board is separate (Acceso / Tipo).',
              'Solo tú ves esta selección. Compartir un tablero es aparte (Acceso / Tipo).',
              'Só tu vês esta seleção. Partilhar um tablero é aparte (Acesso / Tipo).',
            )}
          </p>
          {boards.length === 0 ? (
            <p className="text-sm text-slate-400">
              {t('No boards yet — create one in the sidebar', 'Aún no hay tableros — créalo en la barra', 'Ainda sem tableros — cria na barra')}
            </p>
          ) : (
            <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto">
              {boards.map((b) => {
                const checked = draftIds.includes(b.id);
                return (
                  <li key={b.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDraft(b.id)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{b.name}</span>
                      {isShared(b) ? (
                        <Users className="h-3 w-3 text-slate-400" />
                      ) : (
                        <Lock className="h-3 w-3 text-slate-400" />
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
            >
              {saving ? t('Saving…', 'Guardando…', 'A guardar…') : t('Save', 'Guardar', 'Guardar')}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              {t('Cancel', 'Cancelar', 'Cancelar')}
            </button>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.go}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-200 hover:shadow-md"
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
            {t('Boards in my home', 'Tableros en mi inicio', 'Tableros no meu início')}
          </h3>
          <ul className="space-y-2">
            {boardStats.length === 0 && (
              <li className="text-sm text-slate-400">
                {t('No boards selected', 'Sin tableros seleccionados', 'Sem tableros selecionados')}
              </li>
            )}
            {boardStats.map(({ board, open: nOpen, overdue: nOverdue }) => (
              <li key={board.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-left hover:bg-[color:var(--sys-nav-hover)]"
                  onClick={() => onNav({ kind: 'folder', id: board.id, name: board.name })}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <LayoutGrid className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                    <span className="truncate text-sm font-medium text-slate-800">{board.name}</span>
                    {isShared(board) ? (
                      <Users className="h-3 w-3 shrink-0 text-slate-400" />
                    ) : (
                      <Lock className="h-3 w-3 shrink-0 text-slate-400" />
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-xs tabular-nums text-slate-500">
                    {nOverdue > 0 && <span className="text-rose-600">{nOverdue}</span>}
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5">{nOpen}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {t('Needs attention', 'Requieren atención', 'Precisam de atenção')}
          </h3>
          <div className="divide-y divide-slate-50">
            {[...overdue, ...dueThisWeek.filter((task) => !overdue.some((o) => o.id === task.id))]
              .slice(0, 12)
              .map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-[color:var(--sys-nav-hover)]"
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
                      {boards.find((b) => b.id === task.folderId)?.name ||
                        task.project?.name ||
                        task.department?.name ||
                        '—'}
                      {task.assignee?.name ? ` · ${task.assignee.name}` : ''}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-[11px] tabular-nums',
                      task.dueDate && new Date(task.dueDate) < now
                        ? 'font-semibold text-rose-600'
                        : 'text-slate-400',
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
    </div>
  );
}
