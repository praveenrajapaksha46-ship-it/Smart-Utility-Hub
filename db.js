/**
 * IndexedDB wrapper for Smart Utility Hub
 * Handles files, music blobs, and gallery media storage
 */

const DB_NAME = 'SmartUtilityHub';
const DB_VERSION = 1;

/** Open or create the IndexedDB database */
export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // File manager store: folders and files with blob data
      if (!db.objectStoreNames.contains('files')) {
        const fileStore = db.createObjectStore('files', { keyPath: 'id' });
        fileStore.createIndex('parentId', 'parentId', { unique: false });
        fileStore.createIndex('name', 'name', { unique: false });
        fileStore.createIndex('type', 'type', { unique: false });
      }

      // Music tracks store
      if (!db.objectStoreNames.contains('music')) {
        db.createObjectStore('music', { keyPath: 'id' });
      }

      // Gallery media store
      if (!db.objectStoreNames.contains('gallery')) {
        const galleryStore = db.createObjectStore('gallery', { keyPath: 'id' });
        galleryStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

/** Generic CRUD helpers */
async function getStore(storeName, mode = 'readonly') {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function dbGetAll(storeName) {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet(storeName, id) {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbPut(storeName, item) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbDelete(storeName, id) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function dbClear(storeName) {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Calculate total storage used across all stores */
export async function getStorageStats() {
  const stores = ['files', 'music', 'gallery'];
  let totalBytes = 0;
  let fileCount = 0;

  for (const storeName of stores) {
    const items = await dbGetAll(storeName);
    for (const item of items) {
      fileCount++;
      if (item.blob) totalBytes += item.blob.size || 0;
      else if (item.size) totalBytes += item.size;
    }
  }

  return { totalBytes, fileCount };
}

/** Generate unique ID */
export function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
