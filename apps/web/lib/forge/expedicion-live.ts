import type { ForgeLiveConfig } from '@/lib/forge/delivery';

/** Sala Jitsi exclusiva por empresa (LLC ≠ LTDA). */
export function expedicionCompanyRoomSlug(shortName: string, companyId: string): string {
  const base =
    shortName
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'rural-commerce';
  return `expedicion-${base}-${companyId.slice(-8)}`;
}

export function buildExpedicionLiveConfig(opts: {
  companyName: string;
  shortName: string;
  companyId: string;
}): ForgeLiveConfig {
  const slug = expedicionCompanyRoomSlug(opts.shortName || opts.companyName, opts.companyId);
  return {
    platform: 'jitsi',
    roomName: slug,
    facilitatorRoomName: `${slug}-facilitador`,
    scheduledLabel: `Sesiones síncronas — ${opts.companyName} (videollamada, sin vídeos grabados)`,
    facilitatorNotes: `Ambiente exclusivo ${opts.companyName}. Salón FORGE: tablero colectivo en vivo + mapa personal por alumno; validar fichas +100 Eco-Créditos.`,
    meetingUrl: undefined,
  };
}
