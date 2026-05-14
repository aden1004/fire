export type SubjectId = 1 | 2 | 3 | 4;

export interface PageEntry {
  file: string;
  chunk: number;
  in_chunk: number;
  is_cover: boolean;
  round: number | null;
  book_page: number | null;
  page_marker: string | null;
  primary_subject: SubjectId | null;
  subjects: SubjectId[];
}

export interface RoundInfo {
  date: string;
  footer_code: string;
  first_page: number;
  last_page: number;
}

export interface MnemonicKeyword {
  round: number;
  keyword: string;
  ocr_line: number;
}

export interface PagesDataset {
  year: number;
  rounds: Record<string, RoundInfo>;
  subjects: Record<string, string>;
  pages: PageEntry[];
  mnemonic_keywords: MnemonicKeyword[];
  notes: string;
}
