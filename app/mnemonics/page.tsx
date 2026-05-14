"use client";

import { useMemo, useState } from "react";
import { getDataset } from "@/lib/data";

export default function MnemonicsPage() {
  const ds = getDataset();
  const all = ds.mnemonic_keywords;
  const [round, setRound] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return all.filter((m) => {
      if (round && m.round !== round) return false;
      if (q && !m.keyword.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [all, round, q]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">암기팁 키워드</h1>
      <p className="text-xs text-stone-500">
        OCR에서 추출한 「기억법」 키워드 모음. 본문 설명·니모닉 풀이는 해당 페이지를 직접 펴서 확인하세요.
      </p>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="키워드 검색"
        className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
      />

      <div className="flex gap-2 text-sm flex-wrap">
        <button
          onClick={() => setRound(null)}
          className={`px-2 py-1 rounded ${!round ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
        >
          전체
        </button>
        {[1, 2, 3].map((r) => (
          <button
            key={r}
            onClick={() => setRound(r)}
            className={`px-2 py-1 rounded ${round === r ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
          >
            제{r}회
          </button>
        ))}
      </div>

      <div className="text-sm text-stone-500">{filtered.length}개</div>

      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {filtered.map((m, i) => (
          <li key={i} className="rounded-lg border border-stone-300 dark:border-stone-700 p-3">
            <div className="font-mono text-lg">{m.keyword}</div>
            <div className="text-xs text-stone-500 mt-1">제{m.round}회</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
