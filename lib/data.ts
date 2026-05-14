import type { Dataset, Question, MnemonicEntry, SubjectId } from "./types";

// Try real dataset first; fall back to sample so the UI works before pipeline runs.
let dataset: Dataset;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  dataset = require("@/data/normalized/2025.json") as Dataset;
} catch {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  dataset = require("@/data/normalized/2025.sample.json") as Dataset;
}

export function getDataset(): Dataset {
  return dataset;
}

export function getAllQuestions(): Question[] {
  return dataset.questions;
}

export function getQuestionById(id: string): Question | undefined {
  return dataset.questions.find((q) => q.id === id);
}

export function getAllMnemonics(): MnemonicEntry[] {
  return dataset.mnemonics;
}

export interface QuestionFilters {
  round?: number;
  subject?: SubjectId;
  importance?: number;
  search?: string;
}

export function filterQuestions(qs: Question[], f: QuestionFilters): Question[] {
  return qs.filter((q) => {
    if (f.round && q.round !== f.round) return false;
    if (f.subject && q.subject !== f.subject) return false;
    if (f.importance && q.importance < f.importance) return false;
    if (f.search) {
      const s = f.search.toLowerCase();
      const hay = (q.stem + q.choices.map((c) => c.text).join(" ") + q.explanation).toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
}

export function listRounds(): number[] {
  return [...new Set(dataset.questions.map((q) => q.round))].sort();
}

export const SUBJECTS: { id: SubjectId; name: string }[] = [
  { id: 1, name: "소방원론" },
  { id: 2, name: "소방전기일반" },
  { id: 3, name: "소방관계법규" },
  { id: 4, name: "소방전기시설의 구조 및 원리" },
];
