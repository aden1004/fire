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

export interface Progress {
  bookmarks: string[];      // page file names
  notes: Record<string, string>;  // page file -> free-form note
  lastViewed?: string;
}

const EMPTY: Progress = { bookmarks: [], notes: {} };

export async function loadProgress(): Promise<Progress> {
  return (await get<Progress>("progress")) ?? EMPTY;
}

export async function saveProgress(p: Progress): Promise<void> {
  await put("progress", p);
}

export async function toggleBookmark(file: string): Promise<Progress> {
  const p = await loadProgress();
  const i = p.bookmarks.indexOf(file);
  if (i >= 0) p.bookmarks.splice(i, 1);
  else p.bookmarks.push(file);
  await saveProgress(p);
  return p;
}

export async function setNote(file: string, text: string): Promise<Progress> {
  const p = await loadProgress();
  if (text.trim()) p.notes[file] = text;
  else delete p.notes[file];
  await saveProgress(p);
  return p;
}

export async function setLastViewed(file: string): Promise<void> {
  const p = await loadProgress();
  p.lastViewed = file;
  await saveProgress(p);
}
