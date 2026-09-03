export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getChorusVideoBaseUrl, isChorusVideoDemoHost } from '@/lib/meet/video-engine';
import { isMeetTranscribeConfigured } from '@/lib/meet/transcribe';
import { isMeetRecordingStorageReady } from '@/lib/meet/recording-storage';
import { ensureMeetRecordingCors } from '@/lib/meet/recording-cors';

/**
 * Estado do CHORUS (vídeo, gravação na nuvem, transcrição).
 * Não requer auth — só revela se o motor está em modo demo.
 */
export async function GET() {
  const baseUrl = getChorusVideoBaseUrl();
  const isDemo = isChorusVideoDemoHost(`${baseUrl}/x`);
  const cloudStorageReady = isMeetRecordingStorageReady();
  const whisperTranscriptionEnabled = isMeetTranscribeConfigured();

  void ensureMeetRecordingCors();

  return NextResponse.json({
    baseUrl,
    isDemo,
    liveTranscriptionEnabled: process.env.MEET_LIVE_TRANSCRIPTION_ENABLED === '1',
    whisperTranscriptionEnabled,
    cloudStorageReady,
    /** Pipeline CHORUS: gravar → nuvem → transcrever */
    recordingPipelineReady: cloudStorageReady,
    transcriptionPipelineReady: whisperTranscriptionEnabled,
    message: isDemo
      ? 'CHORUS em modo demonstração: as chamadas têm duração limitada.'
      : 'CHORUS pronto — gravação e transcrição disponíveis.',
  });
}
