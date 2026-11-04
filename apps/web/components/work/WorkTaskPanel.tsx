'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  WORK_PRIORITIES,
  WORK_STATUSES,
  parseTags,
  workPriorityLabel,
  workStatusLabel,
} from './work-ui';
import { firstHttpUrl, renderLinkedText, shortUrlLabel } from './work-linkify';

const fieldLabel =
  'text-[10px] font-semibold uppercase tracking-wide text-[color:var(--sys-muted,#475569)]';
const fieldControl =
  'etask-field w-full rounded-lg border border-[color:var(--sys-line,#cbd5e1)] bg-[color:var(--sys-panel-soft,#f8fafc)] px-2.5 py-2 text-xs font-medium text-[color:var(--sys-ink,#0f172a)] outline-none [color-scheme:inherit]';

type UserOpt = { id: string; name: string | null; email?: string };
type GroupOpt = { id: string; name: string; color: string | null };
type PanelTab = 'detail' | 'work' | 'send' | 'updates';

function membersFromCustom(customFields: unknown) {
  if (!customFields || typeof customFields !== 'object' || Array.isArray(customFields)) return {};
  const raw = (customFields as Record<string, unknown>).__roleMemberIds;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  return {
    executor: Array.isArray(o.executor) ? o.executor.map(String).filter(Boolean) : undefined,
    responsible: Array.isArray(o.responsible) ? o.responsible.map(String).filter(Boolean) : undefined,
    reviewer: Array.isArray(o.reviewer) ? o.reviewer.map(String).filter(Boolean) : undefined,
  };
}

function panelRoleIds(
  task: {
    assigneeId?: string | null;
    responsibleId?: string | null;
    reviewerId?: string | null;
    assigneeIds?: string[] | null;
    responsibleIds?: string[] | null;
    reviewerIds?: string[] | null;
    collaboratorIds?: unknown;
    customFields?: unknown;
    people?: Array<{ userId: string; role: string; sortOrder?: number }> | null;
  },
  role: 'EXECUTOR' | 'RESPONSIBLE' | 'REVIEWER',
): string[] {
  const fromCustom = membersFromCustom(task.customFields);
  if (role === 'EXECUTOR') {
    if (Array.isArray(task.assigneeIds) && task.assigneeIds.length) {
      return [...new Set(task.assigneeIds.map(String).filter(Boolean))];
    }
    if (fromCustom.executor?.length) return fromCustom.executor;
    if (Array.isArray(task.people) && task.people.some((p) => p.role === 'EXECUTOR')) {
      return task.people
        .filter((p) => p.role === 'EXECUTOR')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((p) => p.userId);
    }
    const extra = Array.isArray(task.collaboratorIds) ? task.collaboratorIds.map(String) : [];
    return [...new Set([task.assigneeId, ...extra].filter(Boolean).map(String))];
  }
  if (role === 'RESPONSIBLE') {
    if (Array.isArray(task.responsibleIds) && task.responsibleIds.length) {
      return [...new Set(task.responsibleIds.map(String).filter(Boolean))];
    }
    if (fromCustom.responsible?.length) return fromCustom.responsible;
    if (Array.isArray(task.people) && task.people.some((p) => p.role === 'RESPONSIBLE')) {
      return task.people
        .filter((p) => p.role === 'RESPONSIBLE')
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((p) => p.userId);
    }
    return task.responsibleId ? [task.responsibleId] : [];
  }
  if (Array.isArray(task.reviewerIds) && task.reviewerIds.length) {
    return [...new Set(task.reviewerIds.map(String).filter(Boolean))];
  }
  if (fromCustom.reviewer?.length) return fromCustom.reviewer;
  if (Array.isArray(task.people) && task.people.some((p) => p.role === 'REVIEWER')) {
    return task.people
      .filter((p) => p.role === 'REVIEWER')
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((p) => p.userId);
  }
  return task.reviewerId ? [task.reviewerId] : [];
}

