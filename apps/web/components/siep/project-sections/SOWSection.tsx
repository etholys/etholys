'use client';

import { useState, useEffect, useCallback } from 'react';
import { SectionProps } from './types';
import SectionTooltip from './SectionTooltip';
import { Save, ChevronDown, ChevronRight, FileText, Plus, Trash2, X, Check, AlertCircle, Edit2 } from 'lucide-react';

interface SOWSec {
  id: string;
  sectionKey: string;
  title: string;
  content: string;
  order: number;
}

const SECTION_ICONS: Record<string, string> = {
  background: '\ud83d\udcdc',
  objectives: '\ud83c\udfaf',
  methodology: '\ud83d\udee0\ufe0f',
  deliverables: '\ud83d\udce6',
  scope: '\ud83c\udf0d',
  target: '\ud83d\udc65',
  partners: '\ud83e\udd1d',
  assumptions: '\u26a0\ufe0f',
};

const SECTION_HINTS: Record<string, string> = {
  background: 'Contexto del problema o necesidad que el proyecto busca abordar. Incluya datos estad\u00edsticos relevantes.',
  objectives: 'Objetivo general y espec\u00edficos del proyecto. Deben ser SMART (espec\u00edficos, medibles, alcanzables, relevantes, temporales).',
  methodology: 'Enfoque t\u00e9cnico, estrategia de implementaci\u00f3n, m\u00e9todos y herramientas a utilizar.',
  deliverables: 'Productos concretos y medibles que el proyecto entregar\u00e1. Incluya plazos estimados.',
  scope: '\u00c1rea geogr\u00e1fica de intervenci\u00f3n: pa\u00edses, regiones, municipios, comunidades.',
  target: 'Beneficiarios directos e indirectos. Incluya datos demogr\u00e1ficos y criterios de selecci\u00f3n.',
  partners: 'Organizaciones socias, subcontratistas y su rol en la implementaci\u00f3n.',
  assumptions: 'Supuestos cr\u00edticos para el \u00e9xito del proyecto y condiciones previas necesarias.',
};

/* Sections that benefit from tabular (line-by-line) editing */
const TABULAR_SECTIONS = ['objectives', 'deliverables', 'scope', 'target', 'partners', 'assumptions'];

/* Parse content into individual items (split by newlines or bullet points) */
function parseItems(content: string): string[] {
  if (!content.trim()) return [];
  return content
    .split(/\n/)
    .map(line => line.replace(/^\s*[\u2022\u2023\u25E6\u2043\u2219*\-]\s*/, '').trim())
    .filter(line => line.length > 0);
}

/* Reconstruct content from items */
function joinItems(items: string[]): string {
  return items.filter(i => i.trim()).map(i => `\u2022 ${i}`).join('\n');
}

