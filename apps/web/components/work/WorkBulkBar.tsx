'use client';

import { useMemo, useState } from 'react';
import { Archive, CheckSquare, Copy, FolderInput, Square, X } from 'lucide-react';
import { WORK_KANBAN, WORK_PRIORITIES } from './work-ui';

type UserOpt = { id: string; name: string | null; email?: string };
type BoardOpt = {
  id: string;
  name: string;
  kind?: string | null;
  parentId?: string | null;
};

export function WorkBulkBar({
  count,
  users,
  boards,
  currentBoardId,
  onClear,
  onSelectAll,
  onBulk,
  onMoveOrDuplicate,
  onArchive,
  onDelete,
  busy,
  t,
}: {
  count: number;
  users: UserOpt[];
  /** Writable boards the user can move/duplicate into. */
  boards?: BoardOpt[];
  currentBoardId?: string | null;
  onClear: () => void;
  onSelectAll?: () => void;
  onBulk: (patch: Record<string, unknown>) => Promise<void>;
  onMoveOrDuplicate?: (opts: {
    mode: 'move' | 'duplicate';
    targetFolderId: string;
  }) => Promise<void>;
  onArchive?: () => void;
  onDelete?: () => void;
  busy?: boolean;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [boardPicker, setBoardPicker] = useState<'move' | 'duplicate' | null>(null);
  const [targetId, setTargetId] = useState('');

  const writableBoards = useMemo(
    () => (boards ?? []).filter((b) => b.kind !== 'FOLDER' && b.id !== currentBoardId),
    [boards, currentBoardId],
  );

  if (count <= 0) return null;

  const runBoardAction = async () => {
    if (!boardPicker || !targetId || !onMoveOrDuplicate) return;
    await onMoveOrDuplicate({ mode: boardPicker, targetFolderId: targetId });
    setBoardPicker(null);
    setTargetId('');
  };

  return (
    <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] px-3 py-2 shadow-sm backdrop-blur">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--sys-ink)]">
        <CheckSquare className="h-4 w-4 text-teal-300" />
        {count} {t('selected', 'seleccionadas', 'selecionadas')}
      </span>
      {onSelectAll && (
        <button
          type="button"
          onClick={onSelectAll}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[color:var(--sys-muted)] hover:bg-[color:var(--sys-nav-hover)] disabled:opacity-40"
        >
          <Square className="h-3.5 w-3.5" />
          {t('Select all visible', 'Seleccionar visibles', 'Selecionar visíveis')}
        </button>
      )}
      <select
        disabled={busy}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = '';
          if (v) void onBulk({ status: v });
        }}
        className="etask-field rounded-lg border px-2 py-1 text-xs"
      >
        <option value="">{t('Set status…', 'Estado…', 'Estado…')}</option>
        {WORK_KANBAN.map((s) => (
          <option key={s} value={s}>
            {s.replace(/_/g, ' ')}
          </option>
        ))}
      </select>
      <select
        disabled={busy}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = '';
          if (v) void onBulk({ priority: v });
        }}
        className="etask-field rounded-lg border px-2 py-1 text-xs"
      >
        <option value="">{t('Set priority…', 'Prioridad…', 'Prioridade…')}</option>
        {WORK_PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <select
        disabled={busy}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          e.target.value = '';
          if (v === '__clear') void onBulk({ assigneeId: null });
          else if (v) void onBulk({ assigneeId: v });
        }}
        className="etask-field rounded-lg border px-2 py-1 text-xs"
      >
        <option value="">{t('Assign…', 'Asignar…', 'Atribuir…')}</option>
        <option value="__clear">{t('Unassigned', 'Sin asignar', 'Sem responsável')}</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name || u.email}
          </option>
        ))}
      </select>
      <input
        type="date"
        disabled={busy}
        onChange={(e) => {
          if (e.target.value) void onBulk({ dueDate: e.target.value });
          e.target.value = '';
        }}
        className="etask-field rounded-lg border px-2 py-1 text-xs"
        title={t('Set due date', 'Fecha límite', 'Definir prazo')}
      />
      {onMoveOrDuplicate && writableBoards.length > 0 && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBoardPicker((v) => (v === 'move' ? null : 'move'));
              setTargetId('');
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1 text-xs font-semibold text-[color:var(--sys-ink)] hover:border-teal-400 hover:text-teal-700 disabled:opacity-40"
          >
            <FolderInput className="h-3.5 w-3.5" />
            {t('Move…', 'Mover…', 'Mover…')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBoardPicker((v) => (v === 'duplicate' ? null : 'duplicate'));
              setTargetId('');
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1 text-xs font-semibold text-[color:var(--sys-ink)] hover:border-teal-400 hover:text-teal-700 disabled:opacity-40"
          >
            <Copy className="h-3.5 w-3.5" />
            {t('Duplicate…', 'Duplicar…', 'Duplicar…')}
          </button>
        </>
      )}
      {onArchive && (
        <button
          type="button"
          disabled={busy}
          onClick={onArchive}
          className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1 text-xs font-semibold text-[color:var(--sys-ink)] hover:border-teal-400 hover:text-teal-700 disabled:opacity-40"
        >
          <Archive className="h-3.5 w-3.5" />
          {t('Archive', 'Archivar', 'Arquivar')}
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          disabled={busy}
          onClick={onDelete}
          className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-500 disabled:opacity-40"
        >
          {t('Delete', 'Eliminar', 'Excluir')}
        </button>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void onBulk({ status: 'DONE' })}
        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
      >
        {t('Mark done', 'Marcar hechas', 'Concluir')}
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-lg p-1.5 text-[color:var(--sys-muted)] hover:bg-[color:var(--sys-nav-hover)]"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>

      {boardPicker && onMoveOrDuplicate && (
        <div className="flex w-full flex-wrap items-center gap-2 border-t border-[color:var(--sys-line)] pt-2">
          <span className="text-xs font-medium text-[color:var(--sys-muted)]">
            {boardPicker === 'move'
              ? t('Move to board', 'Mover al tablero', 'Mover para o tablero')
              : t('Duplicate to board', 'Duplicar al tablero', 'Duplicar para o tablero')}
          </span>
          <select
            value={targetId}
            disabled={busy}
            onChange={(e) => setTargetId(e.target.value)}
            className="etask-field min-w-[12rem] flex-1 rounded-lg border px-2 py-1 text-xs"
          >
            <option value="">
              {t('Choose board…', 'Elegir tablero…', 'Escolher tablero…')}
            </option>
            {writableBoards.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !targetId}
            onClick={() => void runBoardAction()}
            className="rounded-lg bg-teal-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
          >
            {boardPicker === 'move'
              ? t('Move', 'Mover', 'Mover')
              : t('Duplicate', 'Duplicar', 'Duplicar')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setBoardPicker(null);
              setTargetId('');
            }}
            className="rounded-lg px-2 py-1 text-xs text-[color:var(--sys-muted)] hover:bg-[color:var(--sys-nav-hover)]"
          >
            {t('Cancel', 'Cancelar', 'Cancelar')}
          </button>
        </div>
      )}
    </div>
  );
}
