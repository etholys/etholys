'use client';

import { CheckSquare, Square, X } from 'lucide-react';
import { WORK_KANBAN, WORK_PRIORITIES } from './work-ui';

type UserOpt = { id: string; name: string | null; email?: string };

export function WorkBulkBar({
  count,
  users,
  onClear,
  onSelectAll,
  onBulk,
  onDelete,
  busy,
  t,
}: {
  count: number;
  users: UserOpt[];
  onClear: () => void;
  onSelectAll?: () => void;
  onBulk: (patch: Record<string, unknown>) => Promise<void>;
  onDelete?: () => void;
  busy?: boolean;
  t: (en: string, es: string, pt: string) => string;
}) {
  if (count <= 0) return null;

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
    </div>
  );
}
