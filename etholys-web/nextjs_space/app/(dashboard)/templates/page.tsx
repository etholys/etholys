'use client';

import { useState, useEffect } from 'react';
import { useApp } from '@/app/providers';
import { Copy, Plus, Trash2, Edit2, Save, X, FileStack, ChevronDown, ChevronRight, Play } from 'lucide-react';

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });

const UI = {
  title: ml('Task Templates', 'Plantillas de Tareas', 'Modelos de Tarefas'),
  subtitle: ml('Create reusable templates to standardize workflows', 'Crea plantillas reutilizables para estandarizar flujos de trabajo', 'Crie modelos reutilizáveis para padronizar fluxos de trabalho'),
  newTemplate: ml('New Template', 'Nueva Plantilla', 'Novo Modelo'),
  editTemplate: ml('Edit template', 'Editar plantilla', 'Editar modelo'),
  newTemplateForm: ml('New template', 'Nueva plantilla', 'Novo modelo'),
  templateName: ml('Template name', 'Nombre de la plantilla', 'Nome do modelo'),
  category: ml('Category (e.g., Agro, Admin)', 'Categoría (ej: Agro, Admin)', 'Categoria (ex: Agro, Admin)'),
  description: ml('Description', 'Descripción', 'Descrição'),
  globalAll: ml('Global (all companies)', 'Global (todas las empresas)', 'Global (todas as empresas)'),
  templateTasks: ml('Template tasks', 'Tareas de la plantilla', 'Tarefas do modelo'),
  addTask: ml('Add task', 'Agregar tarea', 'Adicionar tarefa'),
  taskTitle: ml('Task title', 'Título de la tarea', 'Título da tarefa'),
  low: ml('Low', 'Baja', 'Baixa'),
  medium: ml('Medium', 'Media', 'Média'),
  high: ml('High', 'Alta', 'Alta'),
  critical: ml('Critical', 'Crítica', 'Crítica'),
  cancel: ml('Cancel', 'Cancelar', 'Cancelar'),
  save: ml('Save', 'Guardar', 'Salvar'),
  tasks: ml('tasks', 'tareas', 'tarefas'),
  noDesc: ml('No description', 'Sin descripción', 'Sem descrição'),
  applyToProject: ml('Apply to project', 'Aplicar a proyecto', 'Aplicar ao projeto'),
  noTemplates: ml('No templates created', 'No hay plantillas creadas', 'Nenhum modelo criado'),
  noTemplatesHint: ml('Create a template to standardize recurring tasks', 'Crea una plantilla para estandarizar tareas recurrentes', 'Crie um modelo para padronizar tarefas recorrentes'),
  applyTemplate: ml('Apply template:', 'Aplicar plantilla:', 'Aplicar modelo:'),
  willCreate: ml('tasks will be created in the selected project.', 'tareas en el proyecto seleccionado.', 'tarefas serão criadas no projeto selecionado.'),
  selectProject: ml('Select project...', 'Seleccionar proyecto...', 'Selecionar projeto...'),
  apply: ml('Apply', 'Aplicar', 'Aplicar'),
  creating: ml('Creating...', 'Creando...', 'Criando...'),
  deleteConfirm: ml('Delete this template?', '¿Eliminar esta plantilla?', 'Excluir este modelo?'),
  tasksCreated: ml('tasks created in the project!', 'tareas creadas en el proyecto!', 'tarefas criadas no projeto!'),
};

type TemplateTask = { title: string; description?: string; priority: string; estimatedHours?: number; order: number; checklist?: string[]; };