export default function SOWSection({ project, tr }: SectionProps) {
  const [sections, setSections] = useState<SOWSec[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSection, setNewSection] = useState({ sectionKey: '', title: '' });

  /* Inline item editing for tabular sections */
  const [editingItemIdx, setEditingItemIdx] = useState<{ secId: string; idx: number } | null>(null);
  const [editingItemValue, setEditingItemValue] = useState('');

  const fetchSections = useCallback(() => {
    fetch(`/api/sow?projectId=${project.id}`)
      .then(r => r.json())
      .then(d => { setSections(d?.sections ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [project.id]);

  useEffect(() => { fetchSections(); }, [fetchSections]);

  const toggle = (id: string) => {
    setExpanded(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const startEdit = (sec: SOWSec) => {
    setEditing(sec.id);
    setEditContent(sec.content);
    if (!expanded.has(sec.id)) toggle(sec.id);
  };

  const handleSave = async (id: string, content?: string) => {
    setSaving(true);
    await fetch('/api/sow', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content: content ?? editContent }),
    });
    setSaving(false);
    setEditing(null);
    setSaved(id);
    setTimeout(() => setSaved(null), 2000);
    fetchSections();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('\u00bfEliminar esta secci\u00f3n?')) return;
    await fetch(`/api/sow?id=${id}`, { method: 'DELETE' });
    fetchSections();
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/sow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId: project.id, ...newSection }),
    });
    setShowAddForm(false);
    setNewSection({ sectionKey: '', title: '' });
    fetchSections();
  };

  /* Tabular item operations */
  const saveItemEdit = async (sec: SOWSec, idx: number, newValue: string) => {
    const items = parseItems(sec.content);
    items[idx] = newValue.trim();
    const content = joinItems(items.filter(i => i));
    await handleSave(sec.id, content);
    setEditingItemIdx(null);
  };

  const addItem = async (sec: SOWSec) => {
    const items = parseItems(sec.content);
    items.push('Nuevo elemento');
    const content = joinItems(items);
    await handleSave(sec.id, content);
  };

  const removeItem = async (sec: SOWSec, idx: number) => {
    const items = parseItems(sec.content);
    items.splice(idx, 1);
    const content = joinItems(items);
    await handleSave(sec.id, content);
  };

  const filledCount = sections.filter(s => s.content.trim().length > 0).length;
  const completionPct = sections.length > 0 ? Math.round((filledCount / sections.length) * 100) : 0;

  if (loading) return <div className="flex items-center justify-center h-32"><div className="w-6 h-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Header + Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">Scope of Work (SOW)</h3>
            <SectionTooltip content="El SOW describe el alcance, objetivos, metodolog&iacute;a y entregables del proyecto. Complete cada secci&oacute;n. Las secciones tipo lista permiten edici&oacute;n inline por elemento." />
          </div>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition">
            <Plus className="w-4 h-4" />Secci&oacute;n
          </button>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="text-xs font-medium text-gray-500">{filledCount}/{sections.length} secciones</span>
        </div>
        {completionPct < 100 && (
          <p className="text-[10px] text-amber-600 flex items-center gap-1 mt-1">
            <AlertCircle className="w-3 h-3" />Complete todas las secciones para tener un SOW listo.
          </p>
        )}
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {sections.map(sec => {
          const isExpanded = expanded.has(sec.id);
          const isEditing = editing === sec.id;
          const icon = SECTION_ICONS[sec.sectionKey] || '\ud83d\udcdd';
          const hint = SECTION_HINTS[sec.sectionKey] || '';
          const hasContent = sec.content.trim().length > 0;
          const isTabular = TABULAR_SECTIONS.includes(sec.sectionKey);
          const items = isTabular ? parseItems(sec.content) : [];

          return (
            <div key={sec.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggle(sec.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition group"
              >
                <span className="text-lg flex-shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{sec.title}</p>
                  {!isExpanded && hasContent && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {isTabular ? `${items.length} elemento${items.length !== 1 ? 's' : ''}` : sec.content.substring(0, 100) + '...'}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {saved === sec.id && (
                    <span className="text-xs text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" />Guardado</span>
                  )}
                  {hasContent ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="Completada" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" title="Pendiente" />
                  )}
                  {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4">
                  {hint && !isEditing && (
                    <p className="text-xs text-gray-400 italic mb-3 bg-gray-50 px-3 py-2 rounded-lg">
                      \ud83d\udca1 {hint}
                    </p>
                  )}

                  {/* TABULAR mode for list sections */}
                  {isTabular && !isEditing ? (
                    <div>
                      {items.length > 0 ? (
                        <div className="space-y-1">
                          {items.map((item, idx) => {
                            const isEditingThis = editingItemIdx?.secId === sec.id && editingItemIdx?.idx === idx;
                            return (
                              <div key={idx} className="flex items-center gap-2 group rounded-lg border border-gray-100 hover:border-indigo-200 transition">
                                <span className="text-[10px] text-gray-400 font-mono w-7 text-center flex-shrink-0 py-2">{idx + 1}</span>
                                {isEditingThis ? (
                                  <input
                                    value={editingItemValue}
                                    onChange={e => setEditingItemValue(e.target.value)}
                                    className="flex-1 px-2 py-2 text-sm border-0 focus:ring-0 outline-none bg-indigo-50/50"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveItemEdit(sec, idx, editingItemValue);
                                      if (e.key === 'Escape') setEditingItemIdx(null);
                                    }}
                                  />
                                ) : (
                                  <p className="flex-1 text-sm text-gray-700 px-2 py-2 cursor-pointer hover:bg-gray-50 rounded" onClick={() => { setEditingItemIdx({ secId: sec.id, idx }); setEditingItemValue(item); }}>
                                    {item}
                                  </p>
                                )}
                                <div className="flex gap-0.5 pr-2 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                                  {isEditingThis ? (
                                    <>
                                      <button onClick={() => saveItemEdit(sec, idx, editingItemValue)} className="p-1 rounded hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => setEditingItemIdx(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X className="w-3.5 h-3.5" /></button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={() => { setEditingItemIdx({ secId: sec.id, idx }); setEditingItemValue(item); }} className="p-1 rounded hover:bg-indigo-50 text-gray-400 hover:text-indigo-600"><Edit2 className="w-3 h-3" /></button>
                                      <button onClick={() => removeItem(sec, idx)} className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Sin elementos a&uacute;n.</p>
                      )}
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <button onClick={() => addItem(sec)} className="text-xs text-indigo-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-indigo-50">
                            <Plus className="w-3 h-3" />Agregar elemento
                          </button>
                          <button onClick={() => startEdit(sec)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-50">
                            <FileText className="w-3 h-3" />Editar todo
                          </button>
                        </div>
                        <button onClick={() => handleDelete(sec.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                          <Trash2 className="w-3 h-3" />Eliminar
                        </button>
                      </div>
                    </div>
                  ) : isEditing ? (
                    /* Full textarea editing mode */
                    <div className="space-y-3">
                      <textarea
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                        rows={10}
                        className="w-full px-4 py-3 rounded-lg border border-indigo-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-y"
                        placeholder={hint || 'Escriba el contenido de esta secci\u00f3n...'}
                        autoFocus
                      />
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-gray-400">{editContent.length} caracteres</span>
                        <div className="flex gap-2">
                          <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                          <button onClick={() => handleSave(sec.id)} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition disabled:opacity-50">
                            <Save className="w-3.5 h-3.5" />{saving ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Non-tabular display mode */
                    <div>
                      {hasContent ? (
                        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">{sec.content}</div>
                      ) : (
                        <p className="text-sm text-gray-400 italic">Sin contenido a\u00fan. Haga clic en &quot;Editar&quot; para completar esta secci&oacute;n.</p>
                      )}
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                        <button onClick={() => handleDelete(sec.id)} className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1 transition">
                          <Trash2 className="w-3 h-3" />Eliminar
                        </button>
                        <button onClick={() => startEdit(sec)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                          <FileText className="w-3.5 h-3.5" />Editar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sections.length === 0 && (
        <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No hay secciones del SOW.</p>
        </div>
      )}

      {/* Add Section Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-semibold">Nueva Secci&oacute;n SOW</h2>
              <button onClick={() => setShowAddForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Clave de secci&oacute;n *</label>
                <input required value={newSection.sectionKey} onChange={e => setNewSection({ ...newSection, sectionKey: e.target.value })} placeholder="ej: sustainability, monitoring..." className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">T&iacute;tulo *</label>
                <input required value={newSection.title} onChange={e => setNewSection({ ...newSection, title: e.target.value })} placeholder="ej: Plan de Sostenibilidad" className="w-full px-3 py-2 rounded-lg border text-sm" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{tr('general.cancel')}</button>
                <button type="submit" className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium">{tr('general.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
