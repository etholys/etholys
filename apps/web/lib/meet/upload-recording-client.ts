const SERVER_PROXY_MAX_BYTES = 48 * 1024 * 1024; // ~48 MB — acima disso exige R2 directo (CORS)

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
  if (!r.ok) throw new Error(d.error || `Upload failed (${r.status})`);
  return { recordingUrl: d.session?.recordingUrl ?? null };
}

/**
 * Envia gravação para R2.
 * 1) Tenta upload directo (presign) — melhor para ficheiros grandes.
 * 2) Se falhar (CORS), fallback pelo servidor (ficheiros até ~48 MB).
 */
export async function uploadMeetRecordingFile(opts: {
  sessionId: string;
  companyId: string;
  file: File;
}): Promise<{ recordingUrl: string | null }> {
  validateRecordingFile(opts.file);

  try {
    return await uploadViaPresign(opts);
  } catch (presignErr) {
    const msg = presignErr instanceof Error ? presignErr.message : String(presignErr);
    const isNetwork =
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed');

    if (!isNetwork && !msg.includes('Upload R2 failed')) {
      throw presignErr;
    }

    if (opts.file.size > SERVER_PROXY_MAX_BYTES) {
      throw new Error(
        'Upload directo para R2 falhou (CORS). No bucket etholys-chorus → Settings → CORS: permitir PUT de https://app.etholys.com. Ou comprima o vídeo (< 48 MB).',
      );
    }

    return uploadViaServer(opts);
  }
}
