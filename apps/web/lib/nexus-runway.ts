/**
 * Trilha NEXUS — uma ordem de capítulos (experiência contínua), não um menu fragmentado.
 * Progresso: eventos leves (localStorage) + métricas do overview quando existem.
 */

export const NEXUS_RUNWAY_LS = 'nexusRunwayV2';

export type RunwayTouch = {
  diagnosis: boolean;
  roadmap: boolean;
  campo: boolean;
  monitor: boolean;
  services: boolean;
};

export const emptyTouch = (): RunwayTouch => ({
  diagnosis: false,
  roadmap: false,
  campo: false,
  monitor: false,
  services: false,
});

export type RunwayChapterId = 'diagnosis' | 'roadmap' | 'campo' | 'monitor' | 'services';

export type RunwayChapter = {
  id: RunwayChapterId;
  path: string;
  labelPt: string;
  labelEs: string;
  labelEn: string;
};

export const NEXUS_RUNWAY_CHAPTERS: RunwayChapter[] = [
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
    labelPt: 'Plano',
    labelEs: 'Plan',
    labelEn: 'Plan',
  },
  {
    id: 'campo',
    path: '/hub/nexus/campo',
    labelPt: 'Caderno',
    labelEs: 'Cuaderno',
    labelEn: 'Field book',
  },
  {
    id: 'monitor',
    path: '/hub/nexus/monitor',
    labelPt: 'Monitorização',
    labelEs: 'Monitoreo',
    labelEn: 'Monitoring',
  },
  {
    id: 'services',
    path: '/hub/nexus/coach',
    labelPt: 'Copiloto',
    labelEs: 'Copiloto',
    labelEn: 'Copilot',
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
    case 'diagnosis':
      return touch.diagnosis;
    case 'roadmap':
      return roadmapActivity;
    case 'campo':
      return touch.campo;
    case 'monitor':
      return touch.monitor;
    case 'services':
      return (m != null && m.openServiceTickets > 0) || touch.services;
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
      diagnosis: Boolean(j.diagnosis),
      roadmap: Boolean(j.roadmap),
      campo: Boolean(j.campo),
      monitor: Boolean(j.monitor),
      services: Boolean(j.services),
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
  return withNetworkPath('/hub/nexus/campo', networkId);
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

/** AT a terceiros / redes — não misturar com a jornada da empresa ativa. */
export function isNexusDeliverPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (
    pathname.startsWith('/hub/nexus/at') ||
    pathname.startsWith('/hub/nexus/networks') ||
    pathname.startsWith('/hub/nexus/services')
  );
}

/** Diagnóstico / caderno / monitor com ?company= de cliente AT (≠ empresa do seletor). */
export function isAtClientDiagnosisPath(
  pathname: string | null | undefined,
  searchParams: { get: (k: string) => string | null },
  activeCompanyId: string | null | undefined
): boolean {
  if (
    !pathname?.startsWith('/hub/nexus/diagnosis') &&
    !pathname?.startsWith('/hub/nexus/campo') &&
    !pathname?.startsWith('/hub/nexus/monitor')
  ) {
    return false;
  }
  const company = searchParams.get('company');
  if (!company) return false;
  return !activeCompanyId || company !== activeCompanyId;
}
