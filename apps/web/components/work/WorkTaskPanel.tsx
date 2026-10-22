'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  WORK_PRIORITIES,
  WORK_STATUSES,
  parseTags,
  workPriorityLabel,
  workStatusLabel,
} from './work-ui';

const fieldLabel =
  'text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sys-muted,#475569)]';
const fieldControl =
  'etask-field w-full rounded-lg border border-[color:var(--sys-line,#cbd5e1)] bg-[color:var(--sys-panel-soft,#f8fafc)] px-2.5 py-2 text-xs font-medium text-[color:var(--sys-ink,#0f172a)] outline-none [color-scheme:inherit]';

type UserOpt = { id: string; name: string | null; email?: string };
type GroupOpt = { id: string; name: string; color: string | null };

type Detail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  startDate?: string | null;
  tags: unknown;
  assigneeId: string | null;
  responsibleId?: string | null;
  reviewerId?: string | null;
  groupId?: string | null;
  folderId?: string | null;
  projectId: string | null;
  companyId?: string | null;
  departmentId?: string | null;
  estimatedHours?: number | null;
  project?: { id: string; name: string } | null;
  assignee?: UserOpt | null;
  responsible?: UserOpt | null;
  reviewer?: UserOpt | null;
  creator?: UserOpt | null;
  group?: { id: string; name: string; color: string | null } | null;
  folder?: { id: string; name: string; color: string | null } | null;
  checklist?: Array<{ id: string; text: string; completed: boolean }>;
  subtasks?: Array<{ id: string; title: string; status: string; assignee?: UserOpt | null }>;
  comments?: Array<{
    id: string;
    content: string;
    createdAt: string;
    user: UserOpt;
  }>;
  timeEntries?: Array<{
    id: string;
    hours: number;
    description: string | null;
    date: string;
    user?: UserOpt | null;
  }>;
  approvalRequests?: Array<{
    id: string;
    status: string;
    note: string | null;
    createdAt: string;
    requester?: UserOpt | null;
    approver?: UserOpt | null;
  }>;
};

