"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cardImageUrl, getAllCards, getCardById } from "@/lib/data";
import { loadProgress, type Progress } from "@/lib/storage";
import type { Card } from "@/lib/types";

type Tab = "review" | "known" | "bookmarks" | "notes";

export default function NotesPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [tab, setTab] = useState<Tab>("review");

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  const lists = useMemo(() => {
    if (!progress) return null;
    const all = getAllCards();
    const byId = new Map(all.map((c) => [c.id, c]));
    const review: Card[] = [];
    const known: Card[] = [];
    for (const [id, s] of Object.entries(progress.cardStatus)) {
      const c = byId.get(id);
      if (!c) continue;
      if (s === "review") review.push(c);
      else if (s === "known") known.push(c);
    }
    const bookmarks = progress.bookmarks
      .map((id) => byId.get(id) ?? getCardById(id))
      .filter((c): c is Card => !!c);
    const notes = Object.entries(progress.notes)
      .map(([id, text]) => ({ card: byId.get(id), text }))
      .filter((n) => !!n.card) as { card: Card; text: string }[];
    return { review, known, bookmarks, notes };
  }, [progress]);

  if (!progress || !lists) return <div>로딩 중…</div>;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "review", label: "🔁 다시 볼 것", count: lists.review.length },
    { id: "known", label: "✅ 익힘", count: lists.known.length },
    { id: "bookmarks", label: "🔖 북마크", count: lists.bookmarks.length },
    { id: "notes", label: "📝 메모", count: lists.notes.length },
  ];

  const items: Card[] =
    tab === "review" ? lists.review :
    tab === "known"  ? lists.known :
    tab === "bookmarks" ? lists.bookmarks :
    lists.notes.map((n) => n.card);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">복습</h1>

      <div className="flex gap-2 text-xs flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2 py-1.5 rounded ${tab === t.id ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {lists.review.length > 0 && (
        <Link
          href={`/study?start=${lists.review[0].id}`}
          className="block w-full rounded-lg bg-yellow-500/90 text-white p-3 text-center text-sm font-medium"
        >
          🔁 다시 볼 카드부터 학습하기
        </Link>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-stone-500 py-6 text-center">
          항목이 없습니다.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map((c) => (
            <li key={c.id}>
              <Link
                href={`/study?start=${c.id}`}
                className="block group"
              >
                <div className="aspect-[3/4] overflow-hidden rounded border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cardImageUrl(c.file)}
                    alt={c.id}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:opacity-90"
                  />
                </div>
                <div className="text-xs mt-1 flex justify-between text-stone-600 dark:text-stone-400">
                  <span>{c.page_marker ?? "-"}</span>
                  <span>제{c.round ?? "-"}회</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
