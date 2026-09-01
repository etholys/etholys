/** Envia gravação via API Etholys → R2 (evita CORS no browser). */
export async function uploadMeetRecordingFile(opts: {
  sessionId: string;
  companyId: string;
  file: File;
}): Promise<{ recordingUrl: string | null }> {
  const form = new FormData();
  form.append('companyId', opts.companyId);
  form.append('file', opts.file);

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
