/**
 * URLs de sala Etholys Meet (Jitsi).
 * Reutiliza a base FORGE; meet.jit.si só para demos locais (limite iframe).
 */

import { getJitsiBaseUrl } from '@/lib/forge/jitsi-config';
import { meetRoomSlug } from '@/lib/meet/types';

export function buildMeetRoomUrl(sessionId: string, jitsiBaseUrl?: string): string {
  const base = (jitsiBaseUrl?.replace(/\/$/, '') || getJitsiBaseUrl()).replace(/\/$/, '');
  return `${base}/${meetRoomSlug(sessionId)}`;
}

/** Overrides Jitsi para embed/abertura externa, sem expor o slug técnico como título. */
export function meetEmbedUrl(
  meetingUrl: string,
  opts?: { host?: boolean; title?: string },
): string {
  try {
    const u = new URL(meetingUrl);
    const overrides = new URLSearchParams(u.hash.replace(/^#/, ''));
    overrides.set('config.prejoinConfig.enabled', 'true');
    overrides.set('config.disableDeepLinking', 'true');
    // Breakout rooms: botão visível para o host na barra Jitsi (self-hosted).
    overrides.set('config.breakoutRooms.hideAddRoomButton', 'false');
    const title = opts?.title?.trim();
    if (title) {
      // Sem isto, o Jitsi transforma o slug "etholys-abc123" num título feio.
      overrides.set('config.subject', JSON.stringify(title.slice(0, 200)));
    }
    if (opts?.host) {
      overrides.set('config.startWithAudioMuted', 'false');
    }
    u.hash = overrides.toString();
    return u.toString();
  } catch {
    return meetingUrl;
  }
}
