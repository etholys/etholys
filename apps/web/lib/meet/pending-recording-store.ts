/**
 * Fila local (IndexedDB) — gravações à espera de envio.
 * Suporta várias por sessão (não bloqueia gravar outra).
 */

export type PendingMeetRecording = {
  /** Chave única na fila (não confundir com sessionId). */
  id: string;
  sessionId: string;
  companyId: string;
  fileName: string;
  blob: Blob;
  mimeType: string;
  locale: string;
  languageHint?: string;
  whisperEnabled: boolean;
  createdAt: string;
  lastError?: string;
};

const DB_NAME = 'chorus-pending-recordings';
const STORE = 'recordings';
/** v1: keyPath sessionId. v2: keyPath id + index sessionId. */
const DB_VERSION = 2;

function newPendingId(): string {
  return `pend-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      const tx = req.transaction;
      if (!tx) return;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        return;
      }

      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          return;
        }
        const oldStore = tx.objectStore(STORE);
        const getAllReq = oldStore.getAll();
        getAllReq.onsuccess = () => {
          const legacy = (getAllReq.result || []) as Array<Record<string, unknown>>;
          db.deleteObjectStore(STORE);
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          for (const row of legacy) {
            const sessionId = String(row.sessionId || '');
            if (!sessionId || !row.blob) continue;
            store.put({
              sessionId,
              companyId: String(row.companyId || ''),
              fileName: String(row.fileName || 'chorus.webm'),
              blob: row.blob,
              mimeType: String(row.mimeType || 'video/webm'),
              locale: String(row.locale || 'es'),
              languageHint: typeof row.languageHint === 'string' ? row.languageHint : undefined,
              whisperEnabled: Boolean(row.whisperEnabled),
              createdAt:
                typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
              lastError: typeof row.lastError === 'string' ? row.lastError : undefined,
              id: typeof row.id === 'string' && row.id ? row.id : newPendingId(),
            } satisfies PendingMeetRecording);
          }
        };
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
  });
}

function runTx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | void> {
  return openDb().then(
    (db) =>
      new Promise<T | void>((resolve, reject) => {
        try {
          if (!db.objectStoreNames.contains(STORE)) {
            db.close();
            reject(new Error('IndexedDB store em falta — recarregue a página'));
            return;
          }
          const tx = db.transaction(STORE, mode);
          const store = tx.objectStore(STORE);
          const result = fn(store);
          tx.oncomplete = () => {
            db.close();
            if (result instanceof IDBRequest) {
              resolve(result.result as T);
            } else {
              resolve();
            }
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error ?? new Error('IndexedDB transaction failed'));
          };
        } catch (err) {
          db.close();
          reject(err);
        }
      }),
  );
}

export async function savePendingMeetRecording(
  entry: Omit<PendingMeetRecording, 'createdAt' | 'id'> & {
    createdAt?: string;
    id?: string;
  },
): Promise<PendingMeetRecording> {
  const row: PendingMeetRecording = {
    ...entry,
    id: entry.id || newPendingId(),
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  await runTx('readwrite', (store) => store.put(row));
  return row;
}

/** Última pendente desta sessão (compat). */
export async function getPendingMeetRecording(
  sessionId: string,
): Promise<PendingMeetRecording | null> {
  const rows = await listPendingMeetRecordingsForSession(sessionId);
  return rows[0] || null;
}

export async function listPendingMeetRecordingsForSession(
  sessionId: string,
): Promise<PendingMeetRecording[]> {
  if (!sessionId) return [];
  const all = await listPendingMeetRecordings();
  return all.filter((r) => r.sessionId === sessionId);
}

export async function listPendingMeetRecordings(): Promise<PendingMeetRecording[]> {
  const rows = await runTx<PendingMeetRecording[]>('readonly', (store) => store.getAll());
  const list = (rows as PendingMeetRecording[] | undefined) || [];
  return list
    .filter((r) => r && r.blob && r.sessionId)
    .map((r) => ({ ...r, id: r.id || newPendingId() }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Remove por id; se não existir id, remove todas as da sessão (compat). */
export async function removePendingMeetRecording(idOrSessionId: string): Promise<void> {
  const all = await listPendingMeetRecordings();
  const byId = all.find((r) => r.id === idOrSessionId);
  if (byId) {
    await runTx('readwrite', (store) => store.delete(byId.id));
    return;
  }
  for (const row of all.filter((r) => r.sessionId === idOrSessionId)) {
    await runTx('readwrite', (store) => store.delete(row.id));
  }
}

export async function removePendingMeetRecordingById(id: string): Promise<void> {
  await runTx('readwrite', (store) => store.delete(id));
}

export async function markPendingMeetRecordingError(
  idOrSessionId: string,
  lastError: string,
): Promise<void> {
  const all = await listPendingMeetRecordings();
  const row =
    all.find((r) => r.id === idOrSessionId) ||
    all.find((r) => r.sessionId === idOrSessionId);
  if (!row) return;
  await savePendingMeetRecording({ ...row, lastError });
}

export function pendingRecordingSizeMb(blob: Blob): string {
  return (blob.size / (1024 * 1024)).toFixed(1);
}