export function WorkTaskPanel({
  taskId,
  users,
  groups,
  folders = [],
  activeCompanyId,
  onClose,
  onChanged,
  t,
}: {
  taskId: string;
  users: UserOpt[];
  groups: GroupOpt[];
  folders?: GroupOpt[];
  activeCompanyId?: string | null;
  onClose: () => void;
  onChanged: () => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const [task, setTask] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [comment, setComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [timeHours, setTimeHours] = useState('');
  const [timeDesc, setTimeDesc] = useState('');
  const [approvalApproverId, setApprovalApproverId] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed');
      setTask(data.task);
      setTitle(data.task.title);
      setDescription(data.task.description || '');
      setTagsInput(parseTags(data.task.tags).join(', '));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      if (data.task) setTask(data.task);
      else await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveCore = async () => {
    await patch({
      title: title.trim(),
      description: description.trim() || null,
      tags: parseTags(tagsInput),
    });
  };

  const addChecklist = async () => {
    if (!checklistText.trim()) return;
    await fetch('/api/checklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, text: checklistText.trim() }),
    });
    setChecklistText('');
    await load();
  };

  const toggleChecklist = async (id: string, completed: boolean) => {
    await fetch('/api/checklist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, completed: !completed }),
    });
    await load();
  };

  const deleteChecklist = async (id: string) => {
    await fetch(`/api/checklist?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await load();
  };

  const addSubtask = async () => {
    if (!subtaskTitle.trim() || !task) return;
    const body: Record<string, unknown> = {
      title: subtaskTitle.trim(),
      parentId: task.id,
      status: 'TODO',
      priority: task.priority || 'MEDIUM',
      projectId: task.projectId || undefined,
      companyId: task.companyId || activeCompanyId || undefined,
      departmentId: task.departmentId || undefined,
      groupId: task.groupId || undefined,
    };
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setSubtaskTitle('');
    await load();
    onChanged();
  };

  const onCommentChange = (val: string) => {
    setComment(val);
    const lastAt = val.lastIndexOf('@');
    if (lastAt >= 0 && !val.slice(lastAt + 1).includes(' ')) {
      setMentionQuery(val.slice(lastAt + 1).toLowerCase());
    } else {
      setMentionQuery(null);
    }
  };

  const pickMention = (user: UserOpt) => {
    const lastAt = comment.lastIndexOf('@');
    if (lastAt < 0) return;
    setComment(`${comment.slice(0, lastAt)}@${user.name || user.email} `);
    setMentionQuery(null);
  };

  const mentionSuggestions =
    mentionQuery == null
      ? []
      : users.filter((u) => (u.name || u.email || '').toLowerCase().includes(mentionQuery)).slice(0, 6);

  const addComment = async () => {
    if (!comment.trim()) return;
    await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, content: comment.trim() }),
    });
    setComment('');
    setMentionQuery(null);
    await load();
  };

  const addTime = async () => {
    if (!timeHours) return;
    await fetch('/api/time-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, hours: timeHours, description: timeDesc }),
    });
    setTimeHours('');
    setTimeDesc('');
    await load();
  };

  const requestApproval = async () => {
    if (!approvalApproverId) return;
    const r = await fetch('/api/task-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, approverId: approvalApproverId, note: approvalNote || null }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error || t('Could not request approval', 'No se pudo solicitar', 'Não foi possível solicitar'));
      return;
    }
    setApprovalApproverId('');
    setApprovalNote('');
    await load();
  };

  const remove = async () => {
    if (!confirm(t('Delete this task?', '¿Eliminar esta tarea?', 'Excluir esta tarefa?'))) return;
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    onChanged();
    onClose();
  };

  const renderCommentBody = (content: string) => {
    const parts = String(content || '').split(/(@[^\s@][^@]*?)(?=\s|$|@)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} className="rounded bg-cyan-500/20 px-1 font-medium text-cyan-200">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    );
  };

  return (
    <aside className="flex h-full w-full max-w-[440px] shrink-0 flex-col border-l border-[color:var(--sys-line)] bg-[color:var(--sys-panel,#fff)] text-[color:var(--sys-ink)] shadow-[-12px_0_32px_rgba(15,23,42,0.18)]">
      <div className="flex items-center justify-between border-b border-[color:var(--sys-line)] px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-300">
          {t('Task', 'Tarea', 'Tarefa')}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-sm text-[color:var(--sys-muted)] hover:bg-[color:var(--sys-nav-hover)]"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm text-[color:var(--sys-muted)]">…</div>
      ) : !task ? (
        <div className="p-4 text-sm text-rose-600">{error || 'Not found'}</div>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {error ? <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p> : null}

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title.trim() !== task.title) void saveCore();
            }}
            className="w-full border-0 border-b border-transparent bg-transparent pb-2 text-xl font-semibold tracking-tight text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
          />

          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className={fieldLabel}>{t('Status', 'Estado', 'Status')}</span>
              <select
                value={task.status}
                onChange={(e) => void patch({ status: e.target.value })}
                className={`${fieldControl} font-semibold`}
              >
                {WORK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {workStatusLabel(s, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabel}>{t('Priority', 'Prioridad', 'Prioridade')}</span>
              <select
                value={task.priority}
                onChange={(e) => void patch({ priority: e.target.value })}
                className={`${fieldControl} font-semibold`}
              >
                {WORK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {workPriorityLabel(p, t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabel}>{t('Executor', 'Ejecutor', 'Executor')}</span>
              <select
                value={task.assigneeId || ''}
                onChange={(e) => void patch({ assigneeId: e.target.value || null })}
                className={fieldControl}
              >
                <option value="">{t('Unassigned', 'Sin asignar', 'Sem executor')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabel}>{t('Owner', 'Responsable', 'Responsável')}</span>
              <select
                value={task.responsibleId || ''}
                onChange={(e) => void patch({ responsibleId: e.target.value || null })}
                className={fieldControl}
              >
                <option value="">{t('None', 'Ninguno', 'Nenhum')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabel}>{t('Reviewer', 'Revisor', 'Revisor')}</span>
              <select
                value={task.reviewerId || ''}
                onChange={(e) => void patch({ reviewerId: e.target.value || null })}
                className={fieldControl}
              >
                <option value="">{t('None', 'Ninguno', 'Nenhum')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className={fieldLabel}>{t('Due', 'Fecha', 'Prazo')}</span>
              <input
                type="date"
                value={task.dueDate ? String(task.dueDate).slice(0, 10) : ''}
                onChange={(e) => void patch({ dueDate: e.target.value || null })}
                className={fieldControl}
              />
            </label>
            <label className="space-y-1">
              <span className={fieldLabel}>{t('Start', 'Inicio', 'Início')}</span>
              <input
                type="date"
                value={task.startDate ? String(task.startDate).slice(0, 10) : ''}
                onChange={(e) => void patch({ startDate: e.target.value || null })}
                className={fieldControl}
              />
            </label>
            <label className="space-y-1">
              <span className={fieldLabel}>{t('Estimate (h)', 'Estimación (h)', 'Estimativa (h)')}</span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={task.estimatedHours ?? ''}
                onChange={(e) =>
                  void patch({
                    estimatedHours: e.target.value === '' ? null : parseFloat(e.target.value),
                  })
                }
                className={fieldControl}
                placeholder="0"
              />
            </label>
            <label className="col-span-2 space-y-1">
              <span className={fieldLabel}>{t('Group', 'Grupo', 'Grupo')}</span>
              <select
                value={task.groupId || ''}
                onChange={(e) => void patch({ groupId: e.target.value || null })}
                className={fieldControl}
              >
                <option value="">{t('No group', 'Sin grupo', 'Sem grupo')}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="col-span-2 space-y-1">
              <span className={fieldLabel}>{t('Folder', 'Carpeta', 'Pasta')}</span>
              <select
                value={task.folderId || ''}
                onChange={(e) => void patch({ folderId: e.target.value || null })}
                className={fieldControl}
              >
                <option value="">{t('No folder', 'Sin carpeta', 'Sem pasta')}</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block space-y-1">
            <span className={fieldLabel}>{t('Description', 'Descripción', 'Descrição')}</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => {
                if ((description.trim() || null) !== (task.description || null)) void saveCore();
              }}
              rows={4}
              className="etask-field w-full rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-3 py-2 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
              placeholder={t('Add details…', 'Añadir detalles…', 'Adicionar detalhes…')}
            />
          </label>

          <label className="block space-y-1">
            <span className={fieldLabel}>Tags</span>
            <input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onBlur={() => void saveCore()}
              className="etask-field w-full rounded-xl border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-3 py-2 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
              placeholder="design, sprint"
            />
          </label>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sys-muted)]">
                {t('Checklist', 'Checklist', 'Checklist')}
              </p>
              {(task.checklist || []).length > 0 && (
                <span className="text-[10px] tabular-nums text-[color:var(--sys-muted)]">
                  {(task.checklist || []).filter((c) => c.completed).length}/{(task.checklist || []).length}
                </span>
              )}
            </div>
            {(task.checklist || []).length > 0 && (
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[color:var(--sys-panel-soft)]">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all"
                  style={{
                    width: `${Math.round(
                      ((task.checklist || []).filter((c) => c.completed).length /
                        Math.max((task.checklist || []).length, 1)) *
                        100,
                    )}%`,
                  }}
                />
              </div>
            )}
            <ul className="space-y-1.5">
              {(task.checklist || []).map((s) => (
                <li key={s.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[color:var(--sys-panel-soft)]">
                  <input
                    type="checkbox"
                    checked={s.completed}
                    onChange={() => void toggleChecklist(s.id, s.completed)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                  />
                  <span className={`min-w-0 flex-1 text-sm ${s.completed ? 'text-[color:var(--sys-muted)] line-through' : 'text-[color:var(--sys-ink)]'}`}>
                    {s.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteChecklist(s.id)}
                    className="text-[10px] font-medium text-slate-300 opacity-0 hover:text-rose-600 group-hover:opacity-100"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                value={checklistText}
                onChange={(e) => setChecklistText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addChecklist()}
                placeholder={t('Add item', 'Añadir ítem', 'Adicionar item')}
                className="etask-field flex-1 rounded-lg border border-dashed border-[color:var(--sys-line)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={() => void addChecklist()}
                className="rounded-lg bg-[color:var(--sys-panel-soft)] px-2.5 text-xs font-semibold text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
              >
                +
              </button>
            </div>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sys-muted)]">
              {t('Subtasks', 'Subtareas', 'Subtarefas')}
            </p>
            <ul className="space-y-1.5">
              {(task.subtasks || []).map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded-lg px-1 py-1 text-sm hover:bg-[color:var(--sys-panel-soft)]">
                  <span className={s.status === 'DONE' ? 'text-[color:var(--sys-muted)] line-through' : 'text-[color:var(--sys-ink)]'}>
                    {s.title}
                  </span>
                  <span className="text-[10px] text-[color:var(--sys-muted)]">{s.status.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input
                value={subtaskTitle}
                onChange={(e) => setSubtaskTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void addSubtask()}
                placeholder={t('Add subtask', 'Añadir subtarea', 'Adicionar subtarefa')}
                className="etask-field flex-1 rounded-lg border border-dashed border-[color:var(--sys-line)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={() => void addSubtask()}
                className="rounded-lg bg-[color:var(--sys-panel-soft)] px-2.5 text-xs font-semibold text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
              >
                +
              </button>
            </div>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sys-muted)]">
              {t('Time tracking', 'Registro de horas', 'Registo de horas')}
            </p>
            <div className="mb-2 flex gap-2">
              <input
                type="number"
                min="0"
                step="0.25"
                value={timeHours}
                onChange={(e) => setTimeHours(e.target.value)}
                placeholder="h"
                className="etask-field w-16 rounded-lg border border-[color:var(--sys-line)] px-2 py-1.5 text-sm text-[color:var(--sys-ink)]"
              />
              <input
                value={timeDesc}
                onChange={(e) => setTimeDesc(e.target.value)}
                placeholder={t('What did you do?', '¿Qué hiciste?', 'O que fizeste?')}
                className="etask-field flex-1 rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)]"
              />
              <button
                type="button"
                onClick={() => void addTime()}
                className="rounded-lg bg-[color:var(--sys-panel-soft)] px-2.5 text-xs font-semibold text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
              >
                +
              </button>
            </div>
            <ul className="space-y-1">
              {(task.timeEntries || []).slice(0, 5).map((te) => (
                <li key={te.id} className="flex justify-between text-xs text-[color:var(--sys-muted)]">
                  <span>
                    {te.hours}h {te.description ? `· ${te.description}` : ''}
                  </span>
                  <span>{te.user?.name || ''}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sys-muted)]">
              {t('Approval', 'Aprobación', 'Aprovação')}
            </p>
            <div className="space-y-2">
              <select
                value={approvalApproverId}
                onChange={(e) => setApprovalApproverId(e.target.value)}
                className="etask-field w-full rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-xs text-[color:var(--sys-ink)]"
              >
                <option value="">{t('Choose approver…', 'Elegir aprobador…', 'Escolher aprovador…')}</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.email}
                  </option>
                ))}
              </select>
              <input
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                placeholder={t('Note (optional)', 'Nota (opcional)', 'Nota (opcional)')}
                className="etask-field w-full rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-xs text-[color:var(--sys-ink)]"
              />
              <button
                type="button"
                onClick={() => void requestApproval()}
                disabled={!approvalApproverId}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-40"
              >
                {t('Request approval', 'Solicitar aprobación', 'Solicitar aprovação')}
              </button>
            </div>
            <ul className="mt-2 space-y-1">
              {(task.approvalRequests || []).map((a) => (
                <li key={a.id} className="rounded-lg bg-[color:var(--sys-panel-soft)] px-2 py-1.5 text-[11px] text-[color:var(--sys-muted)]">
                  {a.status} → {a.approver?.name || '—'}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sys-muted)]">
              {t('Updates', 'Actualizaciones', 'Atualizações')}
            </p>
            <div className="relative mb-2">
              <div className="flex gap-2">
                <input
                  value={comment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void addComment()}
                  placeholder={t('Write an update… @name', 'Escribe… @nombre', 'Escreve… @nome')}
                  className="etask-field flex-1 rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={() => void addComment()}
                  className="rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white hover:bg-cyan-500"
                >
                  {t('Post', 'Publicar', 'Publicar')}
                </button>
              </div>
              {mentionSuggestions.length > 0 && (
                <ul className="absolute left-0 right-12 z-10 mt-1 overflow-hidden rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel)] shadow-lg">
                  {mentionSuggestions.map((u) => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onClick={() => pickMention(u)}
                        className="w-full px-3 py-2 text-left text-sm text-[color:var(--sys-ink)] hover:bg-[color:var(--sys-nav-hover)]"
                      >
                        {u.name || u.email}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <ul className="space-y-2">
              {(task.comments || []).map((c) => (
                <li key={c.id} className="rounded-xl bg-[color:var(--sys-panel-soft)] px-3 py-2">
                  <p className="text-[11px] font-semibold text-[color:var(--sys-muted)]">
                    {c.user?.name || c.user?.email}
                    <span className="ml-2 font-normal text-[color:var(--sys-muted)]">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-[color:var(--sys-ink)]">{renderCommentBody(c.content)}</p>
                </li>
              ))}
            </ul>
          </section>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-[11px] text-[color:var(--sys-muted)]">
              {saving
                ? t('Saving…', 'Guardando…', 'A guardar…')
                : task.creator
                  ? `by ${task.creator.name || task.creator.email}`
                  : ''}
            </p>
            <button type="button" onClick={() => void remove()} className="text-xs font-medium text-rose-600 hover:underline">
              {t('Delete', 'Eliminar', 'Excluir')}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
