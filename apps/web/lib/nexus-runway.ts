/**
 * Trilha NEXUS — uma ordem de capítulos (experiência contínua), não um menu fragmentado.
 * Progresso: eventos leves (localStorage) + métricas do overview quando existem.
 */

export const NEXUS_RUNWAY_LS = 'nexusRunwayV1';

export type RunwayTouch = {
  journey: boolean;
  diagnosis: boolean;
  roadmap: boolean;
  services: boolean;
  library: boolean;
};

export const emptyTouch = (): RunwayTouch => ({
  journey: false,
  diagnosis: false,
  roadmap: false,
  services: false,
  library: false,
});

export type RunwayChapterId = 'journey' | 'diagnosis' | 'roadmap' | 'services' | 'library';

export type RunwayChapter = {
  id: RunwayChapterId;
  path: string;
  labelPt: string;
  labelEs: string;
  labelEn: string;
};

export const NEXUS_RUNWAY_CHAPTERS: RunwayChapter[] = [
  {
    id: 'journey',
    path: '/hub/nexus/journey',
    /** Fase, mercados e prontidão — parte do mesmo processo; não "incubação" como módulo à parte. */
    labelPt: 'Fase e metas',
    labelEs: 'Fase y metas',
    labelEn: 'Phase & goals',
  },
  {
    id: 'diagnosis',
    path: '/hub/nexus/diagnosis',
    labelPt: 'Diagnóstico',
    labelEs: 'Diagnóstico',
    labelEn: 'Diagnosis',
  },
  {
    id: 'roadmap',
    path: '/hub/nexus/roadmap',
    labelPt: 'Rota viva',
    labelEs: 'Ruta viva',
    labelEn: 'Live roadmap',
  },
  {
    id: 'services',
    path: '/hub/nexus/services',
    labelPt: 'Apoio',
    labelEs: 'Apoyo',
    labelEn: 'Support',
  },
  {
    id: 'library',
    path: '/hub/nexus/library',
    labelPt: 'Método',
    labelEs: 'Método',
    labelEn: 'Method',
  },
];

export type RunwayMetrics = {
  pendingRoadmapActions: number;
  completedRoadmapActions: number;
  openServiceTickets: number;
};

function label(c: RunwayChapter, loc: string): string {
  if (loc === 'es') return c.labelEs;
  if (loc === 'en') return c.labelEn;
  return c.labelPt;
}

export function runwayChapterLabel(c: RunwayChapter, loc: string): string {
  return label(c, loc);
}

/** Capítulo "concluído" na trilha (check) — regras simples, sensação de jogo. */
export function isChapterComplete(
  id: RunwayChapterId,
  touch: RunwayTouch,
  metrics: RunwayMetrics | null,
): boolean {
  const m = metrics;
  const roadmapActivity =
    m != null && m.pendingRoadmapActions + m.completedRoadmapActions > 0;
  switch (id) {
    case 'journey':
      return touch.journey;
    case 'diagnosis':
      return touch.diagnosis;
    case 'roadmap':
      return roadmapActivity;
    case 'services':
      return (m != null && m.openServiceTickets > 0) || touch.services;
    case 'library':
      return touch.library;
    default:
      return false;
  }
}

export function activeRunwayId(pathname: string | null): RunwayChapterId | null {
  if (!pathname) return null;
  for (const c of NEXUS_RUNWAY_CHAPTERS) {
    if (pathname === c.path || pathname.startsWith(`${c.path}/`)) return c.id;
  }
  if (pathname === '/hub/nexus' || pathname === '/hub/nexus/') return null;
  return null;
}

export function readRunwayTouch(): RunwayTouch {
  if (typeof window === 'undefined') return emptyTouch();
  try {
    const raw = localStorage.getItem(NEXUS_RUNWAY_LS);
    if (!raw) return emptyTouch();
    const j = JSON.parse(raw) as Record<string, unknown>;
    return {
      journey: Boolean(j.journey),
      diagnosis: Boolean(j.diagnosis),
      roadmap: Boolean(j.roadmap),
      services: Boolean(j.services),
      library: Boolean(j.library),
    };
  } catch {
    return emptyTouch();
  }
}

export function writeRunwayTouch(touch: RunwayTouch): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NEXUS_RUNWAY_LS, JSON.stringify({ v: 1, ...touch }));
  } catch {
    /* quota */
  }
}

export function touchRunwayChapter(id: keyof RunwayTouch): void {
  const t = readRunwayTouch();
  if (t[id]) return;
  writeRunwayTouch({ ...t, [id]: true });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('nexus-runway-update'));
  }
}

export function withNetworkPath(path: string, networkId: string | null | undefined): string {
  if (!networkId) return path;
  const j = path.includes('?') ? '&' : '?';
  return `${path}${j}network=${encodeURIComponent(networkId)}`;
}

export function continueChapterHref(
  touch: RunwayTouch,
  metrics: RunwayMetrics | null,
  networkId: string | null | undefined,
): string {
  for (const c of NEXUS_RUNWAY_CHAPTERS) {
    if (!isChapterComplete(c.id, touch, metrics)) {
      return withNetworkPath(c.path, networkId);
    }
  }
  return withNetworkPath('/hub/nexus/journey', networkId);
}

export function runwayProgress(
  touch: RunwayTouch,
  metrics: RunwayMetrics | null,
): { done: number; total: number; percent: number } {
  const total = NEXUS_RUNWAY_CHAPTERS.length;
  let done = 0;
  for (const c of NEXUS_RUNWAY_CHAPTERS) {
    if (isChapterComplete(c.id, touch, metrics)) done += 1;
  }
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}
