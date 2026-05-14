"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getAllPages, getPageByFile, imageUrl, SUBJECTS } from "@/lib/data";
import {
  loadProgress,
  setLastViewed,
  setNote,
  toggleBookmark,
  type Progress,
} from "@/lib/storage";

export default function PageViewer({ params }: { params: Promise<{ file: string }> }) {
  const { file } = use(params);
  const router = useRouter();
  const page = getPageByFile(decodeURIComponent(file));
  const all = getAllPages();
  const idx = useMemo(() => all.findIndex((p) => p.file === decodeURIComponent(file)), [all, file]);
  const prev = idx > 0 ? all[idx - 1] : null;
  const next = idx >= 0 && idx < all.length - 1 ? all[idx + 1] : null;

  const [progress, setProgress] = useState<Progress | null>(null);
  const [noteText, setNoteText] = useState("");
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    loadProgress().then((p) => {
      setProgress(p);
      if (page) setNoteText(p.notes[page.file] ?? "");
    });
    if (page) setLastViewed(page.file);
  }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowLeft" && prev) router.push(`/pages/${encodeURIComponent(prev.file)}`);
      if (e.key === "ArrowRight" && next) router.push(`/pages/${encodeURIComponent(next.file)}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  if (!page) return <div>페이지를 찾을 수 없습니다.</div>;
  const bookmarked = progress?.bookmarks.includes(page.file) ?? false;

  return (
    <article className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <Link href="/pages" className="text-stone-500 hover:underline">← 목록</Link>
        {page.is_cover ? (
          <span className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800">표지</span>
        ) : (
          <>
            <span className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800">{page.page_marker}</span>
            <span className="px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800">제{page.round}회</span>
            <span className="px-1.5 py-0.5 rounded bg-brand-50 dark:bg-brand-700/30 text-brand-700 dark:text-brand-50">
              {page.subjects.map((s) => SUBJECTS.find((x) => x.id === s)?.name).join(" / ")}
            </span>
          </>
        )}
        <button
          onClick={async () => setProgress(await toggleBookmark(page.file))}
          className="ml-auto text-lg"
          aria-label="북마크 토글"
        >
          {bookmarked ? "🔖" : "📑"}
        </button>
      </div>

      <div
        onClick={() => setZoom((z) => !z)}
        className={`rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 cursor-zoom-${zoom ? "out" : "in"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(page.file)}
          alt={page.page_marker ?? page.file}
          className={zoom ? "w-full" : "w-full max-h-[80vh] object-contain"}
        />
      </div>

      <div className="flex justify-between">
        {prev ? (
          <Link href={`/pages/${encodeURIComponent(prev.file)}`} className="px-3 py-2 rounded bg-stone-200 dark:bg-stone-800 text-sm">
            ← 이전 {prev.page_marker ?? "표지"}
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/pages/${encodeURIComponent(next.file)}`} className="px-3 py-2 rounded bg-stone-200 dark:bg-stone-800 text-sm">
            다음 {next.page_marker ?? ""} →
          </Link>
        ) : <span />}
      </div>

      <div className="space-y-2">
        <label className="block text-xs text-stone-500">메모 (이 페이지에 대한 본인 정리)</label>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={async () => setProgress(await setNote(page.file, noteText))}
          placeholder="예: 옴의 법칙 / 자주 헷갈리는 단위 / ..."
          rows={3}
          className="w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
        />
      </div>
    </article>
  );
}
