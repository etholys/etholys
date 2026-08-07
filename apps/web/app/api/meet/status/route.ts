export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getJitsiBaseUrl, isJitsiDemoEmbedHost } from '@/lib/forge/jitsi-config';

/**
 * Estado do motor de vídeo (Jitsi) — para o Hub Meet e ops.
 * Não requer auth: só revela se o host é demo público.
 */
export async function GET() {
  const baseUrl = getJitsiBaseUrl();
  const isDemo = isJitsiDemoEmbedHost(`${baseUrl}/x`);
  return NextResponse.json({
    baseUrl,
    isDemo,
    meetDomainHint: 'meet.etholys.com',
    docs: '/docs/MEET-JITSI-CONTABO.md',
    liveTranscriptionEnabled: process.env.MEET_LIVE_TRANSCRIPTION_ENABLED === '1',
    cloudRecordingEnabled: process.env.MEET_CLOUD_RECORDING_ENABLED === '1',
    message: isDemo
      ? 'A usar servidor de vídeo demo (chamadas limitadas). Configure meet.etholys.com em produção.'
      : 'Servidor de vídeo Etholys Meet configurado.',
  });
}
