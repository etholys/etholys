/**
 * Motor de vídeo do CHORUS.
 * A implementação actual usa infraestrutura open-source por baixo —
 * o produto e a API pública falam só em CHORUS.
 */
import {
  canEmbedJitsiInIframe,
  getJitsiBaseUrl,
  isJitsiDemoEmbedHost,
} from '@/lib/forge/jitsi-config';

export function getChorusVideoBaseUrl(): string {
  return getJitsiBaseUrl();
}

export function canEmbedChorusRoom(url: string): boolean {
  return canEmbedJitsiInIframe(url);
}

export function isChorusVideoDemoHost(url: string): boolean {
  return isJitsiDemoEmbedHost(url);
}
