"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPageByFile, imageUrl } from "@/lib/data";
import { loadProgress, type Progress } from "@/lib/storage";

type Tab = "bookmarks" | "notes";

export default function NotesPage() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [tab, setTab] = useState<Tab>("bookmarks");

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  if (!progress) return <div>로딩 중…</div>;

  const items =
    tab === "bookmarks"
      ? progress.bookmarks.map((f) => ({ file: f, note: progress.notes[f] ?? "" }))
      : Object.entries(progress.notes).map(([f, n]) => ({ file: f, note: n }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">북마크 · 메모</h1>
      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setTab("bookmarks")}
          className={`px-3 py-1.5 rounded ${tab === "bookmarks" ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
        >
          북마크 ({progress.bookmarks.length})
        </button>
        <button
          onClick={() => setTab("notes")}
          className={`px-3 py-1.5 rounded ${tab === "notes" ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}
        >
          메모 ({Object.keys(progress.notes).length})
        </button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-stone-500 py-6 text-center">
          {tab === "bookmarks" ? "북마크한 페이지가 없습니다." : "메모가 없습니다."}
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((it) => {
            const page = getPageByFile(it.file);
            return (
              <li key={it.file} className="rounded-lg border border-stone-300 dark:border-stone-700 p-3">
                <Link href={`/pages/${encodeURIComponent(it.file)}`} className="flex gap-3 hover:opacity-90">
                  <div className="w-20 h-28 shrink-0 overflow-hidden rounded bg-stone-100 dark:bg-stone-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(it.file)} alt={it.file} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-stone-500">
                      {page?.page_marker ?? it.file} · 제{page?.round ?? "?"}회
                    </div>
                    {it.note && (
                      <div className="text-sm mt-1 line-clamp-3 whitespace-pre-wrap">{it.note}</div>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
