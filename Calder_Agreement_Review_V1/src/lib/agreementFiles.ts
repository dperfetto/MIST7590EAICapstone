// Demo mode has no Supabase Storage, so the uploaded agreement file would
// otherwise be thrown away after intake. Keep it in this browser's IndexedDB
// so reviewers can still open it from the queue, even after a page refresh.
// Files stay on this device only. If IndexedDB is blocked (private windows,
// some embedded browsers), fall back to memory for the current session.

const DB_NAME = "calder-demo-files";
const STORE = "files";
const memoryFallback = new Map<string, Blob>();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveLocalFile(key: string, file: Blob) {
  memoryFallback.set(key, file);
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Memory copy above still serves this session.
  }
}

export async function readLocalFile(key: string): Promise<Blob | null> {
  const inMemory = memoryFallback.get(key);
  if (inMemory) return inMemory;
  try {
    const db = await openDb();
    const file = await new Promise<Blob | null>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () =>
        resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return file;
  } catch {
    return null;
  }
}
