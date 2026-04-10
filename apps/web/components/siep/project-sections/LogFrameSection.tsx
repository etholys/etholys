'use client';

import { useState, useMemo } from 'react';
import { SectionProps } from './types';
import SectionTooltip from './SectionTooltip';
import { Plus, X, Save, Link2 } from 'lucide-react';
import DiamantLogico from './DiamantLogico';

/* ================================================================
   ALL NODE TYPES
   ================================================================ */
interface NodeType { value: string; label: string; color: string }

const ALL_TYPES: NodeType[] = [
  { value: 'problem_statement', label: 'Problema', color: '#475569' },
  { value: 'need', label: 'Necesidad', color: '#64748b' },
  { value: 'input', label: 'Insumo / Recurso', color: '#3b82f6' },
  { value: 'activity', label: 'Actividad', color: '#6366f1' },
  { value: 'output', label: 'Producto / Output', color: '#7c3aed' },
  { value: 'deliverable', label: 'Entregable', color: '#059669' },
  { value: 'objective', label: 'Obj. Espec\u00edfico', color: '#4f46e5' },
  { value: 'outcome', label: 'Resultado / Outcome', color: '#2563eb' },
  { value: 'goal', label: 'Meta del Proyecto', color: '#1d4ed8' },
  { value: 'impact', label: 'Impacto', color: '#1e40af' },
  { value: 'assumption', label: 'Supuesto', color: '#8b5cf6' },
  { value: 'external_factor', label: 'Factor Externo', color: '#a78bfa' },
];

const getLabel = (type: string) => ALL_TYPES.find(t => t.value === type)?.label || type;

/* ================================================================
   MAIN COMPONENT — Diamante L\u00f3gico only (tree view removed)
   ================================================================ */
