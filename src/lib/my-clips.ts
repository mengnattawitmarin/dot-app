import type { Clip } from "@/lib/catalog";

/**
 * Clips the user records or picks from the gallery. Stored on-device in IndexedDB
 * (videos are too large for Preferences/localStorage). Nothing is uploaded.
 */
const DB = "dot-clips";
const STORE = "clips";
const MAX_BYTES = 300 * 1024 * 1024;

type Row = { id: string; blob: Blob; caption: string; at: number };

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const req = fn(db.transaction(STORE, mode).objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

const urls = new Map<string, string>();

function toClip(row: Row): Clip {
  let src = urls.get(row.id);
  if (!src) {
    src = URL.createObjectURL(row.blob);
    urls.set(row.id, src);
  }
  return {
    id: row.id,
    src,
    author: "คุณ",
    caption: row.caption || "คลิปของฉัน",
    credit: "คุณ",
    likes: 0,
    comments: 0,
    shares: 0,
    mine: true,
  };
}

export async function listMyClips(): Promise<Clip[]> {
  try {
    const rows = await tx<Row[]>("readonly", (s) => s.getAll() as IDBRequest<Row[]>);
    return rows.sort((a, b) => b.at - a.at).map(toClip);
  } catch {
    return [];
  }
}

export async function addMyClip(file: File, caption: string): Promise<Clip> {
  if (file.size > MAX_BYTES) throw new Error("ไฟล์ใหญ่เกิน 300 MB");
  const row: Row = { id: `mine-${Date.now()}`, blob: file, caption: caption.trim(), at: Date.now() };
  await tx("readwrite", (s) => s.put(row));
  return toClip(row);
}

export async function removeMyClip(id: string) {
  await tx("readwrite", (s) => s.delete(id));
  const url = urls.get(id);
  if (url) URL.revokeObjectURL(url);
  urls.delete(id);
}
