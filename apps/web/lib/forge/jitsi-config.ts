/**
 * URL base do motor de vídeo CHORUS (`meet.etholys.com`).
 * Env legado JITSI_* — só ops; o produto fala sempre em CHORUS.
 */
export function getJitsiBaseUrl(): string {
  const raw =
    process.env.CHORUS_VIDEO_BASE_URL?.trim() ||
    process.env.JITSI_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_JITSI_BASE_URL?.trim() ||
    '';
  if (raw) return raw.replace(/\/$/, '');
  return 'https://meet.etholys.com';
}

export function isJitsiDemoEmbedHost(url: string): boolean {
  try {
    return new URL(url).hostname === 'meet.jit.si';
  } catch {
    return false;
  }
}

export function canEmbedJitsiInIframe(meetingUrl: string): boolean {
  if (!meetingUrl || meetingUrl.includes('localhost')) return false;
  return !isJitsiDemoEmbedHost(meetingUrl);
}
