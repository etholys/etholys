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

/** Room slug estável a partir do id da sessão (Jitsi). */
export function meetRoomSlug(sessionId: string, prefix = 'etholys'): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
  return `${prefix}-${safe || 'room'}`;
}

export function isMeetMirror(v: unknown): v is MeetMirror {
  return typeof v === 'string' && (MEET_MIRRORS as readonly string[]).includes(v);
}

/** Entrada na sala integrada do Hub (Jitsi embed + painel IA). */
export function meetHubJoinPath(sessionId: string, companyId: string): string {
  return `/hub/meet/${sessionId}?companyId=${encodeURIComponent(companyId)}`;
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

/** Para ocorrências de série, abrir sempre a sessão mestre (mesmo link Jitsi). */
export function meetJoinTargetId(session: {
  id: string;
  seriesParentId?: string | null;
}): string {
  return session.seriesParentId || session.id;
}
