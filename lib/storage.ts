"use client";

const DB_NAME = "fire-exam";
const DB_VERSION = 1;
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get<T>(key: string): Promise<T | undefined> {
  if (typeof window === "undefined") return undefined;
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

async function put(key: string, value: unknown): Promise<void> {
  if (typeof window === "undefined") return;
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type CardStatus = "unseen" | "known" | "review";

export interface Progress {
  bookmarks: string[];                // card ids (or page files for back-compat)
  cardStatus: Record<string, CardStatus>;
  notes: Record<string, string>;
  lastCardId?: string;
}

const EMPTY: Progress = { bookmarks: [], cardStatus: {}, notes: {} };

export async function loadProgress(): Promise<Progress> {
  const p = (await get<Partial<Progress>>("progress")) ?? {};
  return { ...EMPTY, ...p, cardStatus: p.cardStatus ?? {}, notes: p.notes ?? {}, bookmarks: p.bookmarks ?? [] };
}

export async function saveProgress(p: Progress): Promise<void> {
  await put("progress", p);
}

export async function toggleBookmark(id: string): Promise<Progress> {
  const p = await loadProgress();
  const i = p.bookmarks.indexOf(id);
  if (i >= 0) p.bookmarks.splice(i, 1);
  else p.bookmarks.push(id);
  await saveProgress(p);
  return p;
}

export async function setCardStatus(id: string, status: CardStatus): Promise<Progress> {
  const p = await loadProgress();
  if (status === "unseen") delete p.cardStatus[id];
  else p.cardStatus[id] = status;
  await saveProgress(p);
  return p;
}

export async function setLastCard(id: string): Promise<void> {
  const p = await loadProgress();
  p.lastCardId = id;
  await saveProgress(p);
}

export async function setNote(id: string, text: string): Promise<Progress> {
  const p = await loadProgress();
  if (text.trim()) p.notes[id] = text;
  else delete p.notes[id];
  await saveProgress(p);
  return p;
}
