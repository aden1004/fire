"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getAllMnemonics } from "@/lib/data";
import { SUBJECTS } from "@/lib/data";

export default function MnemonicsPage() {
  const all = getAllMnemonics();
  const [subject, setSubject] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    return all.filter((m) => {
      if (subject && m.subject !== subject) return false;
      if (q) {
        const s = q.toLowerCase();
        if (!(m.keyword + m.tip).toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [all, subject, q]);

  const grouped = useMemo(() => {
    const map = new Map<number, typeof filtered>();
    for (const m of filtered) {
      const arr = map.get(m.subject) ?? [];
      arr.push(m);
      map.set(m.subject, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">암기팁 모음</h1>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="키워드 검색"
        className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          onClick={() => setSubject(null)}
          className={`px-2 py-1 rounded ${!subject ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
        >
          전체
        </button>
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSubject(s.id)}
            className={`px-2 py-1 rounded ${subject === s.id ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="text-sm text-stone-500">{filtered.length}개</div>

      <div className="space-y-6">
        {[...grouped.entries()].map(([subjectId, items]) => {
          const subj = SUBJECTS.find((s) => s.id === subjectId);
          return (
            <section key={subjectId}>
              <h2 className="font-semibold text-brand-700 dark:text-brand-500 mb-2">
                {subj?.name ?? `과목 ${subjectId}`}
              </h2>
              <ul className="space-y-2">
                {items.map((m, i) => (
                  <li key={i} className="rounded-lg border border-stone-300 dark:border-stone-700 p-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="font-medium">{m.keyword}</div>
                        {m.tip && (
                          <div className="text-sm text-stone-600 dark:text-stone-400 mt-1 preserve">{m.tip}</div>
                        )}
                      </div>
                      <Link
                        href={`/questions/${m.question_id}`}
                        className="text-xs text-stone-500 hover:underline whitespace-nowrap"
                      >
                        제{m.round}회 {m.question_number}번 →
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