function RoleChipRow({
  label,
  ids,
  users,
  onChange,
  t,
}: {
  label: string;
  ids: string[];
  users: UserOpt[];
  onChange: (ids: string[]) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const nameOf = (id: string) =>
    users.find((u) => u.id === id)?.name || users.find((u) => u.id === id)?.email || id;
  const available = users.filter((u) => !ids.includes(u.id));

  return (
    <div className="min-w-0 flex-1 space-y-0.5">
      <span className={fieldLabel}>{label}</span>
      <div className="flex min-h-[24px] flex-wrap items-center gap-1">
        {ids.length === 0 ? (
          <span className="text-[12px] text-[color:var(--sys-faint,#94a3b8)]">—</span>
        ) : (
          ids.map((id) => (
            <button
              key={id}
              type="button"
              title={t('Remove', 'Quitar', 'Remover')}
              onClick={() => onChange(ids.filter((row) => row !== id))}
              className="inline-flex h-6 max-w-full items-center gap-1 rounded-full bg-teal-500/15 px-2 text-[10px] font-semibold text-teal-700 dark:text-teal-200"
            >
              <span className="truncate">{nameOf(id)}</span>
              <span aria-hidden>×</span>
            </button>
          ))
        )}
        {available.length > 0 ? (
          <select
            value=""
            aria-label={t('Add person', 'Añadir persona', 'Adicionar pessoa')}
            onChange={(e) => {
              const id = e.target.value;
              if (!id || ids.includes(id)) return;
              onChange([...ids, id]);
            }}
            className="h-6 max-w-[7.5rem] cursor-pointer appearance-none rounded-md border-0 bg-transparent px-1 text-[10px] font-medium text-[color:var(--sys-faint,#94a3b8)] outline-none hover:text-teal-300"
          >
            <option value="">+</option>
            {available.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
              </option>
            ))}
          </select>
        ) : null}
      </div>
    </div>
  );
}

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
  assigneeIds?: string[] | null;
  responsibleIds?: string[] | null;
  reviewerIds?: string[] | null;
  collaboratorIds?: unknown;
  people?: Array<{ userId: string; role: string; sortOrder?: number }> | null;
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
  const [sendAction, setSendAction] = useState<'review' | 'delivery' | 'handoff'>('review');
  const [sendRecipientId, setSendRecipientId] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [sendingAction, setSendingAction] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<PanelTab>('detail');

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

  useEffect(() => {
    setTab('detail');
  }, [taskId]);

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
    setError('');
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, content: comment.trim() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        (data as { error?: string }).error ||
          t('Could not post update', 'No se pudo publicar', 'Não foi possível publicar'),
      );
      return;
    }
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

  const submitSendAction = async () => {
    if (!sendRecipientId) return;
    setSendingAction(true);
    setError('');
    try {
      const r = await fetch(`/api/tasks/${taskId}/send-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: sendAction,
          recipientId: sendRecipientId,
          note: sendNote.trim() || null,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(
          d.error || t('Could not send', 'No se pudo enviar', 'Não foi possível enviar'),
        );
      }
      setSendRecipientId('');
      setSendNote('');
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSendingAction(false);
    }
  };

  const remove = async () => {
    if (!confirm(t('Delete this task?', '¿Eliminar esta tarea?', 'Excluir esta tarefa?'))) return;
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    onChanged();
    onClose();
  };

  const renderCommentBody = (content: string) =>
    renderLinkedText(content, {
      mentionClassName: 'rounded bg-cyan-500/20 px-1 font-medium text-cyan-200',
      linkClassName:
        'break-all font-medium text-teal-600 underline decoration-teal-500/40 underline-offset-2 hover:text-teal-500',
    });

  const tabs: Array<{ id: PanelTab; label: string; count?: number }> = [
    { id: 'detail', label: t('Detail', 'Detalle', 'Detalhe') },
    {
      id: 'work',
      label: t('Work', 'Trabajo', 'Trabalho'),
      count:
        (task?.checklist?.length || 0) +
        (task?.subtasks?.length || 0) +
        (task?.timeEntries?.length || 0) || undefined,
    },
    {
      id: 'send',
      label: t('Send', 'Enviar', 'Enviar'),
      count: task?.approvalRequests?.length || undefined,
    },
    {
      id: 'updates',
      label: t('Updates', 'Actualizaciones', 'Atualizações'),
      count: task?.comments?.length || undefined,
    },
  ];

  const titleUrl = firstHttpUrl(title);

  return (
    <aside className="flex h-full min-h-0 w-full max-w-[440px] shrink-0 flex-col self-stretch overflow-hidden border-l border-[color:var(--sys-line)] bg-[color:var(--sys-panel,#fff)] text-[color:var(--sys-ink)] shadow-[-12px_0_32px_rgba(15,23,42,0.18)]">
      <div className="flex shrink-0 items-center justify-between border-b border-[color:var(--sys-line)] px-4 py-2">
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
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[color:var(--sys-muted)]">…</div>
      ) : !task ? (
        <div className="p-4 text-sm text-rose-600">{error || 'Not found'}</div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Sticky identity: title · status · priority · due · people */}
          <div className="shrink-0 space-y-2 border-b border-[color:var(--sys-line)] px-4 pb-2.5 pt-2.5">
            {error ? (
              <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600">{error}</p>
            ) : null}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                if (title.trim() && title.trim() !== task.title) void saveCore();
              }}
              className="w-full border-0 border-b border-transparent bg-transparent pb-0.5 text-lg font-semibold tracking-tight text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
            />
            {titleUrl ? (
              <a
                href={titleUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-teal-600 hover:underline"
              >
                {t('Open link', 'Abrir enlace', 'Abrir link')}: {shortUrlLabel(titleUrl)}
              </a>
            ) : null}

            <div className="grid grid-cols-3 gap-1.5">
              <label className="space-y-0.5">
                <span className={fieldLabel}>{t('Status', 'Estado', 'Status')}</span>
                <select
                  value={task.status}
                  onChange={(e) => void patch({ status: e.target.value })}
                  className={`${fieldControl} py-1.5 font-semibold`}
                >
                  {WORK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {workStatusLabel(s, t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-0.5">
                <span className={fieldLabel}>{t('Priority', 'Prioridad', 'Prioridade')}</span>
                <select
                  value={task.priority}
                  onChange={(e) => void patch({ priority: e.target.value })}
                  className={`${fieldControl} py-1.5 font-semibold`}
                >
                  {WORK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {workPriorityLabel(p, t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-0.5">
                <span className={fieldLabel}>{t('Due', 'Fecha', 'Prazo')}</span>
                <input
                  type="date"
                  value={task.dueDate ? String(task.dueDate).slice(0, 10) : ''}
                  onChange={(e) => void patch({ dueDate: e.target.value || null })}
                  className={`${fieldControl} py-1.5`}
                />
              </label>
            </div>

            {/* Compact people row */}
            <div className="flex gap-2.5 rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft,#f8fafc)] px-2.5 py-1.5">
              <RoleChipRow
                label={t('Executor', 'Ejecutor', 'Executor')}
                ids={panelRoleIds(task, 'EXECUTOR')}
                users={users}
                onChange={(ids) => void patch({ assigneeIds: ids })}
                t={t}
              />
              <div className="w-px self-stretch bg-[color:var(--sys-line)]" aria-hidden />
              <RoleChipRow
                label={t('Owner', 'Responsable', 'Responsável')}
                ids={panelRoleIds(task, 'RESPONSIBLE')}
                users={users}
                onChange={(ids) => void patch({ responsibleIds: ids })}
                t={t}
              />
              <div className="w-px self-stretch bg-[color:var(--sys-line)]" aria-hidden />
              <RoleChipRow
                label={t('Supervisor', 'Supervisor', 'Supervisor')}
                ids={panelRoleIds(task, 'REVIEWER')}
                users={users}
                onChange={(ids) => void patch({ reviewerIds: ids })}
                t={t}
              />
            </div>
          </div>

          {/* Tabs — stay fixed above the scrollable body */}
          <div
            role="tablist"
            className="flex shrink-0 gap-0.5 overflow-x-auto border-b border-[color:var(--sys-line)] px-2"
          >
            {tabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`relative shrink-0 px-3 py-2 text-[11px] font-semibold tracking-wide transition ${
                    active
                      ? 'text-teal-300'
                      : 'text-[color:var(--sys-muted)] hover:text-[color:var(--sys-ink)]'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {item.label}
                    {item.count ? (
                      <span
                        className={`rounded-md px-1 py-px text-[9px] tabular-nums ${
                          active
                            ? 'bg-teal-500/20 text-teal-200'
                            : 'bg-[color:var(--sys-panel-soft)] text-[color:var(--sys-faint)]'
                        }`}
                      >
                        {item.count}
                      </span>
                    ) : null}
                  </span>
                  {active ? (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-teal-400" />
                  ) : null}
                </button>
              );
            })}
          </div>

          {/* Only the active tab body scrolls */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {tab === 'detail' ? (
              <div className="space-y-2.5">
                <label className="block space-y-0.5">
                  <span className={fieldLabel}>{t('Description', 'Descripción', 'Descrição')}</span>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => {
                      if ((description.trim() || null) !== (task.description || null)) void saveCore();
                    }}
                    rows={3}
                    className="etask-field w-full resize-y rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-2.5 py-1.5 text-sm leading-snug text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
                    placeholder={t('Add details…', 'Añadir detalles…', 'Adicionar detalhes…')}
                  />
                </label>

                <label className="block space-y-0.5">
                  <span className={fieldLabel}>Tags</span>
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    onBlur={() => void saveCore()}
                    className="etask-field w-full rounded-lg border border-[color:var(--sys-line)] bg-[color:var(--sys-panel-soft)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
                    placeholder="design, sprint"
                  />
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <label className="col-span-2 space-y-0.5">
                    <span className={fieldLabel}>{t('Group', 'Grupo', 'Grupo')}</span>
                    <select
                      value={task.groupId || ''}
                      onChange={(e) => void patch({ groupId: e.target.value || null })}
                      className={`${fieldControl} py-1.5`}
                    >
                      <option value="">{t('No group', 'Sin grupo', 'Sem grupo')}</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-span-2 space-y-0.5">
                    <span className={fieldLabel}>{t('Folder', 'Carpeta', 'Pasta')}</span>
                    <select
                      value={task.folderId || ''}
                      onChange={(e) => void patch({ folderId: e.target.value || null })}
                      className={`${fieldControl} py-1.5`}
                    >
                      <option value="">{t('No folder', 'Sin carpeta', 'Sem pasta')}</option>
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-0.5">
                    <span className={fieldLabel}>{t('Start', 'Inicio', 'Início')}</span>
                    <input
                      type="date"
                      value={task.startDate ? String(task.startDate).slice(0, 10) : ''}
                      onChange={(e) => void patch({ startDate: e.target.value || null })}
                      className={`${fieldControl} py-1.5`}
                    />
                  </label>
                  <label className="space-y-0.5">
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
                      className={`${fieldControl} py-1.5`}
                      placeholder="0"
                    />
                  </label>
                </div>
              </div>
            ) : null}

            {tab === 'work' ? (
              <div className="space-y-4">
                <section>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <p className={fieldLabel}>{t('Checklist', 'Checklist', 'Checklist')}</p>
                    {(task.checklist || []).length > 0 && (
                      <span className="text-[10px] tabular-nums text-[color:var(--sys-muted)]">
                        {(task.checklist || []).filter((c) => c.completed).length}/
                        {(task.checklist || []).length}
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
                      <li
                        key={s.id}
                        className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[color:var(--sys-panel-soft)]"
                      >
                        <input
                          type="checkbox"
                          checked={s.completed}
                          onChange={() => void toggleChecklist(s.id, s.completed)}
                          className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                        />
                        <span
                          className={`min-w-0 flex-1 text-sm ${
                            s.completed
                              ? 'text-[color:var(--sys-muted)] line-through'
                              : 'text-[color:var(--sys-ink)]'
                          }`}
                        >
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
                  <p className={`mb-2 ${fieldLabel}`}>{t('Subtasks', 'Subtareas', 'Subtarefas')}</p>
                  <ul className="space-y-1.5">
                    {(task.subtasks || []).map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-lg px-1 py-1 text-sm hover:bg-[color:var(--sys-panel-soft)]"
                      >
                        <span
                          className={
                            s.status === 'DONE'
                              ? 'text-[color:var(--sys-muted)] line-through'
                              : 'text-[color:var(--sys-ink)]'
                          }
                        >
                          {s.title}
                        </span>
                        <span className="text-[10px] text-[color:var(--sys-muted)]">
                          {s.status.replace(/_/g, ' ')}
                        </span>
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
                  <p className={`mb-2 ${fieldLabel}`}>
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
              </div>
            ) : null}

            {tab === 'send' ? (
              <div className="space-y-2.5">
                <select
                  value={sendAction}
                  onChange={(e) => setSendAction(e.target.value as 'review' | 'delivery' | 'handoff')}
                  className={fieldControl}
                >
                  <option value="review">{t('Request review', 'Pedir revisión', 'Pedir revisão')}</option>
                  <option value="delivery">{t('Deliver / hand in', 'Entregar', 'Entregar')}</option>
                  <option value="handoff">{t('Pass the baton', 'Pasar el testigo', 'Passar o bastão')}</option>
                </select>
                <select
                  value={sendRecipientId}
                  onChange={(e) => setSendRecipientId(e.target.value)}
                  className={fieldControl}
                >
                  <option value="">{t('Choose who…', 'Elegir a quién…', 'Escolher para quem…')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email}
                    </option>
                  ))}
                </select>
                <input
                  value={sendNote}
                  onChange={(e) => setSendNote(e.target.value)}
                  placeholder={t('Note (optional)', 'Nota (opcional)', 'Nota (opcional)')}
                  className={fieldControl}
                />
                <button
                  type="button"
                  onClick={() => void submitSendAction()}
                  disabled={!sendRecipientId || sendingAction}
                  className="w-full rounded-lg bg-teal-600 px-3 py-2.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-40"
                >
                  {sendingAction
                    ? t('Sending…', 'Enviando…', 'A enviar…')
                    : t('Send activity', 'Enviar actividad', 'Enviar atividade')}
                </button>
                <ul className="space-y-1 pt-1">
                  {(task.approvalRequests || []).map((a) => (
                    <li
                      key={a.id}
                      className="rounded-lg bg-[color:var(--sys-panel-soft)] px-2 py-1.5 text-[11px] text-[color:var(--sys-muted)]"
                    >
                      {a.status} → {a.approver?.name || '—'}
                      {a.note ? ` · ${a.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {tab === 'updates' ? (
              <div className="space-y-2.5">
                <div className="relative">
                  <div className="flex gap-2">
                    <textarea
                      value={comment}
                      onChange={(e) => onCommentChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void addComment();
                        }
                      }}
                      rows={2}
                      placeholder={t(
                        'Write an update… paste links · @name',
                        'Escribe… pega enlaces · @nombre',
                        'Escreve… cola links · @nome',
                      )}
                      className="etask-field min-h-[2.5rem] flex-1 resize-y rounded-lg border border-[color:var(--sys-line)] px-2.5 py-1.5 text-sm text-[color:var(--sys-ink)] outline-none focus:border-teal-400"
                    />
                    <button
                      type="button"
                      onClick={() => void addComment()}
                      className="self-end rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500"
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
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-[color:var(--sys-ink)]">
                        {renderCommentBody(c.content)}
                      </p>
                    </li>
                  ))}
                  {(task.comments || []).length === 0 ? (
                    <p className="py-6 text-center text-xs text-[color:var(--sys-faint)]">
                      {t('No updates yet', 'Sin actualizaciones', 'Sem atualizações')}
                    </p>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-[color:var(--sys-line)] px-4 py-2.5">
            <p className="text-[11px] text-[color:var(--sys-muted)]">
              {saving
                ? t('Saving…', 'Guardando…', 'A guardar…')
                : task.creator
                  ? `by ${task.creator.name || task.creator.email}`
                  : ''}
            </p>
            <button
              type="button"
              onClick={() => void remove()}
              className="text-xs font-medium text-rose-600 hover:underline"
            >
              {t('Delete', 'Eliminar', 'Excluir')}
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
