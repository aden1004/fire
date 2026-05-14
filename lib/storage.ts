"use client";

const DB_NAME = "fire-exam";
const DB_VERSION = 1;
const STORE = "kv";

export type ChoiceLabel = "①" | "②" | "③" | "④";
export type CardStatus = "unseen" | "known" | "review";
export type Slot = "top" | "bottom";

export interface SlotState {
  answer?: ChoiceLabel;     // user-registered correct answer for this slot
  correct: number;
  wrong: number;
  lastPick?: ChoiceLabel;
}

export interface Progress {
  bookmarks: string[];
  cardStatus: Record<string, CardStatus>;
  slots: Record<string, { top?: SlotState; bottom?: SlotState }>;
  notes: Record<string, string>;
  lastCardId?: string;
}

const EMPTY: Progress = {
  bookmarks: [],
  cardStatus: {},
  slots: {},
  notes: {},
};

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

// Migrate older shape (cardAnswers/cardAttempts) into the new slots shape.
function migrate(p: any): Progress {
  const slots: Progress["slots"] = (p.slots ?? {}) as Progress["slots"];
  if (p.cardAnswers || p.cardAttempts) {
    const ans: Record<string, ChoiceLabel> = p.cardAnswers ?? {};
    const att: Record<string, { correct: number; wrong: number; lastPick?: ChoiceLabel }> = p.cardAttempts ?? {};
    const ids = new Set<string>([...Object.keys(ans), ...Object.keys(att)]);
    for (const id of ids) {
      const s: SlotState = {
        answer: ans[id],
        correct: att[id]?.correct ?? 0,
        wrong: att[id]?.wrong ?? 0,
        lastPick: att[id]?.lastPick,
      };
      slots[id] = { ...slots[id], top: s };
    }
  }
  return {
    bookmarks: p.bookmarks ?? [],
    cardStatus: p.cardStatus ?? {},
    slots,
    notes: p.notes ?? {},
    lastCardId: p.lastCardId,
  };
}

export async function loadProgress(): Promise<Progress> {
  const p = (await get<any>("progress")) ?? {};
  return { ...EMPTY, ...migrate(p) };
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

function ensureSlot(p: Progress, id: string, slot: Slot): SlotState {
  const cur = p.slots[id] ?? {};
  const cs: SlotState = cur[slot] ?? { correct: 0, wrong: 0 };
  cur[slot] = cs;
  p.slots[id] = cur;
  return cs;
}

export async function registerCorrectAnswer(id: string, slot: Slot, label: ChoiceLabel): Promise<Progress> {
  const p = await loadProgress();
  const s = ensureSlot(p, id, slot);
  s.answer = label;
  await saveProgress(p);
  return p;
}

export async function recordAttempt(id: string, slot: Slot, picked: ChoiceLabel, isCorrect: boolean): Promise<Progress> {
  const p = await loadProgress();
  const s = ensureSlot(p, id, slot);
  if (isCorrect) s.correct += 1;
  else s.wrong += 1;
  s.lastPick = picked;
  if (!isCorrect) p.cardStatus[id] = "review";
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
