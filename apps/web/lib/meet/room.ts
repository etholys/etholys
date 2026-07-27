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

/** Query params úteis para embed (ecrã partilhado, breakouts) — alinhado ao FORGE. */
export function meetEmbedUrl(meetingUrl: string, opts?: { host?: boolean }): string {
  try {
    const u = new URL(meetingUrl);
    u.searchParams.set('config.prejoinConfig.enabled', 'true');
    u.searchParams.set('config.disableDeepLinking', 'true');
    // Breakout rooms: botão visível para o host na barra Jitsi (self-hosted).
    u.searchParams.set('config.breakoutRooms.hideAddRoomButton', 'false');
    if (opts?.host) {
      u.searchParams.set('config.startWithAudioMuted', 'false');
    }
    return u.toString();
  } catch {
    return meetingUrl;
  }
}
