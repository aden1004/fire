export type SubjectId = 1 | 2 | 3 | 4;
export type Importance = 1 | 2 | 3;
export type ChoiceLabel = "①" | "②" | "③" | "④";

export interface Choice {
  label: ChoiceLabel;
  text: string;
}

export interface Mnemonic {
  keyword: string;
  tip: string;
}

export interface Question {
  id: string;
  round: number;
  number: number;
  subject: SubjectId;
  subject_name: string;
  importance: Importance;
  stem: string;
  choices: Choice[];
  answer: ChoiceLabel | "";
  explanation: string;
  mnemonics: Mnemonic[];
  pages: number[];
  complete: boolean;
}

export interface MnemonicEntry extends Mnemonic {
  round: number;
  subject: SubjectId;
  subject_name: string;
  question_id: string;
  question_number: number;
}

export interface Dataset {
  year: number;
  subjects: Record<string, string>;
  questions: Question[];
  mnemonics: MnemonicEntry[];
  report?: unknown;
}
