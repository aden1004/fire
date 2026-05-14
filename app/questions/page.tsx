"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { filterQuestions, getAllQuestions, listRounds, SUBJECTS } from "@/lib/data";
import type { SubjectId } from "@/lib/types";

function QuestionsInner() {
  const params = useSearchParams();
  const round = params.get("round") ? Number(params.get("round")) : undefined;
  const subject = params.get("subject") ? (Number(params.get("subject")) as SubjectId) : undefined;
  const importance = params.get("importance") ? Number(params.get("importance")) : undefined;
  const search = params.get("q") ?? undefined;

  const all = getAllQuestions();
  const rounds = listRounds();
  const list = useMemo(
    () => filterQuestions(all, { round, subject, importance, search }),
    [all, round, subject, importance, search],
  );

  const setParam = (key: string, val: string | undefined) => {
    const sp = new URLSearchParams(params.toString());
    if (val === undefined || val === "") sp.delete(key);
    else sp.set(key, val);
    return `?${sp.toString()}`;
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">문제 목록</h1>

      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap text-sm">
          <span className="text-stone-500 self-center">회차:</span>
          <Link
            href={setParam("round", undefined)}
            className={`px-2 py-1 rounded ${!round ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
          >
            전체
          </Link>
          {rounds.map((r) => (
            <Link
              key={r}
              href={setParam("round", String(r))}
              className={`px-2 py-1 rounded ${round === r ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
            >
              제{r}회
            </Link>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap text-sm">
          <span className="text-stone-500 self-center">과목:</span>
          <Link
            href={setParam("subject", undefined)}
            className={`px-2 py-1 rounded ${!subject ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
          >
            전체
          </Link>
          {SUBJECTS.map((s) => (
            <Link
              key={s.id}
              href={setParam("subject", String(s.id))}
              className={`px-2 py-1 rounded ${subject === s.id ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
            >
              {s.name}
            </Link>
          ))}
        </div>

        <div className="flex gap-2 flex-wrap text-sm">
          <span className="text-stone-500 self-center">중요도:</span>
          {[undefined, 1, 2, 3].map((lvl) => (
            <Link
              key={String(lvl)}
              href={setParam("importance", lvl ? String(lvl) : undefined)}
              className={`px-2 py-1 rounded ${importance === lvl ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
            >
              {lvl ? "★".repeat(lvl) + " 이상" : "전체"}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-sm text-stone-500">{list.length}문항</div>

      <ul className="divide-y divide-stone-200 dark:divide-stone-800">
        {list.map((q) => (
          <li key={q.id}>
            <Link href={`/questions/${q.id}`} className="block py-3 hover:bg-stone-100 dark:hover:bg-stone-900 -mx-2 px-2 rounded">
              <div className="flex items-start gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 whitespace-nowrap">
                  제{q.round}회 · {q.number}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-700/30 text-brand-700 dark:text-brand-50 whitespace-nowrap">
                  {q.subject_name}
                </span>
                <span className="text-xs text-yellow-600 whitespace-nowrap">{"★".repeat(q.importance)}</span>
              </div>
              <div className="text-sm mt-1 line-clamp-2 text-stone-700 dark:text-stone-300">
                {q.stem}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div>로딩 중…</div>}>
      <QuestionsInner />
    </Suspense>
  );
}
