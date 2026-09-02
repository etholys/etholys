import { MEET_RECORDING_PART_BYTES } from '@/lib/meet/recording-multipart';

/** Upload directo pelo servidor — até ~96 MB num único POST. */
const SERVER_DIRECT_MAX_BYTES = 96 * 1024 * 1024;

function validateRecordingFile(file: File): void {
  const name = (file.name || '').toLowerCase();
  if (name.endsWith('.crswap')) {
    throw new Error(
      'O ficheiro .crswap é temporário/incompleto. Use o .webm final quando a gravação terminar de guardar.',
    );
  }
  if (!file.size || file.size <= 0) {
    throw new Error('O ficheiro está vazio (0 bytes). Escolhe outro ficheiro .webm ou .mp4.');
  }
}

async function confirmRecordingUpload(opts: {
  sessionId: string;
  companyId: string;
  storageKey: string;
  publicUrl?: string | null;
}): Promise<{ recordingUrl: string | null }> {
  const confirm = await fetch(`/api/meet/sessions/${opts.sessionId}/recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: opts.companyId,
      action: 'confirm',
      storageKey: opts.storageKey,
      recordingUrl: opts.publicUrl || undefined,
    }),
  });
  const d = (await confirm.json()) as {
    error?: string;
    session?: { recordingUrl?: string | null };
  };
  if (!confirm.ok) throw new Error(d.error || 'Confirm failed');
  return { recordingUrl: d.session?.recordingUrl ?? null };
}

async function uploadViaServer(opts: {
  sessionId: string;
  companyId: string;
  file: File;
}): Promise<{ recordingUrl: string | null }> {
  const form = new FormData();
  form.append('companyId', opts.companyId);
  form.append('file', opts.file, opts.file.name);

  const r = await fetch(`/api/meet/sessions/${opts.sessionId}/recording`, {
    method: 'POST',
    body: form,
  });
  const d = (await r.json()) as {
    error?: string;
    session?: { recordingUrl?: string | null };
  };
  if (!r.ok) {
    const err = new Error(d.error || `Upload failed (${r.status})`) as Error & { status?: number };
    err.status = r.status;
    throw err;
  }
  return { recordingUrl: d.session?.recordingUrl ?? null };
}

async function uploadViaMultipart(opts: {
  sessionId: string;
  companyId: string;
  file: File;
}): Promise<{ recordingUrl: string | null }> {
  const init = await fetch(`/api/meet/sessions/${opts.sessionId}/recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: opts.companyId,
      action: 'multipart-init',
      fileName: opts.file.name,
      contentType: opts.file.type || 'video/webm',
    }),
  });
  const initData = (await init.json()) as {
    error?: string;
    uploadId?: string;
    storageKey?: string;
    partSize?: number;
  };
  if (!init.ok || !initData.uploadId || !initData.storageKey) {
    throw new Error(initData.error || 'Multipart init failed');
  }

  const partSize = initData.partSize || MEET_RECORDING_PART_BYTES;
  const parts: Array<{ PartNumber: number; ETag: string }> = [];
  let partNumber = 1;

  for (let offset = 0; offset < opts.file.size; offset += partSize) {
    const chunk = opts.file.slice(offset, offset + partSize);
    const form = new FormData();
    form.append('companyId', opts.companyId);
    form.append('uploadAction', 'multipart-part');
    form.append('uploadId', initData.uploadId);
    form.append('storageKey', initData.storageKey);
    form.append('partNumber', String(partNumber));
    form.append('file', chunk, `part-${partNumber}.bin`);

    const partRes = await fetch(`/api/meet/sessions/${opts.sessionId}/recording`, {
      method: 'POST',
      body: form,
    });
    const partData = (await partRes.json()) as { error?: string; etag?: string };
    if (!partRes.ok || !partData.etag) {
      throw new Error(partData.error || `Part ${partNumber} upload failed`);
    }
    parts.push({ PartNumber: partNumber, ETag: partData.etag });
    partNumber += 1;
  }

  const complete = await fetch(`/api/meet/sessions/${opts.sessionId}/recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: opts.companyId,
      action: 'multipart-complete',
      uploadId: initData.uploadId,
      storageKey: initData.storageKey,
      parts,
    }),
  });
  const completeData = (await complete.json()) as {
    error?: string;
    session?: { recordingUrl?: string | null };
  };
  if (!complete.ok) throw new Error(completeData.error || 'Multipart complete failed');
  return { recordingUrl: completeData.session?.recordingUrl ?? null };
}

async function uploadViaPresign(opts: {
  sessionId: string;
  companyId: string;
  file: File;
}): Promise<{ recordingUrl: string | null }> {
  const presign = await fetch(`/api/meet/sessions/${opts.sessionId}/recording`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      companyId: opts.companyId,
      action: 'presign',
      fileName: opts.file.name,
      contentType: opts.file.type || 'video/webm',
    }),
  });
  const signed = (await presign.json()) as {
    error?: string;
    uploadUrl?: string;
    storageKey?: string;
    publicUrl?: string | null;
  };
  if (!presign.ok) throw new Error(signed.error || 'Presign failed');
  if (!signed.uploadUrl || !signed.storageKey) throw new Error('Presign incomplete');

  const put = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': opts.file.type || 'video/webm' },
    body: opts.file,
  });
  if (!put.ok) throw new Error(`Upload R2 failed (${put.status})`);

  return confirmRecordingUpload({
    sessionId: opts.sessionId,
    companyId: opts.companyId,
    storageKey: signed.storageKey,
    publicUrl: signed.publicUrl,
  });
}

function isRetryableUploadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = err && typeof err === 'object' && 'status' in err ? (err as { status?: number }).status : 0;
  return (
    status === 413 ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Load failed') ||
    msg.includes('Upload R2 failed') ||
    msg.includes('interrompido') ||
    msg.includes('too large') ||
    msg.includes('Payload Too Large')
  );
}

/**
 * Envia gravação para R2 — **sem depender de CORS no browser**.
 * 1) Servidor directo (≤96 MB)
 * 2) Multipart via servidor (qualquer tamanho)
 * 3) Presign R2 só como último recurso
 */
export async function uploadMeetRecordingFile(opts: {
  sessionId: string;
  companyId: string;
  file: File;
}): Promise<{ recordingUrl: string | null }> {
  validateRecordingFile(opts.file);

  if (opts.file.size <= SERVER_DIRECT_MAX_BYTES) {
    try {
      return await uploadViaServer(opts);
    } catch (err) {
      if (!isRetryableUploadError(err)) throw err;
    }
  }

  try {
    return await uploadViaMultipart(opts);
  } catch (err) {
    if (!isRetryableUploadError(err)) throw err;
  }

  try {
    return await uploadViaPresign(opts);
  } catch {
    throw new Error(
      'Não foi possível enviar a gravação. Verifique a ligação e tente de novo no resumo da reunião.',
    );
  }
}
