"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
  cardImageUrl,
  filterCards,
  getAllCards,
  SUBJECTS,
} from "@/lib/data";
import {
  loadProgress,
  recordAttempt,
  registerCorrectAnswer,
  setCardStatus,
  setLastCard,
  setNote,
  toggleBookmark,
  type ChoiceLabel,
  type Progress,
} from "@/lib/storage";
import type { SubjectId } from "@/lib/types";

const CHOICES: ChoiceLabel[] = ["①", "②", "③", "④"];

function StudyInner() {
  const params = useSearchParams();
  const round = params.get("round") ? Number(params.get("round")) : undefined;
  const subject = params.get("subject") ? (Number(params.get("subject")) as SubjectId) : undefined;
  const startId = params.get("start") ?? undefined;

  const all = getAllCards();
  const deck = useMemo(() => filterCards(all, { round, subject }), [all, round, subject]);

  // All hook calls must come BEFORE any conditional return.
  const [progress, setProgress] = useState<Progress | null>(null);
  const [pos, setPos] = useState(0);
  const [picked, setPicked] = useState<ChoiceLabel | null>(null);
  const [feedback, setFeedback] = useState<"correct" | "wrong" | "register" | null>(null);
  const [noteText, setNoteText] = useState("");

  const current = deck[pos];

  // Load progress on mount
  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  // Set initial position once progress + deck are ready
  useEffect(() => {
    if (!progress || deck.length === 0) return;
    let initial = 0;
    if (startId) {
      const i = deck.findIndex((c) => c.id === startId);
      if (i >= 0) initial = i;
    } else if (progress.lastCardId) {
      const i = deck.findIndex((c) => c.id === progress.lastCardId);
      if (i >= 0) initial = i;
    }
    setPos(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress?.lastCardId, deck.length, startId]);

  // Reset card-local state and load note when the current card changes
  useEffect(() => {
    if (!current) return;
    setPicked(null);
    setFeedback(null);
    if (progress) setNoteText(progress.notes[current.id] ?? "");
    setLastCard(current.id);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived: aggregate stats over the current deck
  const stats = useMemo(() => {
    let known = 0, review = 0, unseen = 0, registered = 0;
    if (!progress) return { known, review, unseen, registered };
    for (const c of deck) {
      const s = progress.cardStatus[c.id];
      if (s === "known") known++;
      else if (s === "review") review++;
      else unseen++;
      if (progress.cardAnswers[c.id]) registered++;
    }
    return { known, review, unseen, registered };
  }, [deck, progress]);

  const goNext = useCallback(() => {
    if (pos + 1 < deck.length) setPos((p) => p + 1);
  }, [pos, deck.length]);

  const goPrev = useCallback(() => {
    if (pos > 0) setPos((p) => p - 1);
  }, [pos]);

  // Pick handler: instant feedback if answer registered, else prompt to register.
  const onPick = useCallback(async (label: ChoiceLabel) => {
    if (!current || !progress) return;
    setPicked(label);
    const correctLabel = progress.cardAnswers[current.id];
    if (!correctLabel) {
      // First encounter — reveal the card so user can read the answer area,
      // then ask them to register the correct answer.
      setFeedback("register");
      return;
    }
    const isCorrect = label === correctLabel;
    setFeedback(isCorrect ? "correct" : "wrong");
    setProgress(await recordAttempt(current.id, label, isCorrect));
  }, [current, progress]);

  const onRegister = useCallback(async (label: ChoiceLabel) => {
    if (!current || !progress) return;
    const next = await registerCorrectAnswer(current.id, label);
    // Score the original pick
    if (picked) {
      const isCorrect = picked === label;
      const updated = await recordAttempt(current.id, picked, isCorrect);
      setFeedback(isCorrect ? "correct" : "wrong");
      setProgress(updated);
    } else {
      setProgress(next);
      setFeedback(null);
    }
  }, [current, progress, picked]);

  const onBookmark = useCallback(async () => {
    if (!current) return;
    setProgress(await toggleBookmark(current.id));
  }, [current]);

  const onMark = useCallback(async (status: "known" | "review") => {
    if (!current) return;
    setProgress(await setCardStatus(current.id, status));
    goNext();
  }, [current, goNext]);

  // Keyboard shortcuts (registered always; bail out inside if state isn't ready)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!current) return;
      if (e.key === "1") onPick("①");
      else if (e.key === "2") onPick("②");
      else if (e.key === "3") onPick("③");
      else if (e.key === "4") onPick("④");
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key.toLowerCase() === "k") onMark("known");
      else if (e.key.toLowerCase() === "r") onMark("review");
      else if (e.key.toLowerCase() === "b") onBookmark();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, onPick, goNext, goPrev, onMark, onBookmark]);

  function setParam(key: string, val: string | undefined) {
    const sp = new URLSearchParams(params.toString());
    if (val === undefined) sp.delete(key);
    else sp.set(key, val);
    const q = sp.toString();
    return q ? `/study?${q}` : "/study";
  }

  // ===== Conditional renders (after all hooks have been declared) =====

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

  if (!current) return <div>카드 로드 중…</div>;

  const registeredAnswer = progress.cardAnswers[current.id];
  const attempt = progress.cardAttempts[current.id];
  const reveal = picked !== null;
  const bookmarked = progress.bookmarks.includes(current.id);
  const cardStatus = progress.cardStatus[current.id];

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

      {/* Progress strip */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-stone-500">
          {pos + 1} / {deck.length}
          {current.page_marker && <span> · {current.page_marker}</span>}
          <span> · 제{current.round}회</span>
        </span>
        <span className="ml-auto text-stone-500">
          ✅ {stats.known} · 🔁 {stats.review} · ⬜ {stats.unseen} · 답록 {stats.registered}/{deck.length}
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

      {/* Card image with bottom overlay until picked */}
      <div className="relative rounded-lg overflow-hidden border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cardImageUrl(current.file)}
          alt={current.id}
          className="block w-full"
        />
        {!reveal && (
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-stone-50/70 dark:bg-stone-900/70 flex items-center justify-center border-t border-stone-300 dark:border-stone-700"
            style={{ height: "42%" }}
          >
            <span className="text-sm text-stone-600 dark:text-stone-300">
              아래에서 답을 선택하면 해설 영역이 공개됩니다
            </span>
          </div>
        )}
      </div>

      {/* Choice buttons */}
      <div className="grid grid-cols-4 gap-2">
        {CHOICES.map((label) => {
          const isPicked = picked === label;
          const isRegistered = registeredAnswer === label && feedback !== null;
          const showAsCorrect = (feedback === "correct" && isPicked) || (feedback === "wrong" && isRegistered);
          const showAsWrong = feedback === "wrong" && isPicked;
          return (
            <button
              key={label}
              onClick={() => !picked && onPick(label)}
              disabled={picked !== null}
              className={`h-14 rounded-lg text-2xl font-bold border transition
                ${showAsCorrect ? "bg-green-500 text-white border-green-500" :
                  showAsWrong ? "bg-red-500 text-white border-red-500" :
                  isPicked ? "bg-brand-700 text-white border-brand-700" :
                  "bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border-stone-300 dark:border-stone-700 active:scale-95"}
                disabled:opacity-100`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Feedback panel */}
      {feedback === "register" && (
        <div className="rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/40 p-3 space-y-2">
          <div className="text-sm font-medium text-yellow-900 dark:text-yellow-100">
            이 카드의 정답을 처음 만났어요. 위 해설에 적힌 정답을 한 번만 등록해 주세요 (다음부터 자동 채점).
          </div>
          <div className="grid grid-cols-4 gap-2">
            {CHOICES.map((label) => (
              <button
                key={label}
                onClick={() => onRegister(label)}
                className="h-10 rounded bg-yellow-500 text-white text-lg font-bold"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {feedback === "correct" && (
        <div className="rounded-lg bg-green-500/15 border border-green-500 p-3 text-sm">
          ✅ 정답입니다.
          {attempt && <span className="text-stone-500"> (누적 {attempt.correct}/{attempt.correct + attempt.wrong})</span>}
        </div>
      )}
      {feedback === "wrong" && (
        <div className="rounded-lg bg-red-500/15 border border-red-500 p-3 text-sm">
          ❌ 정답은 <span className="font-bold">{registeredAnswer}</span> · 자동으로 「다시 볼 것」에 추가됨
          {attempt && <span className="text-stone-500"> (누적 {attempt.correct}/{attempt.correct + attempt.wrong})</span>}
        </div>
      )}

      {/* Bottom controls */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={goPrev}
          disabled={pos === 0}
          className="px-3 py-2 rounded bg-stone-200 dark:bg-stone-800 text-sm disabled:opacity-40"
        >
          ← 이전
        </button>
        <button
          onClick={() => onMark("review")}
          className={`px-3 py-2 rounded text-sm font-medium ${cardStatus === "review" ? "bg-yellow-600 text-white" : "bg-yellow-500/90 text-white"}`}
        >
          🔁 다시
        </button>
        <button
          onClick={() => onMark("known")}
          className={`px-3 py-2 rounded text-sm font-medium ${cardStatus === "known" ? "bg-green-700 text-white" : "bg-green-600 text-white"}`}
        >
          ✅ 익힘
        </button>
        <button
          onClick={goNext}
          disabled={pos === deck.length - 1}
          className="px-3 py-2 rounded bg-stone-200 dark:bg-stone-800 text-sm disabled:opacity-40"
        >
          다음 →
        </button>
      </div>

      <div className="text-xs text-stone-500 text-center">
        키보드: 1·2·3·4=답 선택 · ←→=이동 · K=익힘 · R=다시 · B=북마크
      </div>

      {/* Note */}
      <details className="text-sm">
        <summary className="cursor-pointer text-stone-600 dark:text-stone-400">
          메모
          {registeredAnswer && <span className="text-stone-400"> · 정답 등록됨: {registeredAnswer}</span>}
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

export default function StudyPage() {
  return (
    <Suspense fallback={<div>로딩 중…</div>}>
      <StudyInner />
    </Suspense>
  );
}
