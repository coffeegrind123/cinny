export enum IndexedDBStatus {
  Supported = 'supported',
  Unsupported = 'unsupported',
  Unavailable = 'unavailable',
}

export const checkIndexedDBSupport = async (): Promise<IndexedDBStatus> => {
  if (typeof indexedDB === 'undefined') return IndexedDBStatus.Unsupported;

  const dbName = `checkIndexedDBSupport-${Date.now()}`;
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    let database: IDBDatabase | undefined;
    let settled = false;

    const finish = (status: IndexedDBStatus) => {
      if (settled) return;
      settled = true;
      database?.close();
      try {
        indexedDB.deleteDatabase(dbName);
      } catch {
        // Cleanup failure; probe result remains valid.
      }
      resolve(status);
    };

    try {
      request = indexedDB.open(dbName, 1);
    } catch {
      finish(IndexedDBStatus.Unavailable);
      return;
    }

    request.onupgradeneeded = () => {
      try {
        request.result.createObjectStore('storage-check');
      } catch {
        request.transaction?.abort();
      }
    };
    request.onsuccess = () => {
      database = request.result;
      let transaction: IDBTransaction;
      try {
        transaction = database.transaction('storage-check', 'readwrite');
        transaction.objectStore('storage-check').put('available', 'status');
      } catch {
        finish(IndexedDBStatus.Unavailable);
        return;
      }
      transaction.oncomplete = () => finish(IndexedDBStatus.Supported);
      transaction.onerror = () => finish(IndexedDBStatus.Unavailable);
      transaction.onabort = () => finish(IndexedDBStatus.Unavailable);
    };
    request.onerror = () => finish(IndexedDBStatus.Unavailable);
  });
};
