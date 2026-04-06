'use client';
import { useApp } from '@/app/providers';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Link2, X, Calendar } from 'lucide-react';
import { formatDate } from '@/lib/utils';

type GanttTask = {
  id: string; title: string; status: string; priority: string;
  startDate: string | null; dueDate: string | null;
  assignee?: { name: string } | null;
};

const STATUS_COLORS: Record<string, string> = {
  BACKLOG: '#94a3b8', TODO: '#60a5fa', IN_PROGRESS: '#f59e0b', IN_REVIEW: '#a855f7', DONE: '#22c55e', CANCELLED: '#ef4444',
};
const PRIORITY_BORDER: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#6b7280',
};

type ML = { es: string; pt: string; en: string };
const ml = (en: string, es: string, pt: string): ML => ({ en, es, pt });
export default function GanttPage() {
  const { locale } = useApp();
  const L = (m: ML) => m[locale] || m.en;
  const params = useParams();
  const projectId = params?.id as string;
  const [project, setProject] = useState<any>(null);
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [deps, setDeps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [zoom, setZoom] = useState(30);
  const [viewOffset, setViewOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [showDepForm, setShowDepForm] = useState(false);
  const [depForm, setDepForm] = useState({ taskId: '', dependsOnTaskId: '', type: 'finish_to_start' });

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      fetch(`/api/projects/${projectId}`).then(r => r.json()),
      fetch(`/api/task-dependencies?projectId=${projectId}`).then(r => r.json()),
    ]).then(([pData, dData]) => {
      setProject(pData?.project);
      setTasks((pData?.project?.tasks ?? []).filter((t: any) => t.isActive !== false));
      setDeps(dData?.dependencies ?? []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [projectId]);

  const { projectStart, totalDays } = useMemo(() => {
    if (!project) return { projectStart: new Date(), totalDays: 90 };
    const dates: number[] = [];
    if (project.startDate) dates.push(new Date(project.startDate).getTime());
    if (project.endDate) dates.push(new Date(project.endDate).getTime());
    tasks.forEach(t => {
      if (t.startDate) dates.push(new Date(t.startDate).getTime());
      if (t.dueDate) dates.push(new Date(t.dueDate).getTime());
    });
    const now = Date.now();
    const pStart = dates.length > 0 ? new Date(Math.min(...dates) - 7 * 86400000) : new Date(now - 30 * 86400000);
    const pEnd = dates.length > 0 ? new Date(Math.max(...dates) + 14 * 86400000) : new Date(now + 60 * 86400000);
    const diff = Math.max(Math.ceil((pEnd.getTime() - pStart.getTime()) / 86400000), 30);
    return { projectStart: pStart, totalDays: diff };
  }, [project, tasks]);

  const dayToX = (date: Date) => {
    const diff = (date.getTime() - projectStart.getTime()) / 86400000;
    return (diff - viewOffset) * zoom;
  };

  const addDependency = async () => {
    if (!depForm.taskId || !depForm.dependsOnTaskId) return;
    const res = await fetch('/api/task-dependencies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(depForm),
    });
    if (res.ok) {
      const d = await res.json();
      setDeps(prev => [...prev, d.dependency]);
      setShowDepForm(false);
      setDepForm({ taskId: '', dependsOnTaskId: '', type: 'finish_to_start' });
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err?.error || 'Error');
    }
  };
  const removeDep = async (id: string) => {
    await fetch(`/api/task-dependencies?id=${id}`, { method: 'DELETE' });
    setDeps(prev => prev.filter(d => d.id !== id));
  };

  const months = useMemo(() => {
    const result: { label: string; x: number; width: number }[] = [];
    const start = new Date(projectStart);
    start.setDate(start.getDate() + viewOffset);
    const visibleDays = Math.ceil(1200 / zoom);
    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const endDate = new Date(start.getTime() + (visibleDays + 60) * 86400000);
    while (current.getTime() < endDate.getTime()) {
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      const x = dayToX(current);
      const w = dayToX(nextMonth) - x;
      result.push({ label: current.toLocaleDateString('es', { month: 'short', year: '2-digit' }), x, width: w });
      current = nextMonth;
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStart, viewOffset, zoom]);

  const todayX = dayToX(new Date());

  if (loading || !mounted) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-3 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/siep/projects/${projectId}`} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Calendar className="w-5 h-5 text-indigo-600" />Cronograma Gantt</h1>
            <p className="text-sm text-gray-500">{project?.name ?? ''}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowDepForm(!showDepForm)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-teal-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition">
            <Link2 className="w-3.5 h-3.5" />Dependencia
          </button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setZoom(z => Math.max(10, z - 5))} className="p-1.5 rounded hover:bg-white text-gray-500"><ZoomOut className="w-4 h-4" /></button>
            <span className="text-xs text-gray-500 w-8 text-center">{zoom}px</span>
            <button onClick={() => setZoom(z => Math.min(60, z + 5))} className="p-1.5 rounded hover:bg-white text-gray-500"><ZoomIn className="w-4 h-4" /></button>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button onClick={() => setViewOffset(v => v - 7)} className="p-1.5 rounded hover:bg-white text-gray-500"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setViewOffset(0)} className="px-2 py-1 text-xs rounded hover:bg-white text-gray-500">Hoy</button>
            <button onClick={() => setViewOffset(v => v + 7)} className="p-1.5 rounded hover:bg-white text-gray-500"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {showDepForm && (
        <div className="bg-white rounded-xl p-4 shadow-sm border space-y-3">
          <p className="text-sm font-medium text-gray-700">Nueva dependencia entre tareas</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select value={depForm.dependsOnTaskId} onChange={e => setDepForm({ ...depForm, dependsOnTaskId: e.target.value })} className="px-3 py-2 rounded-lg border text-sm">
              <option value="">Tarea bloqueante...</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <select value={depForm.type} onChange={e => setDepForm({ ...depForm, type: e.target.value })} className="px-3 py-2 rounded-lg border text-sm">
              <option value="finish_to_start">Fin → Inicio</option>
              <option value="start_to_start">Inicio → Inicio</option>
              <option value="finish_to_finish">Fin → Fin</option>
            </select>
            <select value={depForm.taskId} onChange={e => setDepForm({ ...depForm, taskId: e.target.value })} className="px-3 py-2 rounded-lg border text-sm">
              <option value="">Tarea dependiente...</option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowDepForm(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
            <button onClick={addDependency} disabled={!depForm.taskId || !depForm.dependsOnTaskId} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">Crear</button>
          </div>
          {deps.length > 0 && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-gray-500">Dependencias activas:</p>
              {deps.map(d => (
                <div key={d.id} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                  <span className="font-medium">{d.dependsOn?.title ?? '?'}</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-medium">{d.task?.title ?? '?'}</span>
                  <span className="text-gray-400">({d.type?.replace(/_/g, ' ')})</span>
                  <button onClick={() => removeDep(d.id)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex" style={{ minHeight: Math.max(tasks.length * 44 + 60, 200) }}>
          <div className="w-56 sm:w-64 flex-shrink-0 border-r border-gray-200">
            <div className="h-10 bg-gray-50 border-b border-gray-200 px-3 flex items-center">
              <span className="text-xs font-semibold text-gray-500 uppercase">Tarea</span>
            </div>
            {tasks.map((task) => (
              <div key={task.id} className="h-11 px-3 flex items-center gap-2 border-b border-gray-100 hover:bg-gray-50 transition">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[task.status] ?? '#94a3b8' }} />
                <span className="text-sm text-gray-700 truncate flex-1">{task.title}</span>
                {task.assignee && <span className="text-[10px] text-gray-400 flex-shrink-0">{task.assignee.name.split(' ')[0]}</span>}
              </div>
            ))}
          </div>

          <div className="flex-1 overflow-x-auto" ref={scrollRef}>
            <div style={{ width: totalDays * zoom, minWidth: '100%' }} className="relative">
              <div className="h-10 bg-gray-50 border-b border-gray-200 relative">
                {months.map((m, i) => (
                  <div key={i} className="absolute top-0 h-full flex items-center border-r border-gray-200" style={{ left: m.x, width: Math.max(m.width, 0) }}>
                    <span className="text-[10px] font-semibold text-gray-500 uppercase px-2 truncate">{m.label}</span>
                  </div>
                ))}
              </div>

              {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => {
                const d = new Date(projectStart);
                d.setDate(d.getDate() + i * 7);
                const x = dayToX(d);
                return <div key={i} className="absolute top-10 bottom-0 w-px bg-gray-100" style={{ left: x }} />;
              })}

              <div className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20" style={{ left: todayX }}>
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-b font-medium">HOY</div>
              </div>

              {tasks.map((task, i) => {
                const start = task.startDate ? new Date(task.startDate) : null;
                const end = task.dueDate ? new Date(task.dueDate) : null;
                if (!start && !end) {
                  return (
                    <div key={task.id} className="absolute" style={{ top: 40 + i * 44 + 9, left: todayX - 4 }}>
                      <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: STATUS_COLORS[task.status] ?? '#94a3b8', backgroundColor: task.status === 'DONE' ? STATUS_COLORS.DONE : 'white' }} />
                    </div>
                  );
                }
                const barStart = start ? dayToX(start) : (end ? dayToX(end) - zoom * 3 : 0);
                const barEnd = end ? dayToX(end) : (start ? barStart + zoom * 3 : zoom * 3);
                const barWidth = Math.max(barEnd - barStart, zoom * 0.5);
                const progress = task.status === 'DONE' ? 100 : task.status === 'IN_PROGRESS' ? 50 : task.status === 'IN_REVIEW' ? 80 : 0;

                return (
                  <div key={task.id} className="absolute group" style={{ top: 40 + i * 44 + 9, left: barStart, width: barWidth, height: 24 }}>
                    <div
                      className="h-full rounded-md shadow-sm relative overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                      style={{ backgroundColor: (STATUS_COLORS[task.status] ?? '#94a3b8') + '30', borderLeft: `3px solid ${PRIORITY_BORDER[task.priority] ?? '#6b7280'}` }}
                      title={`${task.title}\n${start ? formatDate(start.toISOString()) : '?'} → ${end ? formatDate(end.toISOString()) : '?'}`}
                    >
                      <div className="absolute inset-y-0 left-0 rounded-md" style={{ width: `${progress}%`, backgroundColor: (STATUS_COLORS[task.status] ?? '#94a3b8') + '60' }} />
                      {barWidth > 60 && <span className="relative z-10 text-[10px] font-medium text-gray-700 px-2 leading-6 truncate block">{task.title}</span>}
                    </div>
                  </div>
                );
              })}

              <svg className="absolute inset-0 pointer-events-none z-10" style={{ width: totalDays * zoom, height: tasks.length * 44 + 60 }}>
                {deps.map(dep => {
                  const fromIdx = tasks.findIndex(t => t.id === dep.dependsOnTaskId);
                  const toIdx = tasks.findIndex(t => t.id === dep.taskId);
                  if (fromIdx < 0 || toIdx < 0) return null;
                  const fromTask = tasks[fromIdx];
                  const toTask = tasks[toIdx];
                  const fromEnd = fromTask.dueDate ? dayToX(new Date(fromTask.dueDate)) : todayX;
                  const toStart = toTask.startDate ? dayToX(new Date(toTask.startDate)) : todayX;
                  const y1 = 40 + fromIdx * 44 + 21;
                  const y2 = 40 + toIdx * 44 + 21;
                  const midX = (fromEnd + toStart) / 2;
                  return (
                    <g key={dep.id}>
                      <path d={`M ${fromEnd} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${toStart} ${y2}`} fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
                      <polygon points={`${toStart},${y2} ${toStart - 6},${y2 - 4} ${toStart - 6},${y2 + 4}`} fill="#94a3b8" />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
            <span>{status.replace(/_/g, ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 bg-red-400" /><span>Hoy</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-0 border-t border-dashed border-gray-400" /><span>Dependencia</span></div>
      </div>
    </div>
  );
}
