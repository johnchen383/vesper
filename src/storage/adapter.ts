import type { StateStorage } from 'zustand/middleware'

/**
 * Persistence boundary. All of Vesper's state flows through this interface,
 * so adding cloud sync later (Firebase, MongoDB, ...) means implementing
 * another StateStorage — e.g. one that writes locally first and reconciles
 * with a backend — and swapping it into the store's `createJSONStorage` call.
 *
 * Backed by IndexedDB (async, generous quota, not evicted as eagerly as
 * localStorage). Data that predates this adapter is migrated in from
 * localStorage on first read; localStorage remains the fallback if
 * IndexedDB is unavailable.
 */

const DB_NAME = 'vesper'
const STORE = 'kv'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => req.result.createObjectStore(STORE)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbPromise
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE))
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      })
  )
}

export const localAdapter: StateStorage = {
  getItem: async (name) => {
    try {
      const value = await withStore<unknown>('readonly', (s) => s.get(name))
      if (typeof value === 'string') return value
      // First run on this adapter: pull any legacy localStorage data across.
      const legacy = localStorage.getItem(name)
      if (legacy !== null) await withStore('readwrite', (s) => s.put(legacy, name))
      return legacy
    } catch {
      return localStorage.getItem(name)
    }
  },
  setItem: async (name, value) => {
    try {
      await withStore('readwrite', (s) => s.put(value, name))
    } catch {
      localStorage.setItem(name, value)
    }
  },
  removeItem: async (name) => {
    try {
      await withStore('readwrite', (s) => s.delete(name))
    } catch {
      localStorage.removeItem(name)
    }
  },
}
