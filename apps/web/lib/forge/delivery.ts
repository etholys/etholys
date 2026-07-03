/** Modo de entrega do curso FORGE (público externo). */

import { getJitsiBaseUrl } from '@/lib/forge/jitsi-config';

export type ForgeDeliveryMode = 'async' | 'live' | 'blended';

export type ForgeLivePlatform = 'jitsi' | 'meet' | 'zoom' | 'teams' | 'custom';

export type ForgeLiveConfig = {
  meetingUrl?: string;
  platform?: ForgeLivePlatform;
  /** Texto livre: "Sáb 10h GMT-3" */
  scheduledLabel?: string;
  facilitatorNotes?: string;
  /** Sala Jitsi alunos */
  roomName?: string;
  /** Sala separada preparação / moderador */
  facilitatorRoomName?: string;
  facilitatorMeetingUrl?: string;
  /** presencial = cada um no celular, sem vídeo; online = com Jitsi */
  sessionFormat?: 'presencial' | 'online';
  /** false em sessão presencial */
  videoEnabled?: boolean;
};

export type ForgeMeetingRole = 'learner' | 'facilitator';

export const FORGE_DELIVERY_MODES: { id: ForgeDeliveryMode; label: string; desc: string }[] = [
  {
    id: 'async',
    label: 'Assíncrono',
    desc: 'Aluno estuda sozinho, no seu ritmo (vídeo, quiz, jogo).',
  },
  {
    id: 'live',
    label: 'Ao vivo (videochamada)',
    desc: 'Sessão síncrona com facilitador; ideal para jogos em grupo na chamada.',
  },
  {
    id: 'blended',
    label: 'Misto (ao vivo + assíncrono)',
    desc: 'Conteúdo disponível 24/7 e encontros ao vivo agendados.',
  },
];

export function parseDeliveryMode(v: unknown): ForgeDeliveryMode {
  if (v === 'live' || v === 'blended' || v === 'async') return v;
  return 'async';
}

export function parseLiveConfig(raw: unknown): ForgeLiveConfig {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  return {
    meetingUrl: typeof o.meetingUrl === 'string' ? o.meetingUrl.trim() : undefined,
    platform:
      o.platform === 'jitsi' ||
      o.platform === 'meet' ||
      o.platform === 'zoom' ||
      o.platform === 'teams' ||
      o.platform === 'custom'
        ? o.platform
        : undefined,
    scheduledLabel: typeof o.scheduledLabel === 'string' ? o.scheduledLabel.trim() : undefined,
    facilitatorNotes: typeof o.facilitatorNotes === 'string' ? o.facilitatorNotes.trim() : undefined,
    roomName: typeof o.roomName === 'string' ? o.roomName.trim().replace(/\s+/g, '-') : undefined,
    facilitatorRoomName:
      typeof o.facilitatorRoomName === 'string'
        ? o.facilitatorRoomName.trim().replace(/\s+/g, '-')
        : undefined,
    facilitatorMeetingUrl:
      typeof o.facilitatorMeetingUrl === 'string' ? o.facilitatorMeetingUrl.trim() : undefined,
    sessionFormat: o.sessionFormat === 'presencial' ? 'presencial' : 'online',
    videoEnabled: o.sessionFormat === 'presencial' ? false : o.videoEnabled !== false,
  };
}

/** URL para iframe Jitsi ou link externo. */
export function resolveMeetingUrl(
  config: ForgeLiveConfig,
  courseId?: string,
  role: ForgeMeetingRole = 'learner',
  sessionOverrideUrl?: string | null,
  jitsiBaseUrl?: string
): string | null {
  if (sessionOverrideUrl) return sessionOverrideUrl;
  if (role === 'facilitator' && config.facilitatorMeetingUrl) return config.facilitatorMeetingUrl;
  if (role === 'learner' && config.meetingUrl) return config.meetingUrl;

  const isJitsi = config.platform === 'jitsi' || !config.platform;
  if (!isJitsi) return role === 'facilitator' ? config.facilitatorMeetingUrl ?? config.meetingUrl ?? null : config.meetingUrl ?? null;

  const room =
    role === 'facilitator'
      ? config.facilitatorRoomName ||
        (config.roomName ? `${config.roomName}-facilitador` : undefined) ||
        (courseId ? `etholys-forge-fac-${courseId.slice(-8)}` : 'etholys-forge-facilitador')
      : config.roomName ||
        (courseId ? `etholys-forge-${courseId.slice(-8)}` : 'etholys-forge-room');
  const base = (jitsiBaseUrl?.replace(/\/$/, '') || getJitsiBaseUrl()).replace(/\/$/, '');
  return `${base}/${encodeURIComponent(room)}`;
}

export function isJitsiEmbeddable(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname.includes('jit.si') || u.hostname.includes('jitsi');
  } catch {
    return false;
  }
}

export function jitsiEmbedUrl(
  meetingUrl: string,
  opts?: { tileView?: boolean; filmstripOnly?: boolean }
): string {
  const u = new URL(meetingUrl);
  u.searchParams.set('embed', 'true');
  u.searchParams.set('lang', 'es');
  const config: string[] = [
    'enableScreensharing=true',
    'desktopSharingFrameRate.min=5',
    'desktopSharingFrameRate.max=30',
    'startWithAudioMuted=false',
    'startWithVideoMuted=false',
  ];
  if (opts?.tileView) config.push('tileViewEnabled=true');
  if (opts?.filmstripOnly) config.push('filmStripOnly=true');
  u.hash = `config.${config.join('&config.')}`;
  return u.toString();
}

export function showsLiveFeatures(mode: ForgeDeliveryMode): boolean {
  return mode === 'live' || mode === 'blended';
}

export function showsAsyncFeatures(mode: ForgeDeliveryMode): boolean {
  return mode === 'async' || mode === 'blended';
}

export function deliveryModeLabel(mode: ForgeDeliveryMode): string {
  return FORGE_DELIVERY_MODES.find((m) => m.id === mode)?.label ?? mode;
}
