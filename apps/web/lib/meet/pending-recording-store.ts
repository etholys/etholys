/**
 * Fila local (IndexedDB) — gravações à espera de envio quando o upload falha ou a rede cai.
 * Sobrevive a refresh/fechar separador até ser enviada com sucesso.
 */

export type PendingMeetRecording = {
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
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponível neste browser'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'sessionId' });
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
      }),
  );
}

export async function savePendingMeetRecording(
  entry: Omit<PendingMeetRecording, 'createdAt'> & { createdAt?: string },
): Promise<void> {
  const row: PendingMeetRecording = {
    ...entry,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  await runTx('readwrite', (store) => store.put(row));
}

export async function getPendingMeetRecording(
  sessionId: string,
): Promise<PendingMeetRecording | null> {
  const row = await runTx<PendingMeetRecording>('readonly', (store) =>
    store.get(sessionId),
  );
  return (row as PendingMeetRecording | undefined) || null;
}

export async function listPendingMeetRecordings(): Promise<PendingMeetRecording[]> {
  const rows = await runTx<PendingMeetRecording[]>('readonly', (store) => store.getAll());
  const list = (rows as PendingMeetRecording[] | undefined) || [];
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function removePendingMeetRecording(sessionId: string): Promise<void> {
  await runTx('readwrite', (store) => store.delete(sessionId));
}

export async function markPendingMeetRecordingError(
  sessionId: string,
  lastError: string,
): Promise<void> {
  const row = await getPendingMeetRecording(sessionId);
  if (!row) return;
  await savePendingMeetRecording({ ...row, lastError });
}

export function pendingRecordingSizeMb(blob: Blob): string {
  return (blob.size / (1024 * 1024)).toFixed(1);
}
