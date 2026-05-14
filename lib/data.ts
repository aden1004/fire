import type {
  Card,
  CardsDataset,
  PageEntry,
  PagesDataset,
  SubjectId,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pagesData = require("@/data/normalized/2025_pages.json") as PagesDataset;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cardsData = require("@/data/normalized/2025_cards.json") as CardsDataset;

export function getDataset(): PagesDataset {
  return pagesData;
}

export function getAllPages(): PageEntry[] {
  return pagesData.pages;
}

export function getPageByFile(file: string): PageEntry | undefined {
  return pagesData.pages.find((p) => p.file === file);
}

export function getAllCards(): Card[] {
  return cardsData.cards;
}

export function getCardById(id: string): Card | undefined {
  return cardsData.cards.find((c) => c.id === id);
}

export interface CardFilters {
  round?: number;
  subject?: SubjectId;
}

export function filterCards(cards: Card[], f: CardFilters): Card[] {
  return cards.filter((c) => {
    if (f.round && c.round !== f.round) return false;
    if (f.subject && !c.subjects.includes(f.subject)) return false;
    return true;
  });
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
  return [...new Set(cardsData.cards.map((c) => c.round).filter((r): r is number => r !== null))].sort();
}

export const SUBJECTS: { id: SubjectId; name: string }[] = [
  { id: 1, name: "소방원론" },
  { id: 2, name: "소방전기일반" },
  { id: 3, name: "소방관계법규" },
  { id: 4, name: "소방전기시설의 구조 및 원리" },
];

export function cardImageUrl(file: string): string {
  return `/cards/2025/${file}`;
}

export function pageImageUrl(file: string): string {
  return `/pages/2025/${file}`;
}
