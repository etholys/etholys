'use client';

type JsonBody = {
  error?: string;
  cloud_storage_path?: string;
  uploadUrl?: string;
  mode?: string;
};

export type UploadProgress = {
  phase: 'presign' | 'upload' | 'done';
  percent: number;
};

async function readJson(res: Response): Promise<JsonBody> {
  try {
    return (await res.json()) as JsonBody;
  } catch {
    return {};
  }
}

function xhrPut(
  url: string,
  file: File,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Error al subir archivo a almacenamiento (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir archivo'));
    xhr.send(file);
  });
}

function xhrFormPost(
  url: string,
  body: FormData,
  onProgress?: (pct: number) => void,
): Promise<JsonBody> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const data = (xhr.response as JsonBody) || {};
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Error al subir archivo (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Error de red al subir archivo'));
    xhr.send(body);
  });
}

/** Sube un archivo del proyecto vía S3 presign o almacenamiento local (dev). */
export async function uploadProjectFile(
  projectId: string,
  file: File,
  category: 'guides' | 'reports',
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  onProgress?.({ phase: 'presign', percent: 8 });

  const presignRes = await fetch('/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'presign',
      scope: 'siep',
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
    }),
  });
  const presign = await readJson(presignRes);
  if (!presignRes.ok) {
    throw new Error(presign.error || `Error al preparar subida (${presignRes.status})`);
  }

  if (presign.mode === 'local') {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('projectId', projectId);
    fd.append('category', category);
    const upData = await xhrFormPost('/api/documents/upload', fd, (pct) => {
      onProgress?.({ phase: 'upload', percent: 10 + Math.round(pct * 0.8) });
    });
    if (!upData.cloud_storage_path) {
      throw new Error(upData.error || 'Error al subir archivo');
    }
    onProgress?.({ phase: 'done', percent: 92 });
    return upData.cloud_storage_path;
  }

  if (!presign.cloud_storage_path || !presign.uploadUrl) {
    throw new Error('Respuesta de almacenamiento incompleta');
  }

  await xhrPut(
    presign.uploadUrl,
    file,
    file.type || 'application/octet-stream',
    (pct) => onProgress?.({ phase: 'upload', percent: 10 + Math.round(pct * 0.8) }),
  );
  onProgress?.({ phase: 'done', percent: 92 });
  return presign.cloud_storage_path;
}

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await readJson(res)) as Record<string, unknown>;
  return { ok: res.ok, data, status: res.status };
}
