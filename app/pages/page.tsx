"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { filterPages, getAllPages, imageUrl, SUBJECTS } from "@/lib/data";
import type { SubjectId } from "@/lib/types";

function PagesInner() {
  const params = useSearchParams();
  const round = params.get("round") ? Number(params.get("round")) : undefined;
  const subject = params.get("subject") ? (Number(params.get("subject")) as SubjectId) : undefined;

  const all = getAllPages();
  const list = useMemo(() => filterPages(all, { round, subject }), [all, round, subject]);

  const setParam = (key: string, val: string | undefined) => {
    const sp = new URLSearchParams(params.toString());
    if (val === undefined) sp.delete(key);
    else sp.set(key, val);
    const q = sp.toString();
    return q ? `?${q}` : "/pages";
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">페이지 목록</h1>

      <div className="space-y-2 text-sm">
        <div className="flex gap-2 flex-wrap">
          <span className="text-stone-500 self-center">회차:</span>
          <Link href={setParam("round", undefined)} className={`px-2 py-1 rounded ${!round ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}>전체</Link>
          {[1, 2, 3].map((r) => (
            <Link key={r} href={setParam("round", String(r))} className={`px-2 py-1 rounded ${round === r ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}>제{r}회</Link>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          <span className="text-stone-500 self-center">과목:</span>
          <Link href={setParam("subject", undefined)} className={`px-2 py-1 rounded ${!subject ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}>전체</Link>
          {SUBJECTS.map((s) => (
            <Link key={s.id} href={setParam("subject", String(s.id))} className={`px-2 py-1 rounded ${subject === s.id ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}>
              {s.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="text-sm text-stone-500">{list.length}페이지</div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {list.map((p) => (
          <Link key={p.file} href={`/pages/${encodeURIComponent(p.file)}`} className="block group">
            <div className="aspect-[3/4] overflow-hidden rounded border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl(p.file)}
                alt={p.page_marker ?? p.file}
                loading="lazy"
                className="w-full h-full object-cover group-hover:opacity-90"
              />
            </div>
            <div className="mt-1 text-xs flex justify-between text-stone-600 dark:text-stone-400">
              <span>{p.page_marker ?? "표지"}</span>
              <span>제{p.round ?? "-"}회</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function PagesListPage() {
  return (
    <Suspense fallback={<div>로딩 중…</div>}>
      <PagesInner />
    </Suspense>
  );
}
