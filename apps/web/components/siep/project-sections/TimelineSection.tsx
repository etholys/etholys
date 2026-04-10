'use client';

import { useState } from 'react';
import { SectionProps } from './types';
import SectionTooltip from './SectionTooltip';
import { formatDate } from '@/lib/utils';
import { Plus, Trash2, CheckCircle2, Circle, X, GanttChart, Edit3 } from 'lucide-react';
import Link from 'next/link';

export default function TimelineSection({ project, onRefresh, tr }: SectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ name: '', description: '', dueDate: '' });

  const openCreate = () => { setEditingId(null); setForm({ name: '', description: '', dueDate: '' }); setShowForm(true); };
  const openEdit = (m: any) => {
    setEditingId(m.id);
    setForm({ name: m.name || '', description: m.description || '', dueDate: m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      await fetch('/api/milestones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editingId, ...form }) });
    } else {
      await fetch('/api/milestones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, projectId: project.id }) });
    }
    setShowForm(false); setForm({ name: '', description: '', dueDate: '' }); setEditingId(null); onRefresh();
  };

  const toggleMilestone = async (msId: string, completed: boolean) => {
    await fetch('/api/milestones', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: msId, completed }) }); onRefresh();
  };

  const deleteMilestone = async (msId: string) => {
    if (!confirm(tr('general.confirm') + '?')) return;
    await fetch(`/api/milestones?id=${msId}`, { method: 'DELETE' }); onRefresh();
  };

  const total = project?.milestones?.length ?? 0;
  const done = (project?.milestones ?? []).filter((m: any) => m?.completed).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Total Hitos</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Completados</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{done}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-500 font-medium">Pendientes</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{total - done}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Hitos del Proyecto</h3>
            <SectionTooltip title="Cronograma" content="Los hitos marcan puntos clave de entrega o verificaci&oacute;n del proyecto. Pueden vincularse a entregables del donante. Use la vista Gantt para visualizar la l&iacute;nea de tiempo completa." />
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/siep/projects/${project.id}/gantt`} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
              <GanttChart className="w-4 h-4" />Gantt
            </Link>
            <button onClick={openCreate} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
              <Plus className="w-4 h-4" />{tr('general.create')}
            </button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
          <div className="space-y-3">
            {(project?.milestones ?? []).map((m: any, i: number) => (
              <div key={m?.id ?? i} className="relative flex items-start gap-4 pl-10">
                <button onClick={() => toggleMilestone(m?.id, !m?.completed)} className={`absolute left-2.5 w-3 h-3 rounded-full border-2 cursor-pointer hover:scale-125 transition ${m?.completed ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-gray-300'}`} />
                <div className="flex-1 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium text-sm ${m?.completed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{m?.name ?? ''}</span>
                    <div className="flex items-center gap-2">
                      {m?.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}
                      <button onClick={() => openEdit(m)} className="text-gray-400 hover:text-indigo-600"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteMilestone(m?.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {m?.description && <p className="text-xs text-gray-500 mt-1">{m.description}</p>}
                  <p className="text-xs text-gray-400 mt-1">{formatDate(m?.dueDate)}{m?.completedAt ? ` &middot; Completado: ${formatDate(m.completedAt)}` : ''}</p>
                </div>
              </div>
            ))}
            {total === 0 && <p className="text-sm text-gray-400 text-center py-6 pl-10">Sin hitos definidos a&uacute;n</p>}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b"><h2 className="text-lg font-semibold">{editingId ? 'Editar Hito' : 'Nuevo Hito'}</h2><button onClick={() => { setShowForm(false); setEditingId(null); }}><X className="w-5 h-5 text-gray-400" /></button></div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nombre *</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Descripci&oacute;n</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">Fecha L&iacute;mite</label><input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{editingId ? 'Guardar' : tr('general.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
