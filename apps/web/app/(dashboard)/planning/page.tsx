'use client';

import { useState, useEffect, useMemo } from 'react';
import { useApp } from '@/app/providers';
import { Target, Plus, X, Save, Calendar, TrendingUp, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, Trash2, Edit2, Building2 } from 'lucide-react';

interface Goal {
  id: string;
  title: string;
  description: string;
  area: string;
  quarter: string;
  responsible: string;
  kpiTarget: string;
  kpiCurrent: string;
  status: 'pending' | 'in_progress' | 'completed' | 'at_risk';
  priority: 'low' | 'medium' | 'high';
  actions: { text: string; done: boolean }[];
}

const AREAS = ['Finanzas', 'Operaciones', 'RRHH', 'Comercial', 'Tecnolog\u00eda', 'Legal', 'Marketing', 'Gobernanza'];
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4', 'Anual'];
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente', color: 'text-gray-600', bg: 'bg-gray-100' },
  in_progress: { label: 'En progreso', color: 'text-blue-600', bg: 'bg-blue-50' },
  completed: { label: 'Completado', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  at_risk: { label: 'En riesgo', color: 'text-red-600', bg: 'bg-red-50' },
};


type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function PlanningPage() {
  const {activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [goals, setGoals] = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<Omit<Goal, 'id'>>({ title: '', description: '', area: 'Finanzas', quarter: 'Q1', responsible: '', kpiTarget: '', kpiCurrent: '', status: 'pending', priority: 'medium', actions: [] });
  const [newAction, setNewAction] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterQuarter, setFilterQuarter] = useState('');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  // Persist goals in localStorage per company
  const storageKey = `etholys_planning_${activeCompanyId || 'all'}`;
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setGoals(JSON.parse(saved));
      else setGoals([]);
    } catch { setGoals([]); }
  }, [storageKey]);

  useEffect(() => {
    if (goals.length > 0 || localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, JSON.stringify(goals));
    }
  }, [goals, storageKey]);

  useEffect(() => {
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d?.users ?? [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => goals.filter(g => {
    if (filterArea && g.area !== filterArea) return false;
    if (filterQuarter && g.quarter !== filterQuarter) return false;
    return true;
  }), [goals, filterArea, filterQuarter]);

  const stats = useMemo(() => ({
    total: goals.length,
    completed: goals.filter(g => g.status === 'completed').length,
    inProgress: goals.filter(g => g.status === 'in_progress').length,
    atRisk: goals.filter(g => g.status === 'at_risk').length,
  }), [goals]);

  const handleSave = () => {
    if (!form.title) return;
    const goal: Goal = { ...form, id: editIdx !== null ? goals[editIdx].id : Date.now().toString() };
    if (editIdx !== null) {
      const updated = [...goals];
      updated[editIdx] = goal;
      setGoals(updated);
    } else {
      setGoals([...goals, goal]);
    }
    setShowForm(false);
    setEditIdx(null);
    setForm({ title: '', description: '', area: 'Finanzas', quarter: 'Q1', responsible: '', kpiTarget: '', kpiCurrent: '', status: 'pending', priority: 'medium', actions: [] });
  };

  const removeGoal = (idx: number) => {
    if (confirm('\u00bfEliminar este objetivo?')) setGoals(goals.filter((_, i) => i !== idx));
  };

  const toggleAction = (goalIdx: number, actionIdx: number) => {
    const updated = [...goals];
    updated[goalIdx].actions[actionIdx].done = !updated[goalIdx].actions[actionIdx].done;
    setGoals(updated);
  };

  const addActionToForm = () => {
    if (!newAction.trim()) return;
    setForm({ ...form, actions: [...form.actions, { text: newAction, done: false }] });
    setNewAction('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Target className="w-6 h-6 text-teal-600" />Planificaci\u00f3n Empresarial</h1>
          <p className="text-gray-500 text-sm">Objetivos estrat\u00e9gicos y planificaci\u00f3n anual</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditIdx(null); setForm({ title: '', description: '', area: 'Finanzas', quarter: 'Q1', responsible: '', kpiTarget: '', kpiCurrent: '', status: 'pending', priority: 'medium', actions: [] }); }} className="flex items-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition font-medium text-sm">
          <Plus className="w-4 h-4" />Nuevo Objetivo
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: L(ml('Total', 'Total', 'Total')), value: stats.total, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: L(ml('In progress','En progreso','Em progresso')), value: stats.inProgress, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: L(ml('Completed','Completados','Concluídos')), value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: L(ml('At risk','En riesgo','Em risco')), value: stats.atRisk, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filterArea} onChange={e => setFilterArea(e.target.value)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">
          <option value="">{L(ml('All areas','Todas las áreas','Todas as áreas'))}</option>
          {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterQuarter} onChange={e => setFilterQuarter(e.target.value)} className="px-4 py-2 rounded-lg border border-gray-200 text-sm">
          <option value="">{L(ml('All periods','Todos los periodos','Todos os períodos'))}</option>
          {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
        </select>
      </div>

      {/* Goals list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{L(ml('No goals defined yet.','No hay objetivos definidos aún.','Nenhum objetivo definido ainda.'))}</p>
            <p className="text-sm">Crea tu primer objetivo estrat\u00e9gico para comenzar la planificaci\u00f3n.</p>
          </div>
        ) : filtered.map((goal, idx) => {
          const realIdx = goals.findIndex(g => g.id === goal.id);
          const st = STATUS_CONFIG[goal.status];
          const progress = goal.actions.length > 0 ? Math.round((goal.actions.filter(a => a.done).length / goal.actions.length) * 100) : 0;
          const expanded = expandedGoal === goal.id;
          return (
            <div key={goal.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 cursor-pointer hover:bg-gray-50 transition" onClick={() => setExpandedGoal(expanded ? null : goal.id)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <button className="mt-0.5 text-gray-400">{expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.bg} ${st.color}`}>{st.label}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{goal.area}</span>
                        <span className="px-2 py-0.5 rounded-full text-xs bg-teal-50 text-teal-700">{goal.quarter}</span>
                        {goal.priority === 'high' && <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600">Alta prioridad</span>}
                      </div>
                      <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                      {goal.responsible && <p className="text-xs text-gray-400 mt-0.5">Responsable: {goal.responsible}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {goal.actions.length > 0 && (
                      <div className="text-right">
                        <span className="text-xs text-gray-500">{progress}%</span>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full mt-0.5">
                          <div className="h-full bg-teal-500 rounded-full" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                    <button onClick={e => { e.stopPropagation(); setEditIdx(realIdx); setForm({ ...goal }); setShowForm(true); }} className="text-gray-400 hover:text-teal-600"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={e => { e.stopPropagation(); removeGoal(realIdx); }} className="text-gray-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
              {expanded && (
                <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                  {goal.description && <p className="text-sm text-gray-600">{goal.description}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">KPI Meta</p><p className="text-sm font-medium">{goal.kpiTarget || '-'}</p></div>
                    <div className="p-3 bg-gray-50 rounded-lg"><p className="text-xs text-gray-500">KPI Actual</p><p className="text-sm font-medium">{goal.kpiCurrent || '-'}</p></div>
                  </div>
                  {goal.actions.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Acciones ({goal.actions.filter(a => a.done).length}/{goal.actions.length})</p>
                      <div className="space-y-1">
                        {goal.actions.map((action, aIdx) => (
                          <label key={aIdx} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input type="checkbox" checked={action.done} onChange={() => toggleAction(realIdx, aIdx)} className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                            <span className={`text-sm ${action.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{action.text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditIdx(null); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{editIdx !== null ? 'Editar Objetivo' : 'Nuevo Objetivo Estrat\u00e9gico'}</h2>
              <button onClick={() => { setShowForm(false); setEditIdx(null); }}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">T\u00edtulo *</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Descripci\u00f3n</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500 outline-none" /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">\u00c1rea</label><select value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">{AREAS.map(a => <option key={a} value={a}>{a}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Per\u00edodo</label><select value={form.quarter} onChange={e => setForm({ ...form, quarter: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">{QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}</select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Prioridad</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border text-sm"><option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('Responsible','Responsable','Responsável'))}</label>
                  <select value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                    <option value="">-</option>
                    {users.map((u: any) => <option key={u?.id} value={u?.name || ''}>{u?.name}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Estado</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as any })} className="w-full px-3 py-2 rounded-lg border text-sm"><option value="pending">Pendiente</option><option value="in_progress">En progreso</option><option value="completed">Completado</option><option value="at_risk">En riesgo</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('KPI Target','KPI Meta','KPI Meta'))}</label><input value={form.kpiTarget} onChange={e => setForm({ ...form, kpiTarget: e.target.value })} placeholder="ej: Aumentar ventas 20%" className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">{L(ml('KPI Current','KPI Actual','KPI Atual'))}</label><input value={form.kpiCurrent} onChange={e => setForm({ ...form, kpiCurrent: e.target.value })} placeholder="ej: 12% completado" className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Acciones / Actividades</label>
                <div className="space-y-1 mb-2">
                  {form.actions.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="flex-1">{a.text}</span>
                      <button type="button" onClick={() => setForm({ ...form, actions: form.actions.filter((_, j) => j !== i) })} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newAction} onChange={e => setNewAction(e.target.value)} placeholder="Nueva acci\u00f3n..." className="flex-1 px-3 py-1.5 rounded-lg border text-sm" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addActionToForm())} />
                  <button type="button" onClick={addActionToForm} className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm hover:bg-gray-200"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => { setShowForm(false); setEditIdx(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{L(ml("Cancel","Cancelar","Cancelar"))}</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium">{L(ml("Save","Guardar","Salvar"))}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
