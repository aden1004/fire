"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { use } from "react";
import { getQuestionById } from "@/lib/data";
import {
  loadProgress,
  recordAnswer,
  clearAnswer,
  toggleBookmark,
  type Progress,
} from "@/lib/storage";

export default function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const q = getQuestionById(id);
  const [picked, setPicked] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  if (!q) return <div>문제를 찾을 수 없습니다.</div>;

  const isBookmarked = progress?.bookmarks.includes(q.id) ?? false;
  const prior = progress?.answered[q.id];

  const onSubmit = async () => {
    if (!picked || !q.answer) {
      setReveal(true);
      return;
    }
    setReveal(true);
    const updated = await recordAnswer(q.id, picked, picked === q.answer);
    setProgress(updated);
  };

  const onReset = async () => {
    setPicked(null);
    setReveal(false);
    if (progress?.answered[q.id]) {
      setProgress(await clearAnswer(q.id));
    }
  };

  return (
    <article className="space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <Link href="/questions" className="text-stone-500 hover:underline">← 목록</Link>
        <span className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800">제{q.round}회 · {q.number}번</span>
        <span className="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-700/30 text-brand-700 dark:text-brand-50">
          {q.subject_name}
        </span>
        <span className="text-yellow-600">{"★".repeat(q.importance)}</span>
        <button
          onClick={async () => setProgress(await toggleBookmark(q.id))}
          className="ml-auto text-lg"
          aria-label="북마크 토글"
        >
          {isBookmarked ? "🔖" : "📑"}
        </button>
      </div>

      <div className="preserve text-base">{q.stem}</div>

      <ul className="space-y-2">
        {q.choices.map((c) => {
          const isPicked = picked === c.label;
          const isCorrect = reveal && q.answer === c.label;
          const isWrongPick = reveal && isPicked && q.answer !== c.label;
          return (
            <li key={c.label}>
              <button
                onClick={() => !reveal && setPicked(c.label)}
                disabled={reveal}
                className={`w-full text-left rounded-lg border p-3 flex gap-2
                  ${isCorrect ? "border-green-500 bg-green-50 dark:bg-green-900/30" : ""}
                  ${isWrongPick ? "border-red-500 bg-red-50 dark:bg-red-900/30" : ""}
                  ${!reveal && isPicked ? "border-brand-700" : "border-stone-300 dark:border-stone-700"}
                `}
              >
                <span className="font-bold">{c.label}</span>
                <span className="preserve">{c.text}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        {!reveal ? (
          <button
            onClick={onSubmit}
            className="px-4 py-2 rounded bg-brand-700 text-white text-sm font-medium"
          >
            {picked ? "정답 확인" : "정답 보기"}
          </button>
        ) : (
          <button
            onClick={onReset}
            className="px-4 py-2 rounded bg-stone-200 dark:bg-stone-800 text-sm"
          >
            다시 풀기
          </button>
        )}
        {prior && (
          <span className="text-sm self-center text-stone-500">
            이전: {prior.picked} ({prior.correct ? "정답" : "오답"})
          </span>
        )}
      </div>

      {reveal && (
        <div className="space-y-3">
          <div className="rounded-lg bg-stone-100 dark:bg-stone-900 p-3 text-sm">
            <div className="text-stone-500 mb-1">정답</div>
            <div className="font-semibold">{q.answer || "(미수록)"}</div>
          </div>
          {q.explanation && (
            <div className="rounded-lg bg-stone-100 dark:bg-stone-900 p-3">
              <div className="text-stone-500 text-sm mb-1">해설</div>
              <div className="preserve text-sm">{q.explanation}</div>
            </div>
          )}
          {q.mnemonics.length > 0 && (
            <div className="rounded-lg border border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 p-3">
              <div className="text-yellow-700 dark:text-yellow-200 text-sm font-medium mb-1">암기팁</div>
              <ul className="text-sm space-y-1">
                {q.mnemonics.map((m, i) => (
                  <li key={i}>
                    <span className="font-medium">{m.keyword}</span>
                    {m.tip && <span className="text-stone-700 dark:text-stone-300"> — {m.tip}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
