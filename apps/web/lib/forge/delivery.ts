/** Modo de entrega do curso FORGE (público externo). */

import { getJitsiBaseUrl } from '@/lib/forge/jitsi-config';

export type ForgeDeliveryMode = 'async' | 'live' | 'blended';

/** Plataforma de vídeo. `jitsi` = alias legado de `chorus` (nunca mostrar “jitsi” na UI). */
export type ForgeLivePlatform = 'chorus' | 'jitsi' | 'meet' | 'zoom' | 'teams' | 'custom';

export type ForgeLiveConfig = {
  meetingUrl?: string;
  platform?: ForgeLivePlatform;
  /** Texto livre: "Sáb 10h GMT-3" */
  scheduledLabel?: string;
  facilitatorNotes?: string;
  /** Sala CHORUS — alunos */
  roomName?: string;
  /** Sala CHORUS — facilitador */
  facilitatorRoomName?: string;
  facilitatorMeetingUrl?: string;
  /** presencial = cada um no celular, sem vídeo; online = sala CHORUS */
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

/** Sala integrada CHORUS (inclui dados antigos gravados como platform=jitsi). */
export function isChorusLivePlatform(platform?: ForgeLivePlatform | null): boolean {
  return !platform || platform === 'chorus' || platform === 'jitsi';
}

export function normalizeLivePlatform(
  platform?: ForgeLivePlatform | null,
): ForgeLivePlatform | undefined {
  if (!platform) return undefined;
  if (platform === 'jitsi') return 'chorus';
  return platform;
}

export function parseDeliveryMode(v: unknown): ForgeDeliveryMode {
  if (v === 'live' || v === 'blended' || v === 'async') return v;
  return 'async';
}

export function parseLiveConfig(raw: unknown): ForgeLiveConfig {
  if (!raw || typeof raw !== 'object') return {};
  const o = raw as Record<string, unknown>;
  const platformRaw = o.platform;
  const platform =
    platformRaw === 'chorus' ||
    platformRaw === 'jitsi' ||
    platformRaw === 'meet' ||
    platformRaw === 'zoom' ||
    platformRaw === 'teams' ||
    platformRaw === 'custom'
      ? (platformRaw === 'jitsi' ? 'chorus' : platformRaw)
      : undefined;
  return {
    meetingUrl: typeof o.meetingUrl === 'string' ? o.meetingUrl.trim() : undefined,
    platform,
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

/** URL da sala CHORUS ou link externo (Zoom/Meet/Teams). */
export function resolveMeetingUrl(
  config: ForgeLiveConfig,
  courseId?: string,
  role: ForgeMeetingRole = 'learner',
  sessionOverrideUrl?: string | null,
  videoBaseUrl?: string,
): string | null {
  if (sessionOverrideUrl) return sessionOverrideUrl;
  if (role === 'facilitator' && config.facilitatorMeetingUrl) return config.facilitatorMeetingUrl;
  if (role === 'learner' && config.meetingUrl) return config.meetingUrl;

  if (!isChorusLivePlatform(config.platform)) {
    return role === 'facilitator'
      ? config.facilitatorMeetingUrl ?? config.meetingUrl ?? null
      : config.meetingUrl ?? null;
  }

  const room =
    role === 'facilitator'
      ? config.facilitatorRoomName ||
        (config.roomName ? `${config.roomName}-facilitador` : undefined) ||
        (courseId ? `etholys-forge-fac-${courseId.slice(-8)}` : 'etholys-forge-facilitador')
      : config.roomName ||
        (courseId ? `etholys-forge-${courseId.slice(-8)}` : 'etholys-forge-room');
  const base = (videoBaseUrl?.replace(/\/$/, '') || getJitsiBaseUrl()).replace(/\/$/, '');
  return `${base}/${encodeURIComponent(room)}`;
}

/** @deprecated use isChorusRoomEmbeddable */
export function isJitsiEmbeddable(url: string): boolean {
  return isChorusRoomEmbeddable(url);
}

export function isChorusRoomEmbeddable(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host === 'meet.etholys.com' || host.endsWith('.etholys.com')) return true;
    if (host.includes('jit.si')) return true; // legado / demo
    try {
      const baseHost = new URL(getJitsiBaseUrl()).hostname.toLowerCase();
      if (baseHost && host === baseHost) return true;
    } catch {
      /* ignore */
    }
    return false;
  } catch {
    return false;
  }
}

/** @deprecated use chorusRoomEmbedUrl */
export function jitsiEmbedUrl(
  meetingUrl: string,
  opts?: { tileView?: boolean; filmstripOnly?: boolean },
): string {
  return chorusRoomEmbedUrl(meetingUrl, opts);
}

export function chorusRoomEmbedUrl(
  meetingUrl: string,
  opts?: { tileView?: boolean; filmstripOnly?: boolean },
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
    'breakoutRooms.hideAddRoomButton=false',
    'defaultRemoteDisplayName="Participante"',
    'defaultLogoUrl="https://app.etholys.com/meet-brand/etholys-mark.svg"',
  ];
  const iface = [
    'SHOW_JITSI_WATERMARK=false',
    'SHOW_WATERMARK_FOR_GUESTS=false',
    'SHOW_POWERED_BY=false',
    'MOBILE_APP_PROMO=false',
    'APP_NAME="CHORUS"',
    'NATIVE_APP_NAME="CHORUS"',
    'PROVIDER_NAME="Etholys"',
  ];
  if (opts?.tileView) config.push('tileViewEnabled=true');
  if (opts?.filmstripOnly) config.push('filmStripOnly=true');
  u.hash = `config.${config.join('&config.')}&interfaceConfig.${iface.join('&interfaceConfig.')}`;
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