export default function LogFrameSection({ project, onRefresh, tr }: SectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [parentId, setParentId] = useState<string | null>(null);
  const [formLane, setFormLane] = useState<string>('');
  const [form, setForm] = useState<any>({ type: 'objective', code: '', title: '', description: '' });
  const [linkMode, setLinkMode] = useState(false);
  const [linkSelectedId, setLinkSelectedId] = useState('');
  const [editSwimObj, setEditSwimObj] = useState<any>(null);

  /* Flatten all objectives (recursive) */
  const flatObjs = useMemo(() => {
    const list: any[] = [];
    const walk = (objs: any[]) => { (objs ?? []).forEach(o => { list.push(o); if (o.children?.length) walk(o.children); }); };
    walk(project?.objectives ?? []);
    return list.filter(o => o.type !== 'indicator');
  }, [project?.objectives]);

  /* Linkable items */
  const linkableItems = useMemo(() => {
    const items: { id: string; label: string; type: string; title: string; description: string; code: string }[] = [];
    (project?.tasks ?? []).forEach((t: any) => {
      items.push({ id: `task:${t.id}`, label: `[Actividad] ${t.title}`, type: 'activity', title: t.title, description: t.description || '', code: '' });
    });
    (project?.milestones ?? []).forEach((m: any) => {
      items.push({ id: `ms:${m.id}`, label: `[Hito] ${m.name}`, type: 'deliverable', title: m.name, description: m.description || '', code: '' });
    });
    (project?.risks ?? []).forEach((r: any) => {
      items.push({ id: `risk:${r.id}`, label: `[Riesgo] ${r.title}`, type: 'assumption', title: r.title, description: r.description || '', code: '' });
    });
    return items;
  }, [project?.tasks, project?.milestones, project?.risks]);

  /* Types filtered by lane for modal dropdown */
  const formTypes = formLane
    ? ALL_TYPES.filter(t => {
        const LANE_MAP: Record<string, string[]> = {
          diagnosis: ['problem_statement', 'need'],
          execution: ['input', 'activity', 'output', 'deliverable'],
          results: ['objective', 'outcome', 'goal', 'impact'],
          context: ['assumption', 'external_factor'],
        };
        return LANE_MAP[formLane]?.includes(t.value);
      })
    : ALL_TYPES;

  /* ---- Handlers ---- */
  const openCreate = (pid: string | null, type: string, lane?: string) => {
    setParentId(pid);
    setFormLane(lane || '');
    setForm({ type, code: '', title: '', description: '' });
    setLinkMode(false);
    setLinkSelectedId('');
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/objectives', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, projectId: project.id, parentId }) });
    setShowForm(false); onRefresh();
  };

  const handleInlineSave = async (id: string, data: any) => {
    await fetch('/api/objectives', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...data }) });
    setEditSwimObj(null);
    onRefresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('\u00bfEliminar este elemento y sus hijos?')) return;
    await fetch(`/api/objectives?id=${id}`, { method: 'DELETE' }); onRefresh();
  };

  const handleSwimEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editSwimObj) return;
    await fetch('/api/objectives', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editSwimObj.id, title: editSwimObj.title, code: editSwimObj.code, description: editSwimObj.description }),
    });
    setEditSwimObj(null);
    onRefresh();
  };

  const objCount = flatObjs.length;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Marco L&oacute;gico &mdash; Diamante L&oacute;gico</h3>
            <SectionTooltip title="Diamante L&oacute;gico" content="Visualiza el flujo vertical del proyecto: desde problemas y necesidades, pasando por la cadena de ejecuci&oacute;n, hasta objetivos, resultados y metas. Supuestos y factores externos aparecen en el panel lateral." />
          </div>
        </div>

        {/* Diamante L\u00f3gico */}
        <DiamantLogico
          objectives={project?.objectives ?? []}
          onDelete={handleDelete}
          onCreate={openCreate}
          onInlineSave={handleInlineSave}
        />
      </div>

      {/* ============ CREATE MODAL ============ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">{linkMode ? 'Vincular existente' : `Nuevo ${getLabel(form.type)}`}</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {linkableItems.length > 0 && (
              <div className="px-5 pt-4 pb-0">
                <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
                  <button type="button" onClick={() => { setLinkMode(false); setLinkSelectedId(''); }}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${!linkMode ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Plus className="w-3.5 h-3.5" />Crear nuevo
                  </button>
                  <button type="button" onClick={() => setLinkMode(true)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${linkMode ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                    <Link2 className="w-3.5 h-3.5" />Vincular existente
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSave} className="p-5 space-y-3">
              {linkMode ? (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Seleccionar elemento existente</label>
                    <select value={linkSelectedId} onChange={e => { const val = e.target.value; setLinkSelectedId(val); const item = linkableItems.find(i => i.id === val); if (item) setForm({ type: item.type, code: item.code, title: item.title, description: item.description }); }} className="w-full px-3 py-2 rounded-lg border text-sm">
                      <option value="">Seleccionar...</option>
                      {linkableItems.map(item => (<option key={item.id} value={item.id}>{item.label}</option>))}
                    </select>
                  </div>
                  {linkSelectedId && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                            {formTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">C&oacute;digo</label>
                          <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="OE1, R1.1..." className="w-full px-3 py-2 rounded-lg border text-sm" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">T&iacute;tulo *</label>
                        <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Descripci&oacute;n</label>
                        <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                      <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
                        {formTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">C&oacute;digo</label>
                      <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="OE1, R1.1..." className="w-full px-3 py-2 rounded-lg border text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">T&iacute;tulo *</label>
                    <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripci&oacute;n</label>
                    <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border text-sm" />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" disabled={linkMode && !linkSelectedId} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed">
                  {linkMode ? 'Vincular' : tr('general.create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ EDIT MODAL ============ */}
      {editSwimObj && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Editar</h2>
              <button onClick={() => setEditSwimObj(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSwimEditSave} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">C&oacute;digo</label>
                <input value={editSwimObj.code || ''} onChange={e => setEditSwimObj({ ...editSwimObj, code: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">T&iacute;tulo *</label>
                <input required value={editSwimObj.title || ''} onChange={e => setEditSwimObj({ ...editSwimObj, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Descripci&oacute;n</label>
                <textarea value={editSwimObj.description || ''} onChange={e => setEditSwimObj({ ...editSwimObj, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-3">
                <button type="button" onClick={() => setEditSwimObj(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium flex items-center gap-1.5">
                  <Save className="w-4 h-4" />{tr('general.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
