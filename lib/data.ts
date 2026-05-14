import type { PagesDataset, PageEntry, SubjectId } from "./types";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const dataset = require("@/data/normalized/2025_pages.json") as PagesDataset;

export function getDataset(): PagesDataset {
  return dataset;
}

export function getAllPages(): PageEntry[] {
  return dataset.pages;
}

export function getPageByFile(file: string): PageEntry | undefined {
  return dataset.pages.find((p) => p.file === file);
}

export interface PageFilters {
  round?: number;
  subject?: SubjectId;
  includeCover?: boolean;
}

export function filterPages(pages: PageEntry[], f: PageFilters): PageEntry[] {
  return pages.filter((p) => {
    if (!f.includeCover && p.is_cover) return false;
    if (f.round && p.round !== f.round) return false;
    if (f.subject && !p.subjects.includes(f.subject)) return false;
    return true;
  });
}

export function listRounds(): number[] {
  return [...new Set(dataset.pages.map((p) => p.round).filter((r): r is number => r !== null))].sort();
}

export const SUBJECTS: { id: SubjectId; name: string }[] = [
  { id: 1, name: "소방원론" },
  { id: 2, name: "소방전기일반" },
  { id: 3, name: "소방관계법규" },
  { id: 4, name: "소방전기시설의 구조 및 원리" },
];

export function imageUrl(file: string): string {
  return `/pages/2025/${file}`;
}
