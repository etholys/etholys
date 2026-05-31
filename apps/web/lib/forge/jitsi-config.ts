/** Domínio Jitsi de produção (self-hosted). Evita meet.jit.si (limite 5 min em iframe). */
export function getJitsiBaseUrl(): string {
  const raw =
    process.env.JITSI_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_JITSI_BASE_URL?.trim() ||
    '';
  if (raw) return raw.replace(/\/$/, '');
  return 'https://meet.jit.si';
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
