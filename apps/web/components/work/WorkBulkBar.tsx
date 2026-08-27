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
  busy,
  t,
}: {
  count: number;
  users: UserOpt[];
  onClear: () => void;
  onSelectAll?: () => void;
  onBulk: (patch: Record<string, unknown>) => Promise<void>;
  busy?: boolean;
  t: (en: string, es: string, pt: string) => string;
}) {
  if (count <= 0) return null;

  return (
    <div className="sticky top-0 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-50/95 px-3 py-2 shadow-sm backdrop-blur">
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-900">
        <CheckSquare className="h-4 w-4" />
        {count} {t('selected', 'seleccionadas', 'selecionadas')}
      </span>
      {onSelectAll && (
        <button
          type="button"
          onClick={onSelectAll}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-100 disabled:opacity-40"
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
        className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-xs"
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
        className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-xs"
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
        className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-xs"
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
        className="rounded-lg border border-cyan-200 bg-white px-2 py-1 text-xs"
        title={t('Set due date', 'Fecha límite', 'Definir prazo')}
      />
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
        className="ml-auto rounded-lg p-1.5 text-cyan-700 hover:bg-cyan-100"
        aria-label="Clear selection"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
