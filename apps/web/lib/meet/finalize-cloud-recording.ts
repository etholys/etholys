import { uploadMeetRecordingFile } from '@/lib/meet/upload-recording-client';

export type FinalizeCloudRecordingResult = {
  uploaded: boolean;
  transcribed: boolean;
  warning?: string;
};

/** Envia gravação para a nuvem CHORUS e arranca a transcrição. */
export async function uploadAndTranscribeMeetRecording(opts: {
  sessionId: string;
  companyId: string;
  blob: Blob;
  fileName: string;
  locale: string;
  languageHint?: string;
  whisperEnabled: boolean;
}): Promise<FinalizeCloudRecordingResult> {
  const file = new File([opts.blob], opts.fileName, {
    type: opts.blob.type || 'video/webm',
  });
  await uploadMeetRecordingFile({
    sessionId: opts.sessionId,
    companyId: opts.companyId,
    file,
  });

  if (!opts.whisperEnabled) {
    return { uploaded: true, transcribed: false };
  }

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
    return {
      uploaded: true,
      transcribed: false,
      warning:
        d.error ||
        'Gravação na nuvem OK. A transcrição falhou — use Transcrever no resumo CHORUS.',
    };
  }
  return { uploaded: true, transcribed: true };
}