export default function TemplatesPage() {
  const { activeCompanyId, locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const [templates, setTemplates] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', category: '', companyId: '' });
  const [formTasks, setFormTasks] = useState<TemplateTask[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [applyModal, setApplyModal] = useState<any>(null);
  const [applyProjectId, setApplyProjectId] = useState('');
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      fetch('/api/task-templates').then(r => r.json()),
      fetch('/api/companies').then(r => r.json()),
      fetch('/api/projects').then(r => r.json()),
    ]).then(([tData, cData, pData]) => {
      setTemplates(tData?.templates ?? []);
      setCompanies(cData?.companies ?? []);
      setProjects(pData?.projects ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { fetchData(); }, []);

  const addTaskRow = () => { setFormTasks(prev => [...prev, { title: '', priority: 'MEDIUM', order: prev.length, checklist: [] }]); };
  const updateTask = (idx: number, field: string, value: any) => { setFormTasks(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t)); };
  const removeTask = (idx: number) => { setFormTasks(prev => prev.filter((_, i) => i !== idx).map((t, i) => ({ ...t, order: i }))); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const body = { ...form, tasks: formTasks.filter(t => t.title.trim()) };
    if (editId) {
      await fetch('/api/task-templates', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editId, ...body }) });
    } else {
      await fetch('/api/task-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }
    setShowForm(false); setEditId(null);
    setForm({ name: '', description: '', category: '', companyId: '' });
    setFormTasks([]); fetchData(); setSaving(false);
  };

  const openEdit = (t: any) => {
    setEditId(t.id);
    setForm({ name: t.name, description: t.description || '', category: t.category || '', companyId: t.companyId || '' });
    setFormTasks(Array.isArray(t.tasks) ? t.tasks : []);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(L(UI.deleteConfirm))) return;
    await fetch(`/api/task-templates?id=${id}`, { method: 'DELETE' }); fetchData();
  };

  const applyTemplate = async () => {
    if (!applyModal || !applyProjectId) return;
    setApplying(true);
    const tasks = Array.isArray(applyModal.tasks) ? applyModal.tasks : [];
    for (const t of tasks) {
      await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t.title, description: t.description || '', priority: t.priority || 'MEDIUM', estimatedHours: t.estimatedHours || null, projectId: applyProjectId, status: 'TODO' }) });
    }
    setApplyModal(null); setApplyProjectId('');
    setApplying(false);
    alert(`${tasks.length} ${L(UI.tasksCreated)}`);
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-teal-600/30 border-t-teal-600 rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileStack className="w-6 h-6 text-teal-600" />{L(UI.title)}</h1>
          <p className="text-gray-500 text-sm">{L(UI.subtitle)}</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', description: '', category: '', companyId: '' }); setFormTasks([{ title: '', priority: 'MEDIUM', order: 0 }]); }} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition">
          <Plus className="w-4 h-4" />{L(UI.newTemplate)}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="bg-white rounded-xl p-5 shadow-sm space-y-4">
          <p className="font-semibold text-gray-900">{editId ? L(UI.editTemplate) : L(UI.newTemplateForm)}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input required placeholder={L(UI.templateName)} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 rounded-lg border text-sm" />
            <input placeholder={L(UI.category)} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-3 py-2 rounded-lg border text-sm" />
          </div>
          <input placeholder={L(UI.description)} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm" />
          <select value={form.companyId} onChange={e => setForm({ ...form, companyId: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-sm">
            <option value="">{L(UI.globalAll)}</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">{L(UI.templateTasks)}</p>
              <button type="button" onClick={addTaskRow} className="text-xs text-teal-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" />{L(UI.addTask)}</button>
            </div>
            <div className="space-y-2">
              {formTasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                  <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                  <input required placeholder={L(UI.taskTitle)} value={t.title} onChange={e => updateTask(i, 'title', e.target.value)} className="flex-1 px-2 py-1.5 rounded border text-sm" />
                  <select value={t.priority} onChange={e => updateTask(i, 'priority', e.target.value)} className="px-2 py-1.5 rounded border text-xs">
                    <option value="LOW">{L(UI.low)}</option><option value="MEDIUM">{L(UI.medium)}</option><option value="HIGH">{L(UI.high)}</option><option value="CRITICAL">{L(UI.critical)}</option>
                  </select>
                  <input type="number" min={0} step={0.5} placeholder="Hrs" value={t.estimatedHours ?? ''} onChange={e => updateTask(i, 'estimatedHours', parseFloat(e.target.value) || undefined)} className="w-16 px-2 py-1.5 rounded border text-xs" />
                  <button type="button" onClick={() => removeTask(i)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{L(UI.cancel)}</button>
            <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-1.5"><Save className="w-3.5 h-3.5" />{L(UI.save)}</button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {templates.map(t => {
          const taskList = Array.isArray(t.tasks) ? t.tasks : [];
          const isExpanded = expandedId === t.id;
          return (
            <div key={t.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 flex items-center gap-3">
                <button onClick={() => setExpandedId(isExpanded ? null : t.id)} className="text-gray-400 hover:text-gray-600">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{t.name}</p>
                    {t.category && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600 font-medium">{t.category}</span>}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{taskList.length} {L(UI.tasks)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{t.description || L(UI.noDesc)} {t.company ? `· ${t.company.shortName}` : '· Global'}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setApplyModal(t)} className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600" title={L(UI.applyToProject)}><Play className="w-4 h-4" /></button>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-teal-600"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(t.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {isExpanded && taskList.length > 0 && (
                <div className="border-t px-4 py-3 bg-gray-50 space-y-1">
                  {taskList.map((task: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="text-xs text-gray-400 w-5">{i + 1}.</span>
                      <span className="flex-1">{task.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${task.priority === 'HIGH' || task.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{task.priority}</span>
                      {task.estimatedHours && <span className="text-[10px] text-gray-400">{task.estimatedHours}h</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {templates.length === 0 && !showForm && (
          <div className="text-center py-12">
            <FileStack className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">{L(UI.noTemplates)}</p>
            <p className="text-sm text-gray-400 mt-1">{L(UI.noTemplatesHint)}</p>
          </div>
        )}
      </div>

      {applyModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">{L(UI.applyTemplate)} {applyModal.name}</h3>
              <button onClick={() => setApplyModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500">{Array.isArray(applyModal.tasks) ? applyModal.tasks.length : 0} {L(UI.willCreate)}</p>
            <select required value={applyProjectId} onChange={e => setApplyProjectId(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm">
              <option value="">{L(UI.selectProject)}</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <div className="flex justify-end gap-2">
              <button onClick={() => setApplyModal(null)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">{L(UI.cancel)}</button>
              <button onClick={applyTemplate} disabled={!applyProjectId || applying} className="px-4 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5" />{applying ? L(UI.creating) : L(UI.apply)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
