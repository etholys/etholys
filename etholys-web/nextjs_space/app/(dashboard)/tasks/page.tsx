'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/app/providers';
import { formatDate, getStatusColor, getPriorityColor, getInitials, cn } from '@/lib/utils';
import { Plus, Search, LayoutGrid, List, X, Clock, MessageSquare, Paperclip, CheckSquare, Edit2, Trash2, Building2, Repeat } from 'lucide-react';

const KANBAN_COLUMNS = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function TasksPage() {
  const {tr, activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [dateFromFilter, setDateFromFilter] = useState('');
  const [dateToFilter, setDateToFilter] = useState('');
  const [showAdvFilters, setShowAdvFilters] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [taskScopeFilter, setTaskScopeFilter] = useState(''); // '' = all, 'project' = with project, 'company' = without project
  const [showForm, setShowForm] = useState(false);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [form, setForm] = useState<any>({ title: '', description: '', projectId: '', departmentId: '', assigneeId: '', priority: 'MEDIUM', status: 'TODO', dueDate: '', isRecurring: false, recurrenceMonths: '1', recurrenceCount: '1' });
  const [newComment, setNewComment] = useState('');
  const [taskDetail, setTaskDetail] = useState<any>(null);
  const [editingTask, setEditingTask] = useState(false);
  const [taskEditForm, setTaskEditForm] = useState<any>({});
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [newTimeHours, setNewTimeHours] = useState('');
  const [newTimeDesc, setNewTimeDesc] = useState('');

  const fetchTasks = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (activeCompanyId) params.set('companyId', activeCompanyId);
    if (projectFilter) params.set('projectId', projectFilter);
    if (departmentFilter) params.set('departmentId', departmentFilter);
    if (taskScopeFilter === 'company') params.set('noProject', '1');
    fetch(`/api/tasks?${params}`).then(r => r.json()).then(d => { setTasks(d?.tasks ?? []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchTasks(); }, [activeCompanyId, projectFilter, departmentFilter, taskScopeFilter]);
  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(d?.projects ?? [])).catch(() => {});
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d?.users ?? [])).catch(() => {});
    fetch('/api/departments').then(r => r.json()).then(d => setDepartments(d?.departments ?? [])).catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: any = {
      ...form,
      dueDate: form.dueDate ? new Date(form.dueDate) : null,
      isRecurring: form.isRecurring || false,
      recurrenceMonths: form.isRecurring ? parseInt(form.recurrenceMonths) || 1 : null,
      recurrenceCount: form.isRecurring ? parseInt(form.recurrenceCount) || 1 : null,
    };
    if (!body.assigneeId) delete body.assigneeId;
    if (!body.departmentId) delete body.departmentId;
    if (!body.projectId) { delete body.projectId; if (activeCompanyId) body.companyId = activeCompanyId; }
    await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setShowForm(false);
    setForm({ title: '', description: '', projectId: '', departmentId: '', assigneeId: '', priority: 'MEDIUM', status: 'TODO', dueDate: '', isRecurring: false, recurrenceMonths: '1', recurrenceCount: '1' });
    fetchTasks();
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    await fetch(`/api/tasks/${taskId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    fetchTasks();
  };

  const openTaskDetail = async (taskId: string) => {
    const res = await fetch(`/api/tasks/${taskId}`);
    const data = await res.json();
    setTaskDetail(data?.task);
    setShowDetail(true);
  };

  const addComment = async () => {
    if (!newComment.trim() || !taskDetail?.id) return;
    await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: taskDetail.id, content: newComment }) });
    setNewComment('');
    openTaskDetail(taskDetail.id);
  };

  const toggleChecklist = async (itemId: string, completed: boolean) => {
    await fetch('/api/checklist', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: itemId, completed }) });
    if (taskDetail?.id) openTaskDetail(taskDetail.id);
  };

  const addChecklistItem = async () => {
    if (!newChecklistItem.trim() || !taskDetail?.id) return;
    await fetch('/api/checklist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: taskDetail.id, text: newChecklistItem }) });
    setNewChecklistItem('');
    openTaskDetail(taskDetail.id);
  };

  const addTimeEntry = async () => {
    if (!newTimeHours || !taskDetail?.id) return;
    await fetch('/api/time-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId: taskDetail.id, hours: newTimeHours, description: newTimeDesc }) });
    setNewTimeHours('');
    setNewTimeDesc('');
    openTaskDetail(taskDetail.id);
  };

  const saveTaskEdit = async () => {
    if (!taskDetail?.id) return;
    const data: any = { ...taskEditForm };
    if (data.dueDate) data.dueDate = new Date(data.dueDate);
    if (data.estimatedHours) data.estimatedHours = parseFloat(data.estimatedHours);
    if (!data.assigneeId) data.assigneeId = null;
    await fetch(`/api/tasks/${taskDetail.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    setEditingTask(false);
    openTaskDetail(taskDetail.id);
    fetchTasks();
  };

  const deleteTask = async (taskId: string, title: string) => {
    if (!confirm(`${L(ml('Delete task','¿Eliminar tarea','Excluir tarefa'))} "${title}"?`)) return;
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    setShowDetail(false);
    setTaskDetail(null);
    fetchTasks();
  };

  const filtered = (tasks ?? []).filter((t: any) => {
    if (search && !(t?.title ?? '').toLowerCase().includes(search.toLowerCase()) && !(t?.description ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter && t?.priority !== priorityFilter) return false;
    if (statusFilter && t?.status !== statusFilter) return false;
    if (assigneeFilter && t?.assigneeId !== assigneeFilter) return false;
    if (dateFromFilter && t?.dueDate && new Date(t.dueDate) < new Date(dateFromFilter)) return false;
    if (dateToFilter && t?.dueDate && new Date(t.dueDate) > new Date(dateToFilter + 'T23:59:59')) return false;
    return true;
  });
  const hasAdvFilters = !!(priorityFilter || statusFilter || assigneeFilter || dateFromFilter || dateToFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{tr('nav.tasks')}</h1>
          <p className="text-gray-500 text-sm">{filtered?.length ?? 0} {tr('nav.tasks').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setView('kanban')} className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition', view === 'kanban' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setView('list')} className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition', view === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500')}>
              <List className="w-4 h-4" />
            </button>
          </div>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium text-sm">
            <Plus className="w-4 h-4" />{tr('task.new')}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tr('general.search')} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-teal-500 outline-none" />
          </div>
          <select value={taskScopeFilter} onChange={e => { setTaskScopeFilter(e.target.value); if (e.target.value === 'company') setProjectFilter(''); }} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="">{L(ml('All tasks','Todas las tareas','Todas as tarefas'))}</option>
            <option value="project">{L(ml('Project tasks','De proyecto','De projeto'))}</option>
            <option value="company">{L(ml('Company tasks (no project)','De empresa (sin proyecto)','Da empresa (sem projeto)'))}</option>
          </select>
          {taskScopeFilter !== 'company' && (
            <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm">
              <option value="">{tr('general.all')} {tr('nav.projects')}</option>
              {(projects ?? []).map((p: any) => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
            </select>
          )}
          <select value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} className="px-4 py-2.5 rounded-lg border border-gray-200 text-sm">
            <option value="">{L(ml('All departments','Todos los sectores','Todos os setores'))}</option>
            {(departments ?? []).map((d: any) => <option key={d?.id} value={d?.id}>{d?.name}</option>)}
          </select>
          <button onClick={() => setShowAdvFilters(!showAdvFilters)} className={`px-3 py-2.5 rounded-lg border text-sm flex items-center gap-1.5 transition ${hasAdvFilters ? 'bg-teal-50 border-teal-300 text-teal-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
            {L(ml('Filters','Filtros','Filtros'))} {hasAdvFilters && <span className="w-1.5 h-1.5 bg-teal-600 rounded-full" />}
          </button>
        </div>
        {showAdvFilters && (
          <div className="flex flex-wrap gap-3 p-3 bg-white rounded-lg border border-gray-200">
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm">
              <option value="">{L(ml('All priorities','Todas las prioridades','Todas as prioridades'))}</option>
              <option value="LOW">{tr('priority.low')}</option>
              <option value="MEDIUM">{tr('priority.medium')}</option>
              <option value="HIGH">{tr('priority.high')}</option>
              <option value="CRITICAL">{tr('priority.critical')}</option>
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm">
              <option value="">{L(ml('All statuses','Todos los estados','Todos os status'))}</option>
              {KANBAN_COLUMNS.map(s => <option key={s} value={s}>{tr(`status.${s.toLowerCase()}`)}</option>)}
            </select>
            <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm">
              <option value="">{L(ml('All members','Todos los miembros','Todos os membros'))}</option>
              {(users ?? []).map((u: any) => <option key={u?.id} value={u?.id}>{u?.name}</option>)}
            </select>
            <input type="date" value={dateFromFilter} onChange={e => setDateFromFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" title={L(ml('From','Desde','Desde'))} />
            <input type="date" value={dateToFilter} onChange={e => setDateToFilter(e.target.value)} className="px-3 py-2 rounded-lg border text-sm" title={L(ml('To','Hasta','Até'))} />
            {hasAdvFilters && (
              <button onClick={() => { setPriorityFilter(''); setStatusFilter(''); setAssigneeFilter(''); setDateFromFilter(''); setDateToFilter(''); }} className="px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-1">
                <X className="w-3.5 h-3.5" />{L(ml('Clear','Limpiar','Limpar'))}
              </button>
            )}
          </div>
        )}
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" /></div> : (
        view === 'kanban' ? (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {KANBAN_COLUMNS.map(col => {
              const colTasks = filtered.filter((t: any) => t?.status === col);
              return (
                <div key={col} className="min-w-[280px] flex-1">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getStatusColor(col) }} />
                    <span className="text-sm font-semibold text-gray-700">{tr(`status.${col.toLowerCase()}`)}</span>
                    <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{colTasks?.length ?? 0}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((t: any) => (
                      <div key={t?.id} onClick={() => openTaskDetail(t?.id)} className="kanban-card bg-white p-3 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition border border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-400">{t?.project?.name ?? t?.department?.name ?? t?.project?.company?.shortName ?? L(ml('Company', 'Empresa', 'Empresa'))}</span>
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getPriorityColor(t?.priority ?? '') }} />
                        </div>
                        <p className="text-sm font-medium text-gray-900 mb-2 line-clamp-2">
                          {t?.isRecurring && <Repeat className="w-3 h-3 text-purple-500 inline mr-1" />}
                          {t?.title ?? ''}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {t?.assignee && <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold">{getInitials(t.assignee?.name)}</div>}
                            {t?.dueDate && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock className="w-3 h-3" />{formatDate(t.dueDate)}</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-gray-400">
                            {(t?._count?.comments ?? 0) > 0 && <span className="flex items-center gap-0.5 text-[10px]"><MessageSquare className="w-3 h-3" />{t._count.comments}</span>}
                            {(t?._count?.subtasks ?? 0) > 0 && <span className="flex items-center gap-0.5 text-[10px]"><CheckSquare className="w-3 h-3" />{t._count.subtasks}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50"><th className="text-left p-3 font-medium text-gray-500">{tr('task.title')}</th><th className="text-left p-3 font-medium text-gray-500">{tr('nav.projects')}</th><th className="text-left p-3 font-medium text-gray-500">{tr('task.assignee')}</th><th className="text-left p-3 font-medium text-gray-500">{tr('general.status')}</th><th className="text-left p-3 font-medium text-gray-500">{tr('general.priority')}</th><th className="text-left p-3 font-medium text-gray-500">{tr('task.dueDate')}</th></tr></thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t?.id} onClick={() => openTaskDetail(t?.id)} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition">
                    <td className="p-3 font-medium text-gray-900">{t?.isRecurring && <Repeat className="w-3 h-3 text-purple-500 inline mr-1" />}{t?.title ?? ''}</td>
                    <td className="p-3 text-gray-500">{t?.project?.name ?? ''}</td>
                    <td className="p-3">{t?.assignee ? <span className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold">{getInitials(t.assignee?.name)}</div>{t.assignee?.name}</span> : '-'}</td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getStatusColor(t?.status ?? '') + '20', color: getStatusColor(t?.status ?? '') }}>{tr(`status.${(t?.status ?? '').toLowerCase()}`)}</span></td>
                    <td className="p-3"><span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getPriorityColor(t?.priority ?? '') + '20', color: getPriorityColor(t?.priority ?? '') }}>{tr(`priority.${(t?.priority ?? '').toLowerCase()}`)}</span></td>
                    <td className="p-3 text-gray-500">{formatDate(t?.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="text-center py-12 text-gray-400">{tr('general.noData')}</div>}
          </div>
        )
      )}

      {/* Create Task Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{tr('task.new')}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('task.title')} *</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('project.description')}</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('nav.projects')}</label>
                  <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="">{L(ml('No project (company task)','Sin proyecto (tarea de empresa)','Sem projeto (tarefa da empresa)'))}</option>
                    {(projects ?? []).map((p: any) => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('Department / Sector','Sector / Departamento','Setor / Departamento'))}</label>
                  <select value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="">{L(ml('No department','Sin departamento','Sem departamento'))}</option>
                    {(departments ?? []).map((d: any) => <option key={d?.id} value={d?.id}>{d?.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('task.assignee')}</label>
                  <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="">-</option>
                    {(users ?? []).map((u: any) => <option key={u?.id} value={u?.id}>{u?.name}</option>)}
                  </select>
                </div>
                <div />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('general.status')}</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    {KANBAN_COLUMNS.map(s => <option key={s} value={s}>{tr(`status.${s.toLowerCase()}`)}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('general.priority')}</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{tr(`priority.${p.toLowerCase()}`)}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{tr('task.dueDate')}</label><input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              </div>
              {/* Recurring */}
              <div className="border-t pt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isRecurring} onChange={e => setForm({ ...form, isRecurring: e.target.checked })} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  <Repeat className="w-3.5 h-3.5 text-purple-500" />
                  <span className="text-sm text-gray-700">{L(ml('Recurring task','Tarea recurrente','Tarefa recorrente'))}</span>
                </label>
                {form.isRecurring && (
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{L(ml('Every (months)','Cada (meses)','A cada (meses)'))}</label>
                      <input type="number" min="1" max="60" value={form.recurrenceMonths} onChange={e => setForm({ ...form, recurrenceMonths: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">{L(ml('Repetitions','Repeticiones','Repetições'))}</label>
                      <input type="number" min="1" max="60" value={form.recurrenceCount} onChange={e => setForm({ ...form, recurrenceCount: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                    </div>
                    {parseInt(form.recurrenceCount) > 1 && form.dueDate && (
                      <div className="col-span-2 bg-purple-50 border border-purple-200 rounded-lg p-2 text-xs text-purple-700">
                        <Repeat className="w-3 h-3 inline mr-1" />
                        {L(ml('Will create','Se crearán','Serão criadas'))} <strong>{parseInt(form.recurrenceCount) || 1} {L(ml('tasks','tareas','tarefas'))}</strong> {L(ml('from','desde','a partir de'))} {form.dueDate}, {L(ml('every','cada','a cada'))} {form.recurrenceMonths} {L(ml('month(s)','mes(es)','mês(es)'))}.
                      </div>
                    )}
                    {form.isRecurring && !form.dueDate && (
                      <div className="col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700">
                        {L(ml('You must set a due date to create recurring tasks.','Debes definir una fecha límite para crear tareas recurrentes.','Você deve definir uma data limite para criar tarefas recorrentes.'))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">{tr('general.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {showDetail && taskDetail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowDetail(false); setTaskDetail(null); setEditingTask(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getStatusColor(taskDetail?.status ?? '') + '20', color: getStatusColor(taskDetail?.status ?? '') }}>{tr(`status.${(taskDetail?.status ?? '').toLowerCase()}`)}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: getPriorityColor(taskDetail?.priority ?? '') + '20', color: getPriorityColor(taskDetail?.priority ?? '') }}>{tr(`priority.${(taskDetail?.priority ?? '').toLowerCase()}`)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditingTask(true); setTaskEditForm({ title: taskDetail?.title, description: taskDetail?.description, assigneeId: taskDetail?.assigneeId || '', priority: taskDetail?.priority, dueDate: taskDetail?.dueDate ? new Date(taskDetail.dueDate).toISOString().split('T')[0] : '', estimatedHours: taskDetail?.estimatedHours || '' }); }} className="text-gray-400 hover:text-teal-600"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => deleteTask(taskDetail.id, taskDetail.title)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  <button onClick={() => { setShowDetail(false); setTaskDetail(null); setEditingTask(false); }}><X className="w-5 h-5 text-gray-400" /></button>
                </div>
              </div>
              <h2 className="text-xl font-bold text-gray-900 mt-3">{taskDetail?.title ?? ''}</h2>
              <p className="text-sm text-gray-500 mt-1">{taskDetail?.project?.name ?? ''} · {taskDetail?.project?.company?.shortName ?? ''}</p>
            </div>

            <div className="p-5 space-y-5">
              {/* Edit Task Form */}
              {editingTask ? (
                <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                  <div><label className="block text-sm font-medium mb-1">{tr('task.title')}</label><input value={taskEditForm.title ?? ''} onChange={e => setTaskEditForm({ ...taskEditForm, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
                  <div><label className="block text-sm font-medium mb-1">{tr('project.description')}</label><textarea value={taskEditForm.description ?? ''} onChange={e => setTaskEditForm({ ...taskEditForm, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium mb-1">{tr('task.assignee')}</label><select value={taskEditForm.assigneeId ?? ''} onChange={e => setTaskEditForm({ ...taskEditForm, assigneeId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm"><option value="">-</option>{users.map((u: any) => <option key={u?.id} value={u?.id}>{u?.name}</option>)}</select></div>
                    <div><label className="block text-sm font-medium mb-1">{tr('general.priority')}</label><select value={taskEditForm.priority ?? ''} onChange={e => setTaskEditForm({ ...taskEditForm, priority: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">{['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{tr(`priority.${p.toLowerCase()}`)}</option>)}</select></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-sm font-medium mb-1">{tr('task.dueDate')}</label><input type="date" value={taskEditForm.dueDate ?? ''} onChange={e => setTaskEditForm({ ...taskEditForm, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
                    <div><label className="block text-sm font-medium mb-1">{L(ml('Estimated Hours','Horas Estimadas','Horas Estimadas'))}</label><input type="number" step="0.5" value={taskEditForm.estimatedHours ?? ''} onChange={e => setTaskEditForm({ ...taskEditForm, estimatedHours: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingTask(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded-lg">{tr('general.cancel')}</button>
                    <button onClick={saveTaskEdit} className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700">{tr('general.save')}</button>
                  </div>
                </div>
              ) : (
                <>
                  {taskDetail?.description && <div><h4 className="text-sm font-medium text-gray-700 mb-1">{tr('project.description')}</h4><p className="text-sm text-gray-600">{taskDetail.description}</p></div>}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">{tr('task.assignee')}</p><p className="text-sm font-medium">{taskDetail?.assignee?.name ?? '-'}</p></div>
                    <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">{tr('task.dueDate')}</p><p className="text-sm font-medium">{formatDate(taskDetail?.dueDate)}</p></div>
                    <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">{tr('general.status')}</p>
                      <select value={taskDetail?.status ?? ''} onChange={e => handleStatusChange(taskDetail?.id, e.target.value)} className="text-sm font-medium bg-transparent outline-none w-full">
                        {KANBAN_COLUMNS.map(s => <option key={s} value={s}>{tr(`status.${s.toLowerCase()}`)}</option>)}
                        <option value="CANCELLED">{tr('status.cancelled')}</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* Checklist */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><CheckSquare className="w-4 h-4" />{tr('task.checklist')}</h4>
                <div className="space-y-1">
                  {(taskDetail?.checklist ?? []).map((item: any) => (
                    <label key={item?.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={item?.completed ?? false} onChange={e => toggleChecklist(item?.id, e.target.checked)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                      <span className={cn('text-sm', item?.completed && 'line-through text-gray-400')}>{item?.text ?? ''}</span>
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input value={newChecklistItem} onChange={e => setNewChecklistItem(e.target.value)} placeholder={L(ml('Add item...','Agregar item...','Adicionar item...'))} className="flex-1 px-3 py-1.5 rounded-lg border text-sm" onKeyDown={e => e.key === 'Enter' && addChecklistItem()} />
                  <button onClick={addChecklistItem} className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Time Entries */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><Clock className="w-4 h-4" />{tr('task.timeLog')}</h4>
                <div className="space-y-1">
                  {(taskDetail?.timeEntries ?? []).map((te: any) => (
                    <div key={te?.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm">
                      <span>{te?.user?.name ?? ''} - {te?.description ?? ''}</span>
                      <span className="font-medium">{te?.hours ?? 0}h · {formatDate(te?.date)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input type="number" step="0.5" min="0.5" value={newTimeHours} onChange={e => setNewTimeHours(e.target.value)} placeholder={L(ml('Hours','Horas','Horas'))} className="w-20 px-3 py-1.5 rounded-lg border text-sm" />
                  <input value={newTimeDesc} onChange={e => setNewTimeDesc(e.target.value)} placeholder={L(ml('Work description...','Descripción del trabajo...','Descrição do trabalho...'))} className="flex-1 px-3 py-1.5 rounded-lg border text-sm" />
                  <button onClick={addTimeEntry} className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"><Plus className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><MessageSquare className="w-4 h-4" />{tr('task.comments')}</h4>
                <div className="space-y-2 mb-3">
                  {(taskDetail?.comments ?? []).map((c: any) => (
                    <div key={c?.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-[10px] font-bold">{getInitials(c?.user?.name)}</div>
                        <span className="text-sm font-medium">{c?.user?.name ?? ''}</span>
                        <span className="text-xs text-gray-400">{formatDate(c?.createdAt)}</span>
                      </div>
                      <p className="text-sm text-gray-600">{c?.content ?? ''}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder={`${tr('task.comments')}...`} className="flex-1 px-3 py-2 rounded-lg border text-sm" onKeyDown={e => e.key === 'Enter' && addComment()} />
                  <button onClick={addComment} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">{tr('general.save')}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
