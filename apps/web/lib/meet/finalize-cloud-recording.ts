import { uploadMeetRecordingFile } from '@/lib/meet/upload-recording-client';

/** Envia gravação para R2 e arranca Whisper (pipeline automático CHORUS). */
export async function uploadAndTranscribeMeetRecording(opts: {
  sessionId: string;
  companyId: string;
  blob: Blob;
  fileName: string;
  locale: string;
  languageHint?: string;
  whisperEnabled: boolean;
}): Promise<void> {
  const file = new File([opts.blob], opts.fileName, {
    type: opts.blob.type || 'video/webm',
  });
  await uploadMeetRecordingFile({
    sessionId: opts.sessionId,
    companyId: opts.companyId,
    file,
  });
  if (!opts.whisperEnabled) return;
  const tr = await fetch(`/api/meet/sessions/${opts.sessionId}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: opts.companyId,
      locale: opts.locale,
      languageHint: opts.languageHint,
      finalize: false,
      diarize: true,
    }),
  });
  if (!tr.ok) {
    const d = (await tr.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error || 'Transcrição falhou');
  }
}
