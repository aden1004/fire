"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getAllQuestions, SUBJECTS } from "@/lib/data";
import { recordAnswer } from "@/lib/storage";
import type { ChoiceLabel, Question } from "@/lib/types";

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildMockExam(): Question[] {
  const all = getAllQuestions();
  const out: Question[] = [];
  for (const subj of SUBJECTS) {
    const pool = all.filter((q) => q.subject === subj.id);
    out.push(...shuffle(pool).slice(0, 20));
  }
  return out;
}

export default function MockPage() {
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [items, setItems] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, ChoiceLabel>>({});
  const [remaining, setRemaining] = useState(2 * 60 * 60);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!started || submitted) return;
    timer.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          if (timer.current) clearInterval(timer.current);
          setSubmitted(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [started, submitted]);

  const onStart = () => {
    setItems(buildMockExam());
    setAnswers({});
    setRemaining(2 * 60 * 60);
    setStarted(true);
    setSubmitted(false);
  };

  const onSubmit = async () => {
    setSubmitted(true);
    if (timer.current) clearInterval(timer.current);
    for (const q of items) {
      const picked = answers[q.id];
      if (!picked || !q.answer) continue;
      await recordAnswer(q.id, picked, picked === q.answer);
    }
  };

  const stats = useMemo(() => {
    if (!submitted) return null;
    const perSubject: Record<number, { right: number; total: number }> = {};
    let right = 0;
    for (const q of items) {
      const picked = answers[q.id];
      const correct = picked && picked === q.answer;
      const k = perSubject[q.subject] ?? { right: 0, total: 0 };
      k.total += 1;
      if (correct) {
        k.right += 1;
        right += 1;
      }
      perSubject[q.subject] = k;
    }
    return { right, total: items.length, perSubject };
  }, [submitted, items, answers]);

  if (!started) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">모의고사</h1>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          과목당 20문 × 4과목 = 80문항 / 제한시간 2시간 (실제 시험과 동일).
          데이터셋에서 무작위로 추출합니다.
        </p>
        <button
          onClick={onStart}
          className="px-4 py-2 rounded bg-brand-700 text-white font-medium"
        >
          시작하기
        </button>
      </div>
    );
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const hh = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  if (submitted && stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">결과</h1>
        <div className="rounded-lg bg-stone-100 dark:bg-stone-900 p-4">
          <div className="text-3xl font-bold">
            {stats.right} / {stats.total}
          </div>
          <div className="text-sm text-stone-500 mt-1">
            정답률 {((stats.right / Math.max(1, stats.total)) * 100).toFixed(1)}%
          </div>
        </div>
        <div className="space-y-1 text-sm">
          {SUBJECTS.map((s) => {
            const v = stats.perSubject[s.id];
            if (!v) return null;
            return (
              <div key={s.id} className="flex justify-between">
                <span>{s.name}</span>
                <span>{v.right}/{v.total}</span>
              </div>
            );
          })}
        </div>
        <ul className="divide-y divide-stone-200 dark:divide-stone-800">
          {items.map((q) => {
            const picked = answers[q.id];
            const correct = picked === q.answer;
            return (
              <li key={q.id} className="py-2 text-sm">
                <Link href={`/questions/${q.id}`} className="flex items-start gap-2">
                  <span className={`inline-block w-6 ${correct ? "text-green-600" : "text-red-600"}`}>
                    {correct ? "○" : "×"}
                  </span>
                  <span className="flex-1 line-clamp-1">{q.stem}</span>
                  <span className="text-stone-500 whitespace-nowrap">
                    {picked || "-"} / {q.answer}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <button
          onClick={() => setStarted(false)}
          className="px-4 py-2 rounded bg-stone-200 dark:bg-stone-800 text-sm"
        >
          처음으로
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-14 z-10 flex justify-between items-center bg-stone-50/95 dark:bg-stone-950/95 py-2 -mx-4 px-4 border-b border-stone-200 dark:border-stone-800">
        <div className="font-bold tabular-nums">{hh}:{mm}:{ss}</div>
        <div className="text-sm text-stone-500">
          {Object.keys(answers).length}/{items.length} 답
        </div>
        <button
          onClick={onSubmit}
          className="text-sm px-3 py-1.5 rounded bg-brand-700 text-white"
        >
          제출
        </button>
      </div>

      <ol className="space-y-6">
        {items.map((q, idx) => (
          <li key={q.id} className="space-y-2">
            <div className="text-xs text-stone-500">
              {idx + 1}. [{q.subject_name}] 제{q.round}회 {q.number}번
            </div>
            <div className="preserve text-sm">{q.stem}</div>
            <ul className="space-y-1">
              {q.choices.map((c) => {
                const picked = answers[q.id] === c.label;
                return (
                  <li key={c.label}>
                    <button
                      onClick={() => setAnswers((p) => ({ ...p, [q.id]: c.label }))}
                      className={`w-full text-left rounded border p-2 text-sm flex gap-2
                        ${picked ? "border-brand-700 bg-brand-50 dark:bg-brand-700/20" : "border-stone-300 dark:border-stone-700"}
                      `}
                    >
                      <span className="font-bold">{c.label}</span>
                      <span className="preserve">{c.text}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
