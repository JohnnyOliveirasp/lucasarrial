/**
 * Persistência LOCAL dos clipes gravados (IndexedDB) — anti-perda.
 *
 * Cada clipe aceito é salvo no navegador ANTES de subir. Se a aba recarregar,
 * cair a conexão ou o navegador matar a página, os clipes não somem — dá pra
 * listar de novo e retomar o upload (Slice 2). Sem dependências externas.
 */

const DB_NAME = "aiverse-voice";
const STORE = "clips";
const VERSION = 1;

export type StoredClip = {
  id: string;
  blob: Blob;
  seconds: number;
  createdAt: number;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export async function saveClip(clip: StoredClip): Promise<void> {
  await tx("readwrite", (s) => s.put(clip));
}

export async function listClips(): Promise<StoredClip[]> {
  const all = await tx<StoredClip[]>("readonly", (s) => s.getAll());
  return (all ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function deleteClip(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}

export async function clearClips(): Promise<void> {
  await tx("readwrite", (s) => s.clear());
}
