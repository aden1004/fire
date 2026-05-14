"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  cardImageUrl,
  filterCards,
  getAllCards,
  SUBJECTS,
} from "@/lib/data";
import {
  loadProgress,
  setCardStatus,
  setLastCard,
  setNote,
  toggleBookmark,
  type Progress,
} from "@/lib/storage";
import type { SubjectId } from "@/lib/types";

function StudyInner() {
  const params = useSearchParams();
  const router = useRouter();
  const round = params.get("round") ? Number(params.get("round")) : undefined;
  const subject = params.get("subject") ? (Number(params.get("subject")) as SubjectId) : undefined;
  const startId = params.get("start") ?? undefined;
  const reviewOnly = params.get("mode") === "review";

  const all = getAllCards();
  const deck = useMemo(() => {
    const filtered = filterCards(all, { round, subject });
    return filtered;
  }, [all, round, subject]);

  const [progress, setProgress] = useState<Progress | null>(null);
  const [pos, setPos] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [noteText, setNoteText] = useState("");

  // Initial position: 'start' query overrides; else resume from lastCardId; else 0.
  useEffect(() => {
    if (!progress) return;
    let initial = 0;
    if (startId) {
      const i = deck.findIndex((c) => c.id === startId);
      if (i >= 0) initial = i;
    } else if (progress.lastCardId) {
      const i = deck.findIndex((c) => c.id === progress.lastCardId);
      if (i >= 0) initial = i;
    }
    setPos(initial);
  }, [progress, deck, startId]);

  // Reset reveal + load note whenever current card changes
  const current = deck[pos];
  useEffect(() => {
    setReveal(false);
    if (current && progress) {
      setNoteText(progress.notes[current.id] ?? "");
      setLastCard(current.id);
    }
  }, [current?.id, progress?.notes, current, progress]);

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!reveal) setReveal(true);
        else next();
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key.toLowerCase() === "b") onBookmark();
      else if (e.key.toLowerCase() === "k") onMark("known");
      else if (e.key.toLowerCase() === "r") onMark("review");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal, pos, deck, current?.id]);

  if (!progress) return <div>로딩 중…</div>;

  if (deck.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">학습 카드</h1>
        <p className="text-sm text-stone-500">조건에 맞는 카드가 없습니다.</p>
        <Link href="/study" className="text-brand-700 text-sm">필터 초기화</Link>
      </div>
    );
  }

  if (!current) return null;

  function setParam(key: string, val: string | undefined) {
    const sp = new URLSearchParams(params.toString());
    if (val === undefined) sp.delete(key);
    else sp.set(key, val);
    const q = sp.toString();
    return q ? `/study?${q}` : "/study";
  }

  function next() {
    if (pos + 1 < deck.length) setPos(pos + 1);
  }
  function prev() {
    if (pos > 0) setPos(pos - 1);
  }
  async function onBookmark() {
    if (!current) return;
    setProgress(await toggleBookmark(current.id));
  }
  async function onMark(status: "known" | "review") {
    if (!current) return;
    setProgress(await setCardStatus(current.id, status));
    next();
  }

  const bookmarked = progress.bookmarks.includes(current.id);
  const status = progress.cardStatus[current.id];
  const stats = useStats(deck, progress);

  void reviewOnly; // reviewOnly is informational; deck composition handled by caller
  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="self-center text-stone-500">회차:</span>
        <Link href={setParam("round", undefined)} className={`px-2 py-1 rounded ${!round ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}>전체</Link>
        {[1, 2, 3].map((r) => (
          <Link key={r} href={setParam("round", String(r))} className={`px-2 py-1 rounded ${round === r ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}>제{r}회</Link>
        ))}
        <span className="self-center text-stone-500 ml-2">과목:</span>
        <Link href={setParam("subject", undefined)} className={`px-2 py-1 rounded ${!subject ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}>전체</Link>
        {SUBJECTS.map((s) => (
          <Link key={s.id} href={setParam("subject", String(s.id))} className={`px-2 py-1 rounded ${subject === s.id ? "bg-brand-700 text-white" : "bg-stone-200 dark:bg-stone-800"}`}>{s.name}</Link>
        ))}
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-stone-500">
          {pos + 1} / {deck.length}
          {current.page_marker && <span> · {current.page_marker}</span>}
          <span> · 제{current.round}회</span>
        </span>
        <span className="ml-auto text-stone-500">
          ✅ {stats.known} · 🔁 {stats.review} · ⬜ {stats.unseen}
        </span>
        <button onClick={onBookmark} aria-label="북마크" className="text-lg">
          {bookmarked ? "🔖" : "📑"}
        </button>
      </div>
      <div className="h-1 bg-stone-200 dark:bg-stone-800 rounded">
        <div
          className="h-full bg-brand-700 rounded transition-all"
          style={{ width: `${((pos + 1) / deck.length) * 100}%` }}
        />
      </div>

      {/* Card image with reveal overlay */}
      <div className="relative rounded-lg overflow-hidden border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cardImageUrl(current.file)}
          alt={current.id}
          className="block w-full"
        />
        {!reveal && (
          <button
            type="button"
            onClick={() => setReveal(true)}
            aria-label="정답·해설 보기"
            className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-stone-50/70 dark:bg-stone-900/70 text-stone-700 dark:text-stone-200 hover:bg-stone-50/85 dark:hover:bg-stone-900/85 transition flex items-center justify-center font-medium border-t border-stone-300 dark:border-stone-700"
            style={{ height: "42%" }}
          >
            <span className="text-sm">탭 / Space — 정답·해설 보기</span>
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={prev}
          disabled={pos === 0}
          className="px-3 py-2 rounded bg-stone-200 dark:bg-stone-800 text-sm disabled:opacity-40"
        >
          ← 이전
        </button>
        {!reveal ? (
          <button
            onClick={() => setReveal(true)}
            className="px-3 py-2 rounded bg-brand-700 text-white text-sm font-medium"
          >
            정답 보기 (Space)
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            <button
              onClick={() => onMark("review")}
              className="px-2 py-2 rounded bg-yellow-500/90 text-white text-xs font-medium"
              title="R"
            >
              🔁 다시 볼 것
            </button>
            <button
              onClick={() => onMark("known")}
              className="px-2 py-2 rounded bg-green-600 text-white text-xs font-medium"
              title="K"
            >
              ✅ 익혔다
            </button>
          </div>
        )}
        <button
          onClick={next}
          disabled={pos === deck.length - 1}
          className="px-3 py-2 rounded bg-stone-200 dark:bg-stone-800 text-sm disabled:opacity-40"
        >
          다음 →
        </button>
      </div>

      <div className="text-xs text-stone-500 text-center">
        키보드: Space/Enter=정답·다음 · ←→=이동 · K=익힘 · R=다시 · B=북마크
      </div>

      {/* Note */}
      <details className="text-sm">
        <summary className="cursor-pointer text-stone-600 dark:text-stone-400">
          메모 {status === "review" ? "· 🔁 다시 볼 것 표시됨" : status === "known" ? "· ✅ 익힘 표시됨" : ""}
        </summary>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={async () => setProgress(await setNote(current.id, noteText))}
          rows={3}
          placeholder="이 문제에 대한 본인 정리"
          className="mt-2 w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
        />
      </details>
    </div>
  );
}

function useStats(deck: { id: string }[], progress: Progress) {
  return useMemo(() => {
    let known = 0, review = 0, unseen = 0;
    for (const c of deck) {
      const s = progress.cardStatus[c.id];
      if (s === "known") known++;
      else if (s === "review") review++;
      else unseen++;
    }
    return { known, review, unseen };
  }, [deck, progress]);
}

export default function StudyPage() {
  return (
    <Suspense fallback={<div>로딩 중…</div>}>
      <StudyInner />
    </Suspense>
  );
}
