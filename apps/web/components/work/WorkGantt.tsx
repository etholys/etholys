'use client';

import { useMemo } from 'react';
import { formatDate } from '@/lib/utils';
import { getStatusColor } from '@/lib/utils';

type Task = {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate?: string | null;
  dueDate?: string | null;
  assignee?: { name?: string | null } | null;
  parentId?: string | null;
};

type Dep = {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
};

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function WorkGantt({
  tasks,
  deps = [],
  onSelect,
  t,
}: {
  tasks: Task[];
  deps?: Dep[];
  onSelect: (id: string) => void;
  t: (en: string, es: string, pt: string) => string;
}) {
  const rows = useMemo(
    () => tasks.filter((task) => !task.parentId).slice(0, 80),
    [tasks],
  );

  const { rangeStart, totalDays, zoom } = useMemo(() => {
    const dates: Date[] = [];
    for (const task of rows) {
      if (task.startDate) dates.push(new Date(task.startDate));
      if (task.dueDate) dates.push(new Date(task.dueDate));
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!dates.length) {
      const start = new Date(today);
      start.setDate(start.getDate() - 14);
      return { rangeStart: start, totalDays: 60, zoom: 18 };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);
    min.setHours(0, 0, 0, 0);
    return {
      rangeStart: min,
      totalDays: Math.max(daysBetween(min, max), 30),
      zoom: 18,
    };
  }, [rows]);

  const dayToX = (d: Date) => daysBetween(rangeStart, d) * zoom;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayX = dayToX(today);

  const months = useMemo(() => {
    const out: Array<{ label: string; x: number; width: number }> = [];
    const cursor = new Date(rangeStart);
    cursor.setDate(1);
    while (cursor < new Date(rangeStart.getTime() + totalDays * 86400000)) {
      const start = new Date(Math.max(cursor.getTime(), rangeStart.getTime()));
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + 1);
      const end = new Date(Math.min(next.getTime(), rangeStart.getTime() + totalDays * 86400000));
      out.push({
        label: cursor.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        x: dayToX(start),
        width: Math.max(dayToX(end) - dayToX(start), 0),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return out;
  }, [rangeStart, totalDays, zoom]);

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-6 py-16 text-center text-sm text-slate-400">
        {t('No tasks to show on the timeline', 'Sin tareas en la línea de tiempo', 'Sem tarefas na timeline')}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-800">
          {t('Timeline', 'Cronograma', 'Cronograma')}
        </h3>
        <p className="text-[11px] text-slate-400">
          {t(
            'Bars use start → due. Tasks without dates appear as a marker on today.',
            'Barras usan inicio → plazo. Sin fechas = marcador en hoy.',
            'Barras usam início → prazo. Sem datas = marcador no hoje.',
          )}
        </p>
      </div>
      <div className="flex" style={{ minHeight: Math.max(rows.length * 44 + 60, 200) }}>
        <div className="w-52 shrink-0 border-r border-slate-200 sm:w-60">
          <div className="flex h-10 items-center border-b border-slate-200 bg-slate-50 px-3">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('Task', 'Tarea', 'Tarefa')}
            </span>
          </div>
          {rows.map((task) => (
            <button
              key={task.id}
              type="button"
              onClick={() => onSelect(task.id)}
              className="flex h-11 w-full items-center gap-2 border-b border-slate-50 px-3 text-left hover:bg-slate-50"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: getStatusColor(task.status) }}
              />
              <span className="truncate text-sm text-slate-700">{task.title}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-x-auto">
          <div style={{ width: totalDays * zoom, minWidth: '100%' }} className="relative">
            <div className="relative h-10 border-b border-slate-200 bg-slate-50">
              {months.map((m, i) => (
                <div
                  key={i}
                  className="absolute top-0 flex h-full items-center border-r border-slate-200"
                  style={{ left: m.x, width: Math.max(m.width, 0) }}
                >
                  <span className="truncate px-2 text-[10px] font-semibold uppercase text-slate-400">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>

            {Array.from({ length: Math.ceil(totalDays / 7) }, (_, i) => (
              <div
                key={i}
                className="absolute bottom-0 top-10 w-px bg-slate-100"
                style={{ left: i * 7 * zoom }}
              />
            ))}

            <div className="absolute bottom-0 top-0 z-20 w-0.5 bg-rose-400" style={{ left: todayX }}>
              <div className="absolute left-1/2 -translate-x-1/2 rounded-b bg-rose-500 px-1.5 py-0.5 text-[9px] font-medium text-white">
                {t('Today', 'Hoy', 'Hoje')}
              </div>
            </div>

            {rows.map((task, i) => {
              const start = task.startDate ? new Date(task.startDate) : null;
              const end = task.dueDate ? new Date(task.dueDate) : null;
              if (!start && !end) {
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onSelect(task.id)}
                    className="absolute"
                    style={{ top: 40 + i * 44 + 14, left: todayX - 5 }}
                    title={task.title}
                  >
                    <span
                      className="block h-3 w-3 rounded-full border-2 bg-white"
                      style={{ borderColor: getStatusColor(task.status) }}
                    />
                  </button>
                );
              }
              const barStart = start ? dayToX(start) : end ? dayToX(end) - zoom * 3 : 0;
              const barEnd = end ? dayToX(end) : barStart + zoom * 3;
              const barWidth = Math.max(barEnd - barStart, zoom * 0.5);
              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onSelect(task.id)}
                  className="absolute rounded-md"
                  style={{
                    top: 40 + i * 44 + 10,
                    left: barStart,
                    width: barWidth,
                    height: 24,
                    backgroundColor: `${getStatusColor(task.status)}33`,
                    borderLeft: `3px solid ${getStatusColor(task.status)}`,
                  }}
                  title={`${task.title}\n${start ? formatDate(start.toISOString()) : '?'} → ${end ? formatDate(end.toISOString()) : '?'}`}
                >
                  {barWidth > 72 && (
                    <span className="block truncate px-2 text-left text-[10px] font-medium leading-6 text-slate-700">
                      {task.title}
                    </span>
                  )}
                </button>
              );
            })}

            <svg
              className="pointer-events-none absolute inset-0 z-10"
              style={{ width: totalDays * zoom, height: rows.length * 44 + 60 }}
            >
              {deps.map((dep) => {
                const fromIdx = rows.findIndex((t) => t.id === dep.dependsOnTaskId);
                const toIdx = rows.findIndex((t) => t.id === dep.taskId);
                if (fromIdx < 0 || toIdx < 0) return null;
                const fromTask = rows[fromIdx];
                const toTask = rows[toIdx];
                const fromEnd = fromTask.dueDate ? dayToX(new Date(fromTask.dueDate)) : todayX;
                const toStart = toTask.startDate ? dayToX(new Date(toTask.startDate)) : todayX;
                const y1 = 40 + fromIdx * 44 + 22;
                const y2 = 40 + toIdx * 44 + 22;
                const midX = (fromEnd + toStart) / 2;
                return (
                  <g key={dep.id}>
                    <path
                      d={`M ${fromEnd} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${toStart} ${y2}`}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="1.5"
                      strokeDasharray="4 2"
                    />
                    <polygon
                      points={`${toStart},${y2} ${toStart - 6},${y2 - 4} ${toStart - 6},${y2 + 4}`}
                      fill="#94a3b8"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
