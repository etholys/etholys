'use client';

import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type ArchiveTask = {
  id: string;
  title: string;
  status: string;
  archivedAt?: string | null;
  group?: { id?: string; name?: string | null } | null;
  folder?: { id?: string; name?: string | null; visibility?: string | null } | null;
  project?: { id?: string; name?: string | null } | null;
  assignee?: { id?: string; name?: string | null } | null;
  archivedBy?: { id?: string; name?: string | null } | null;
};

export function WorkArchive({
  tasks,
  loading,
  onRestore,
  onDelete,
  onOpen,
  t,
}: {
  tasks: ArchiveTask[];
  loading?: boolean;
  onRestore: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onOpen?: (id: string) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600/30 border-t-teal-600" />
      </div>
    );
  }

  if (!tasks.length) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-16 text-center">
        <Archive className="mb-3 h-10 w-10 text-[color:var(--sys-faint)]" />
        <p className="text-sm font-semibold text-[color:var(--sys-ink)]">
          {t('Archive is empty', 'El archivo está vacío', 'O arquivo está vazio')}
        </p>
        <p className="mt-1 text-xs text-[color:var(--sys-muted)]">
          {t(
            'Archived tasks leave the active board. Shared board items stay visible here to people with access.',
            'Las tareas archivadas salen del tablero activo. En tableros compartidos siguen visibles aquí para quien tenga acceso.',
            'As tarefas arquivadas saem do quadro ativo. Em quadros partilhados continuam visíveis aqui para quem tiver acesso.',
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      <p className="px-1 text-xs text-[color:var(--sys-muted)]">
        {tasks.length}{' '}
        {t('archived', 'archivadas', 'arquivadas')} ·{' '}
        {t(
          'Restore returns them to their board/group',
          'Restaurar las devuelve al tablero/grupo',
          'Restaurar devolve-as ao quadro/grupo',
        )}
      </p>
      <ul className="divide-y divide-[color:var(--sys-line)] overflow-hidden rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)]">
        {tasks.map((task) => {
          const place =
            task.folder?.name ||
            task.project?.name ||
            task.group?.name ||
            t('My work', 'Mi trabajo', 'O meu trabalho');
          return (
            <li
              key={task.id}
              className="flex flex-wrap items-center gap-2 px-3 py-2.5 hover:bg-[color:var(--sys-panel-soft)]"
            >
              <button
                type="button"
                onClick={() => onOpen?.(task.id)}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-sm font-medium text-[color:var(--sys-ink)]">{task.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-[color:var(--sys-faint)]">
                  {place}
                  {task.archivedAt ? ` · ${formatDate(task.archivedAt)}` : ''}
                  {task.archivedBy?.name ? ` · ${task.archivedBy.name}` : ''}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onRestore(task.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--sys-line)] px-2 py-1 text-xs font-medium text-[color:var(--sys-ink)] hover:border-teal-400 hover:text-teal-700"
                title={t('Restore', 'Restaurar', 'Restaurar')}
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                {t('Restore', 'Restaurar', 'Restaurar')}
              </button>
              <button
                type="button"
                onClick={() => onDelete(task.id, task.title)}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-rose-500 hover:bg-rose-500/10"
                title={t('Delete permanently', 'Eliminar definitivamente', 'Eliminar definitivamente')}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
