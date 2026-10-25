/** RADAR operative tasks — field work items, not eTask/Work board. */

export const RADAR_TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export type RadarTaskStatus = (typeof RADAR_TASK_STATUSES)[number];

export const RADAR_TASK_SEVERITIES = ['critical', 'warning', 'info'] as const;
export type RadarTaskSeverity = (typeof RADAR_TASK_SEVERITIES)[number];

export type RadarTaskProgressNote = {
  id: string;
  at: string;
  note: string;
};

export function isRadarTaskStatus(v: unknown): v is RadarTaskStatus {
  return typeof v === 'string' && (RADAR_TASK_STATUSES as readonly string[]).includes(v);
}

export function isRadarTaskSeverity(v: unknown): v is RadarTaskSeverity {
  return typeof v === 'string' && (RADAR_TASK_SEVERITIES as readonly string[]).includes(v);
}

export function parseProgressJson(raw: unknown): RadarTaskProgressNote[] {
  if (!Array.isArray(raw)) return [];
  const out: RadarTaskProgressNote[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id || '').trim();
    const note = String(r.note || '').trim();
    const at = String(r.at || '').trim();
    if (!id || note.length < 1) continue;
    out.push({
      id: id.slice(0, 40),
      at: at || new Date().toISOString(),
      note: note.slice(0, 2000),
    });
  }
  return out.slice(-80);
}

export function statusLabel(status: RadarTaskStatus, loc: 'pt' | 'es' | 'en'): string {
  if (status === 'doing') {
    return loc === 'es' ? 'En curso' : loc === 'en' ? 'In progress' : 'Em curso';
  }
  if (status === 'done') {
    return loc === 'es' ? 'Hecho' : loc === 'en' ? 'Done' : 'Feito';
  }
  return loc === 'es' ? 'Por hacer' : loc === 'en' ? 'To do' : 'A fazer';
}
