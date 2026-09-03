import { uploadAndTranscribeMeetRecording } from '@/lib/meet/finalize-cloud-recording';
import {
  listPendingMeetRecordings,
  markPendingMeetRecordingError,
  type PendingMeetRecording,
  removePendingMeetRecording,
  savePendingMeetRecording,
} from '@/lib/meet/pending-recording-store';

/** Guarda na fila local antes de enviar — não perde a gravação se o upload falhar. */
export async function queueMeetRecordingUpload(opts: {
  sessionId: string;
  companyId: string;
  blob: Blob;
  fileName: string;
  locale: string;
  languageHint?: string;
  whisperEnabled: boolean;
}): Promise<void> {
  await savePendingMeetRecording({
    sessionId: opts.sessionId,
    companyId: opts.companyId,
    fileName: opts.fileName,
    blob: opts.blob,
    mimeType: opts.blob.type || 'video/webm',
    locale: opts.locale,
    languageHint: opts.languageHint,
    whisperEnabled: opts.whisperEnabled,
  });

  try {
    await uploadAndTranscribeMeetRecording({
      sessionId: opts.sessionId,
      companyId: opts.companyId,
      blob: opts.blob,
      fileName: opts.fileName,
      locale: opts.locale,
      languageHint: opts.languageHint,
      whisperEnabled: opts.whisperEnabled,
    });
    await removePendingMeetRecording(opts.sessionId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload falhou';
    await markPendingMeetRecordingError(opts.sessionId, msg);
    throw new Error(
      `${msg} A gravação ficou guardada neste browser — pode reenviar no resumo CHORUS.`,
    );
  }
}

export async function flushPendingMeetRecording(sessionId: string): Promise<void> {
  const row = (await listPendingMeetRecordings()).find((r) => r.sessionId === sessionId);
  if (!row) return;
  await flushPendingRow(row);
}

export async function flushAllPendingMeetRecordings(): Promise<{
  ok: number;
  failed: number;
}> {
  const rows = await listPendingMeetRecordings();
  let ok = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await flushPendingRow(row);
      ok += 1;
    } catch {
      failed += 1;
    }
  }
  return { ok, failed };
}

async function flushPendingRow(row: PendingMeetRecording): Promise<void> {
  await uploadAndTranscribeMeetRecording({
    sessionId: row.sessionId,
    companyId: row.companyId,
    blob: row.blob,
    fileName: row.fileName,
    locale: row.locale,
    languageHint: row.languageHint,
    whisperEnabled: row.whisperEnabled,
  });
  await removePendingMeetRecording(row.sessionId);
}

export {
  listPendingMeetRecordings,
  getPendingMeetRecording,
  pendingRecordingSizeMb,
} from '@/lib/meet/pending-recording-store';
