/**
 * Etholys Meet — tipos e helpers partilhados (cliente + servidor).
 * Spec: docs/architecture/etholys-meet.md
 */

export const MEET_MIRRORS = ['loose', 'forge', 'siep', 'nexus'] as const;
export type MeetMirror = (typeof MEET_MIRRORS)[number];

export const MEET_STATUSES = ['scheduled', 'live', 'ended', 'cancelled'] as const;
export type MeetStatus = (typeof MEET_STATUSES)[number];

export const MEET_ACTION_STATUSES = ['draft', 'accepted', 'rejected', 'converted'] as const;
export type MeetActionStatus = (typeof MEET_ACTION_STATUSES)[number];

export type MeetSessionSummary = {
  id: string;
  companyId: string;
  title: string;
  mirror: MeetMirror;
  status: MeetStatus;
  scheduledAt: string | null;
  endsAt: string | null;
  roomSlug: string;
  meetingUrl: string | null;
  projectId: string | null;
  forgeLiveSessionId: string | null;
};

/** Room slug estável a partir do id da sessão (sala CHORUS). */
export function meetRoomSlug(sessionId: string, prefix = 'etholys'): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  return `${prefix}-${safe || 'room'}`;
}

export function isMeetMirror(v: unknown): v is MeetMirror {
  return typeof v === 'string' && (MEET_MIRRORS as readonly string[]).includes(v);
}

/** Entrada na sala integrada do Hub (embed CHORUS + painel IA). */
export function meetHubJoinPath(sessionId: string, companyId: string): string {
  return `/hub/meet/${sessionId}?companyId=${encodeURIComponent(companyId)}`;
}

/** Base pública da app (convites, calendário, links partilhados). */
export function meetAppBaseUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'https://app.etholys.com';
  return raw.replace(/\/$/, '');
}

/** Entrada pública no browser — sem conta Etholys e sem app móvel. */
export function meetGuestJoinPath(sessionId: string, companyId?: string | null): string {
  const path = `/meet/join/${encodeURIComponent(sessionId)}`;
  if (!companyId) return path;
  return `${path}?companyId=${encodeURIComponent(companyId)}`;
}

/**
 * Link de convite / calendário.
 * Quem tem sessão Etholys é enviado ao Hub (host). Quem não tem entra no browser com o nome.
 */
export function meetPublicJoinUrl(sessionId: string, companyId: string): string {
  const path = meetGuestJoinPath(sessionId, companyId);
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }
  return `${meetAppBaseUrl()}${path}`;
}

/** Resolver sala de vídeo → Hub (links antigos meet.etholys.com/…). */
export function meetRoomResolvePath(roomSlug: string): string {
  return `/hub/meet/r/${encodeURIComponent(roomSlug)}`;
}

/** Captura externa (Zoom/Teams/outro) ligada a uma sessão Meet. */
export function meetCapturePath(opts: {
  companyId: string;
  sessionId?: string | null;
  /** Abrir o link da call após carregar a página de captura */
  openMeetingUrl?: string | null;
  /** Arrancar o picker de ecrã automaticamente */
  autoRecord?: boolean;
}): string {
  const params = new URLSearchParams({ companyId: opts.companyId });
  if (opts.sessionId) params.set('sessionId', opts.sessionId);
  if (opts.openMeetingUrl) params.set('openUrl', opts.openMeetingUrl);
  if (opts.autoRecord) params.set('autoRecord', '1');
  return `/hub/meet/capture?${params.toString()}`;
}

/** Sessão importada do Google Calendar (sem sala CHORUS por omissão). */
export function isGoogleImportedMeetSession(session: {
  roomSlug?: string | null;
}): boolean {
  return Boolean(session.roomSlug?.startsWith('gcal-'));
}

/** Biblioteca de transcrições / resumos (estilo Otter / Read.ai). */
export function meetRecapsPath(companyId?: string | null): string {
  return companyId
    ? `/hub/meet/recaps?companyId=${encodeURIComponent(companyId)}`
    : '/hub/meet/recaps';
}

/** Página de uma reunião: transcrição completa + resumo. */
export function meetRecapPath(sessionId: string, companyId?: string | null): string {
  return companyId
    ? `/hub/meet/recaps/${sessionId}?companyId=${encodeURIComponent(companyId)}`
    : `/hub/meet/recaps/${sessionId}`;
}

/** Para ocorrências de série, abrir sempre a sessão mestre (mesmo link de sala). */
export function meetJoinTargetId(session: {
  id: string;
  seriesParentId?: string | null;
}): string {
  return session.seriesParentId || session.id;
}
