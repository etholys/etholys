'use client';

import { useState, useCallback, useMemo } from 'react';
import { SectionProps } from './types';
import { SectionTooltip } from './SectionTooltip';
import { formatDate, getStatusColor, getPriorityColor, getInitials } from '@/lib/utils';
import {
  ListChecks, Plus, Check, X, Edit3, Trash2, ChevronDown, Calendar, Table2, Columns3,
  GanttChart, CheckCircle2, Circle, Milestone,
} from 'lucide-react';
import Link from 'next/link';

const STATUSES = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED'] as const;
const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog', TODO: 'Por hacer', IN_PROGRESS: 'En progreso',
  IN_REVIEW: 'En revisi\u00f3n', DONE: 'Hecho', CANCELLED: 'Cancelado',
};
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Baja', MEDIUM: 'Media', HIGH: 'Alta', CRITICAL: 'Cr\u00edtica',
};

const KANBAN_COLS = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;

export function TasksSection({ project, onRefresh }: SectionProps) {
  const tasks = (project?.tasks ?? []).filter((t: any) => t?.isActive !== false);
  const members = project?.members ?? [];
  const total = tasks.length;
  const done = tasks.filter((t: any) => t?.status === 'DONE').length;
  const inProgress = tasks.filter((t: any) => t?.status === 'IN_PROGRESS').length;
  const overdue = tasks.filter((t: any) => {
    if (t?.status === 'DONE') return false;
    if (!t?.dueDate) return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', status: 'TODO', priority: 'MEDIUM', dueDate: '', startDate: '', assigneeId: '' });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban' | 'gantt' | 'milestones'>('table');

  /* Milestone state (P3) */
  const [showMsForm, setShowMsForm] = useState(false);
  const [editingMsId, setEditingMsId] = useState<string | null>(null);
  const [msForm, setMsForm] = useState<any>({ name: '', description: '', dueDate: '' });

  const milestones = project?.milestones ?? [];
  const msDone = milestones.filter((m: any) => m?.completed).length;

  const startEdit = (t: any) => {
    setEditId(t.id);
    setEditData({
      title: t.title || '',
      status: t.status || 'TODO',
      priority: t.priority || 'MEDIUM',
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : '',
      startDate: t.startDate ? new Date(t.startDate).toISOString().slice(0, 10) : '',
      assigneeId: t.assigneeId || '',
    });
  };

  const saveEdit = useCallback(async () => {
    if (!editId || !editData.title?.trim()) return;
    setSaving(true);
    try {
      const body: any = { title: editData.title.trim(), status: editData.status, priority: editData.priority };
      if (editData.dueDate) body.dueDate = new Date(editData.dueDate).toISOString();
      else body.dueDate = null;
      if (editData.startDate) body.startDate = new Date(editData.startDate).toISOString();
      else body.startDate = null;
      if (editData.assigneeId) body.assigneeId = editData.assigneeId;
      else body.assigneeId = null;
      await fetch(`/api/tasks/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setEditId(null);
      onRefresh();
    } catch (e) { console.error(e); }
    setSaving(false);
  }, [editId, editData, onRefresh]);

  const quickStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const deleteTask = async (id: string) => {
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch (e) { console.error(e); }
  };

  const createTask = async () => {
    if (!newTask.title.trim()) return;
    setSaving(true);
    try {
      const body: any = {
        title: newTask.title.trim(),
        status: newTask.status,
        priority: newTask.priority,
        projectId: project.id,
        companyId: project.companyId,
      };
      if (newTask.dueDate) body.dueDate = new Date(newTask.dueDate).toISOString();
      if (newTask.startDate) body.startDate = new Date(newTask.startDate).toISOString();
      if (newTask.assigneeId) body.assigneeId = newTask.assigneeId;
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      setCreating(false);
      setNewTask({ title: '', status: 'TODO', priority: 'MEDIUM', dueDate: '', startDate: '', assigneeId: '' });
      onRefresh();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const getMemberName = (assigneeId: string | null) => {
    if (!assigneeId) return null;
    const m = members.find((m: any) => m.userId === assigneeId || m.user?.id === assigneeId);
    return m?.user?.name || null;
  };

  /* ---- Milestone handlers (P3) ---- */
  const openMsCreate = () => { setEditingMsId(null); setMsForm({ name: '', description: '', dueDate: '' }); setShowMsForm(true); };
  const openMsEdit = (m: any) => {
    setEditingMsId(m.id);
    setMsForm({ name: m.name || '', description: m.description || '', dueDate: m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : '' });
    setShowMsForm(true);
  };
  const handleMsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMsId) {
      await fetch('/api/milestones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingMsId, ...msForm }) });
    } else {
      await fetch('/api/milestones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...msForm, projectId: project.id }) });
    }
    setShowMsForm(false); setMsForm({ name: '', description: '', dueDate: '' }); setEditingMsId(null); onRefresh();
  };
  const toggleMs = async (msId: string, completed: boolean) => {
    await fetch('/api/milestones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: msId, completed }) }); onRefresh();
  };
  const deleteMs = async (msId: string) => {
    if (!confirm('\u00bfEliminar este hito?')) return;
    await fetch(`/api/milestones?id=${msId}`, { method: 'DELETE' }); onRefresh();
  };

  // Gantt data
  const ganttData = useMemo(() => {
    const withDates = tasks.filter((t: any) => t.startDate || t.dueDate);
    if (withDates.length === 0) return null;
    const starts = withDates.map((t: any) => new Date(t.startDate || t.dueDate).getTime());
    const ends = withDates.map((t: any) => new Date(t.dueDate || t.startDate).getTime());
    const minDate = new Date(Math.min(...starts));
    const maxDate = new Date(Math.max(...ends));
    const totalDays = Math.max(1, Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
    return { tasks: withDates, minDate, maxDate, totalDays };
  }, [tasks]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
            <ListChecks className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">Actividades</h2>
              <SectionTooltip content="Gestione las actividades del proyecto. Alterne entre vista Tabla, Kanban, Gantt e Hitos. Asigne responsables del equipo del proyecto." />
            </div>
            <p className="text-sm text-gray-500">{done}/{total} completadas{milestones.length > 0 ? ` &middot; ${msDone}/${milestones.length} hitos` : ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode tabs (P3: added milestones) */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('table')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'table' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Table2 className="w-3.5 h-3.5" />Tabla
            </button>
            <button onClick={() => setViewMode('kanban')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'kanban' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Columns3 className="w-3.5 h-3.5" />Kanban
            </button>
            <button onClick={() => setViewMode('gantt')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'gantt' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <GanttChart className="w-3.5 h-3.5" />Gantt
            </button>
            <button onClick={() => setViewMode('milestones')} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${viewMode === 'milestones' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <Milestone className="w-3.5 h-3.5" />Hitos
              {milestones.length > 0 && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0 rounded-full">{milestones.length}</span>}
            </button>
          </div>
          {viewMode === 'milestones' ? (
            <button onClick={openMsCreate} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition">
              <Plus className="w-4 h-4" /> Hito
            </button>
          ) : (
            <button onClick={() => setCreating(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition">
              <Plus className="w-4 h-4" /> Nueva
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {viewMode !== 'milestones' && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[{ n: total, l: 'Total', c: 'text-gray-900' }, { n: done, l: 'Completadas', c: 'text-emerald-600' }, { n: inProgress, l: 'En progreso', c: 'text-blue-600' }, { n: overdue, l: 'Vencidas', c: overdue > 0 ? 'text-red-600' : 'text-gray-400' }].map(({ n, l, c }) => (
              <div key={l} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
                <p className={`text-2xl font-bold ${c}`}>{n}</p>
                <p className="text-xs text-gray-500 mt-1">{l}</p>
              </div>
            ))}
          </div>
          {/* Progress Bar */}
          {total > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progreso general</span>
                <span className="text-sm font-bold text-indigo-600">{Math.round((done / total) * 100)}%</span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all" style={{ width: `${(done / total) * 100}%` }} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Create row */}
      {creating && viewMode !== 'milestones' && (
        <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-200 space-y-3">
          <p className="text-sm font-semibold text-indigo-700">Nueva actividad</p>
          <input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} placeholder="T\u00edtulo de la actividad" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none" />
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <select value={newTask.status} onChange={e => setNewTask({ ...newTask, status: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white">
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white">
              {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
            </select>
            <select value={newTask.assigneeId} onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg border border-gray-200 bg-white">
              <option value="">Sin asignar</option>
              {members.map((m: any) => <option key={m.userId || m.user?.id} value={m.userId || m.user?.id}>{m.user?.name || m.userId}</option>)}
            </select>
            <input type="date" value={newTask.startDate} onChange={e => setNewTask({ ...newTask, startDate: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg border border-gray-200" title="Inicio" />
            <input type="date" value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg border border-gray-200" title="Vencimiento" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCreating(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={createTask} disabled={saving || !newTask.title.trim()} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Guardando...' : 'Crear'}</button>
          </div>
        </div>
      )}

      {/* === TABLE VIEW === */}
      {viewMode === 'table' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actividad</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-32">Estado</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Prioridad</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">Responsable</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Inicio</th>
                  <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-28">Vencimiento</th>
                  <th className="px-3 py-3 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {tasks.map((t: any) => {
                  const isEditing = editId === t.id;
                  const isOverdue = t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date();
                  const assigneeName = getMemberName(t.assigneeId);
                  return (
                    <tr key={t.id} className={`hover:bg-gray-50/50 transition ${isOverdue ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <input value={editData.title} onChange={e => setEditData({ ...editData, title: e.target.value })} className="w-full px-2 py-1 text-sm rounded border border-indigo-300 focus:ring-2 focus:ring-indigo-500 outline-none" autoFocus />
                        ) : (
                          <div className="flex items-center gap-2">
                            <button onClick={() => quickStatus(t.id, t.status === 'DONE' ? 'TODO' : 'DONE')} className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${t.status === 'DONE' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 hover:border-indigo-400'}`}>
                              {t.status === 'DONE' && <Check className="w-3 h-3" />}
                            </button>
                            <span className={`font-medium ${t.status === 'DONE' ? 'line-through text-gray-400' : 'text-gray-900'}`}>{t.title}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <select value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })} className="w-full px-2 py-1 text-xs rounded border border-indigo-300 bg-white">
                            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                          </select>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: getStatusColor(t.status) + '20', color: getStatusColor(t.status) }}>
                            {STATUS_LABELS[t.status] || t.status}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <select value={editData.priority} onChange={e => setEditData({ ...editData, priority: e.target.value })} className="w-full px-2 py-1 text-xs rounded border border-indigo-300 bg-white">
                            {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
                          </select>
                        ) : (
                          <span className="flex items-center gap-1.5 text-xs text-gray-600">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: getPriorityColor(t.priority) }} />
                            {PRIORITY_LABELS[t.priority] || t.priority}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <select value={editData.assigneeId || ''} onChange={e => setEditData({ ...editData, assigneeId: e.target.value })} className="w-full px-2 py-1 text-xs rounded border border-indigo-300 bg-white">
                            <option value="">Sin asignar</option>
                            {members.map((m: any) => <option key={m.userId || m.user?.id} value={m.userId || m.user?.id}>{m.user?.name || 'Miembro'}</option>)}
                          </select>
                        ) : (
                          assigneeName ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                {getInitials(assigneeName)}
                              </div>
                              <span className="text-xs text-gray-700 truncate">{assigneeName}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">\u2014</span>
                          )
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <input type="date" value={editData.startDate} onChange={e => setEditData({ ...editData, startDate: e.target.value })} className="px-2 py-1 text-xs rounded border border-indigo-300" />
                        ) : (
                          <span className="text-xs text-gray-500">{t.startDate ? formatDate(t.startDate) : '\u2014'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <input type="date" value={editData.dueDate} onChange={e => setEditData({ ...editData, dueDate: e.target.value })} className="px-2 py-1 text-xs rounded border border-indigo-300" />
                        ) : (
                          <span className={`text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}`}>{t.dueDate ? formatDate(t.dueDate) : '\u2014'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button onClick={saveEdit} disabled={saving} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(t)} className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded" title="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteTask(t.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {tasks.length === 0 && !creating && (
                  <tr>
                    <td colSpan={7} className="text-center py-12">
                      <ListChecks className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">No hay actividades a&uacute;n</p>
                      <button onClick={() => setCreating(true)} className="text-sm text-indigo-600 hover:underline mt-2">Crear primera actividad &rarr;</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* === KANBAN VIEW === */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KANBAN_COLS.map(col => {
            const colTasks = tasks.filter((t: any) => t.status === col);
            return (
              <div key={col} className="bg-gray-50 rounded-xl p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{STATUS_LABELS[col]}</span>
                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">{colTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {colTasks.map((t: any) => {
                    const assigneeName = getMemberName(t.assigneeId);
                    return (
                      <div key={t.id} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm hover:shadow-md transition">
                        <p className="text-sm font-medium text-gray-900 mb-1.5">{t.title}</p>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[10px] text-gray-500">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getPriorityColor(t.priority) }} />
                            {PRIORITY_LABELS[t.priority]}
                          </span>
                          {assigneeName && (
                            <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[8px] font-bold" title={assigneeName}>
                              {getInitials(assigneeName)}
                            </div>
                          )}
                        </div>
                        {t.dueDate && (
                          <p className={`text-[10px] mt-1 ${t.status !== 'DONE' && new Date(t.dueDate) < new Date() ? 'text-red-500' : 'text-gray-400'}`}>
                            <Calendar className="w-3 h-3 inline mr-0.5" />{formatDate(t.dueDate)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && <p className="text-[10px] text-gray-300 text-center py-4">Vac&iacute;o</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* === GANTT VIEW === */}
      {viewMode === 'gantt' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {!ganttData ? (
            <div className="text-center py-12">
              <GanttChart className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Agregue fechas a las actividades para ver el Gantt.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[600px] p-4">
                <div className="flex items-center mb-2 ml-48">
                  {Array.from({ length: Math.min(Math.ceil(ganttData.totalDays / 30) + 1, 12) }, (_, i) => {
                    const d = new Date(ganttData.minDate);
                    d.setDate(d.getDate() + i * 30);
                    return (
                      <div key={i} className="text-[9px] text-gray-400 font-medium" style={{ width: `${(30 / ganttData.totalDays) * 100}%`, minWidth: 40 }}>
                        {d.toLocaleDateString('es-UY', { month: 'short', year: '2-digit' })}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-1.5">
                  {ganttData.tasks.map((t: any) => {
                    const start = new Date(t.startDate || t.dueDate);
                    const end = new Date(t.dueDate || t.startDate);
                    const left = ((start.getTime() - ganttData.minDate.getTime()) / (ganttData.totalDays * 86400000)) * 100;
                    const width = Math.max(2, ((end.getTime() - start.getTime()) / (ganttData.totalDays * 86400000)) * 100);
                    const assigneeName = getMemberName(t.assigneeId);
                    return (
                      <div key={t.id} className="flex items-center gap-2">
                        <div className="w-48 flex-shrink-0 flex items-center gap-1.5">
                          <span className={`text-xs truncate ${t.status === 'DONE' ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{t.title}</span>
                          {assigneeName && (
                            <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[7px] font-bold flex-shrink-0" title={assigneeName}>
                              {getInitials(assigneeName)}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 bg-gray-50 rounded h-6 relative">
                          <div
                            className="absolute top-0.5 h-5 rounded transition-all"
                            style={{
                              left: `${left}%`,
                              width: `${width}%`,
                              backgroundColor: t.status === 'DONE' ? '#10b981' : getStatusColor(t.status),
                              opacity: 0.8,
                            }}
                            title={`${t.title}: ${formatDate(t.startDate || t.dueDate)} - ${formatDate(t.dueDate || t.startDate)}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === MILESTONES VIEW (P3) === */}
      {viewMode === 'milestones' && (
        <div>
          {/* Milestone summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Total Hitos</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{milestones.length}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Completados</p>
              <p className="text-2xl font-bold text-emerald-600 mt-1">{msDone}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Pendientes</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{milestones.length - msDone}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Hitos del Proyecto</h3>
                <SectionTooltip content="Los hitos marcan puntos clave de entrega o verificaci&oacute;n del proyecto. Pueden vincularse a entregables del donante." />
              </div>
              <Link href={`/siep/projects/${project.id}/gantt`} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
                <GanttChart className="w-4 h-4" />Gantt
              </Link>
            </div>

            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-3">
                {milestones.map((m: any, i: number) => (
                  <div key={m?.id ?? i} className="relative flex items-start gap-4 pl-10">
                    <button onClick={() => toggleMs(m?.id, !m?.completed)} className={`absolute left-2.5 w-3 h-3 rounded-full border-2 cursor-pointer hover:scale-125 transition ${m?.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-300'}`} />
                    <div className="flex-1 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                      <div className="flex items-center justify-between">
                        <span className={`font-medium text-sm ${m?.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{m?.name ?? ''}</span>
                        <div className="flex items-center gap-2">
                          {m?.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                          <button onClick={() => openMsEdit(m)} className="text-gray-400 hover:text-indigo-600"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteMs(m?.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      {m?.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                      <p className="text-xs text-gray-400 mt-1">{formatDate(m?.dueDate)}{m?.completedAt ? ` &middot; Completado: ${formatDate(m.completedAt)}` : ''}</p>
                    </div>
                  </div>
                ))}
                {milestones.length === 0 && <p className="text-sm text-gray-400 text-center py-6 pl-10">Sin hitos definidos a&uacute;n</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Form Modal (P3) */}
      {showMsForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editingMsId ? 'Editar Hito' : 'Nuevo Hito'}</h2>
              <button onClick={() => { setShowMsForm(false); setEditingMsId(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleMsSubmit} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nombre *</label><input required value={msForm.name} onChange={e => setMsForm({ ...msForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Descripci&oacute;n</label><textarea value={msForm.description} onChange={e => setMsForm({ ...msForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Fecha L&iacute;mite</label><input type="date" value={msForm.dueDate} onChange={e => setMsForm({ ...msForm, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowMsForm(false); setEditingMsId(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{editingMsId ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
