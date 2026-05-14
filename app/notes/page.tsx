"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getQuestionById } from "@/lib/data";
import { loadProgress, type Progress } from "@/lib/storage";
import type { Question } from "@/lib/types";

type Tab = "wrong" | "bookmarks";

export default function NotesPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [tab, setTab] = useState<Tab>("wrong");

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  if (!progress) return <div>로딩 중…</div>;

  const ids = tab === "wrong" ? progress.wrong : progress.bookmarks;
  const items = ids
    .map((id) => getQuestionById(id))
    .filter((q): q is Question => !!q);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">오답노트·북마크</h1>
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setTab("wrong")}
          className={`px-3 py-1.5 rounded ${tab === "wrong" ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
        >
          오답 ({progress.wrong.length})
        </button>
        <button
          onClick={() => setTab("bookmarks")}
          className={`px-3 py-1.5 rounded ${tab === "bookmarks" ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
        >
          북마크 ({progress.bookmarks.length})
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-stone-500 py-6 text-center">
          {tab === "wrong" ? "아직 오답이 없습니다." : "북마크한 문제가 없습니다."}
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {items.map((q) => (
            <li key={q.id}>
              <Link
                href={`/questions/${q.id}`}
                className="block py-3 hover:bg-stone-100 dark:hover:bg-stone-900 -mx-2 px-2 rounded"
              >
                <div className="flex items-start gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800">
                    제{q.round}회 · {q.number}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-700/30 text-brand-700 dark:text-brand-50">
                    {q.subject_name}
                  </span>
                </div>
                <div className="text-sm mt-1 line-clamp-2">{q.stem}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
