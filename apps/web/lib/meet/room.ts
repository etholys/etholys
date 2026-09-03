/**
 * URLs de sala Etholys CHORUS.
 * Reutiliza a base de vídeo da plataforma; hosts públicos só para demos locais.
 */

import { getChorusVideoBaseUrl } from '@/lib/meet/video-engine';
import { meetRoomSlug } from '@/lib/meet/types';

export function buildMeetRoomUrl(sessionId: string, videoBaseUrl?: string): string {
  const base = (videoBaseUrl?.replace(/\/$/, '') || getChorusVideoBaseUrl()).replace(/\/$/, '');
  return `${base}/${meetRoomSlug(sessionId)}`;
}

/** Overrides de embed/abertura externa, sem expor o slug técnico como título. */
export function meetEmbedUrl(
  meetingUrl: string,
  opts?: { host?: boolean; title?: string },
): string {
  try {
    const u = new URL(meetingUrl);
    const overrides = new URLSearchParams(u.hash.replace(/^#/, ''));
    overrides.set('config.prejoinConfig.enabled', 'true');
    overrides.set('config.disableDeepLinking', 'true');
    // Breakout rooms: botão visível para o host na barra (self-hosted).
    overrides.set('config.breakoutRooms.hideAddRoomButton', 'false');
    overrides.set(
      'config.defaultLogoUrl',
      JSON.stringify('https://app.etholys.com/meet-brand/etholys-mark.svg'),
    );
    overrides.set('config.defaultRemoteDisplayName', JSON.stringify('Participante'));
    overrides.set('config.hideConferenceSubject', 'true');
    // Chaves do motor de vídeo (watermark do fornecedor OSS) — mantidas por contrato da API.
    overrides.set('interfaceConfig.SHOW_JITSI_WATERMARK', 'false');
    overrides.set('interfaceConfig.SHOW_WATERMARK_FOR_GUESTS', 'false');
    overrides.set('interfaceConfig.SHOW_POWERED_BY', 'false');
    overrides.set('interfaceConfig.MOBILE_APP_PROMO', 'false');
    overrides.set('interfaceConfig.SHOW_BRAND_WATERMARK', 'false');
    overrides.set('interfaceConfig.VERTICAL_FILMSTRIP', 'true');
    overrides.set('interfaceConfig.DEFAULT_BACKGROUND', JSON.stringify('#0f172a'));
    overrides.set('interfaceConfig.APP_NAME', JSON.stringify('CHORUS'));
    overrides.set('interfaceConfig.PROVIDER_NAME', JSON.stringify('Etholys'));
    const title = opts?.title?.trim();
    if (title) {
      // Sem isto, o motor de vídeo transforma o slug técnico num título feio.
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
