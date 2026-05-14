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
  type Slot,
} from "@/lib/storage";
import type { SubjectId } from "@/lib/types";

const CHOICES: ChoiceLabel[] = ["①", "②", "③", "④"];
type Feedback = "correct" | "wrong" | "register" | null;

interface SlotInteraction {
  picked: ChoiceLabel | null;
  feedback: Feedback;
}

function StudyInner() {
  const params = useSearchParams();
  const round = params.get("round") ? Number(params.get("round")) : undefined;
  const subject = params.get("subject") ? (Number(params.get("subject")) as SubjectId) : undefined;
  const startId = params.get("start") ?? undefined;

  const all = getAllCards();
  const deck = useMemo(() => filterCards(all, { round, subject }), [all, round, subject]);

  // ALL hooks at top, before any conditional returns
  const [progress, setProgress] = useState<Progress | null>(null);
  const [pos, setPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [topState, setTopState] = useState<SlotInteraction>({ picked: null, feedback: null });
  const [bottomState, setBottomState] = useState<SlotInteraction>({ picked: null, feedback: null });
  const [showBottom, setShowBottom] = useState(false);
  const [noteText, setNoteText] = useState("");

  const current = deck[pos];

  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

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

  useEffect(() => {
    if (!current) return;
    setRevealed(false);
    setTopState({ picked: null, feedback: null });
    setBottomState({ picked: null, feedback: null });
    // Auto-show bottom slot if user previously registered an answer there
    const hasBottom = !!progress?.slots[current.id]?.bottom?.answer;
    setShowBottom(hasBottom);
    if (progress) setNoteText(progress.notes[current.id] ?? "");
    setLastCard(current.id);
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    let known = 0, review = 0, unseen = 0, registered = 0;
    if (!progress) return { known, review, unseen, registered };
    for (const c of deck) {
      const s = progress.cardStatus[c.id];
      if (s === "known") known++;
      else if (s === "review") review++;
      else unseen++;
      if (progress.slots[c.id]?.top?.answer || progress.slots[c.id]?.bottom?.answer) registered++;
    }
    return { known, review, unseen, registered };
  }, [deck, progress]);

  const goNext = useCallback(() => {
    if (pos + 1 < deck.length) setPos((p) => p + 1);
  }, [pos, deck.length]);

  const goPrev = useCallback(() => {
    if (pos > 0) setPos((p) => p - 1);
  }, [pos]);

  const onPick = useCallback(async (slot: Slot, label: ChoiceLabel) => {
    if (!current || !progress) return;
    setRevealed(true);
    const setState = slot === "top" ? setTopState : setBottomState;
    const slotData = progress.slots[current.id]?.[slot];
    const correctLabel = slotData?.answer;
    if (!correctLabel) {
      setState({ picked: label, feedback: "register" });
      return;
    }
    const isCorrect = label === correctLabel;
    setState({ picked: label, feedback: isCorrect ? "correct" : "wrong" });
    setProgress(await recordAttempt(current.id, slot, label, isCorrect));
  }, [current, progress]);

  const onRegister = useCallback(async (slot: Slot, correctLabel: ChoiceLabel) => {
    if (!current || !progress) return;
    const next1 = await registerCorrectAnswer(current.id, slot, correctLabel);
    const setState = slot === "top" ? setTopState : setBottomState;
    const interaction = slot === "top" ? topState : bottomState;
    if (interaction.picked) {
      const isCorrect = interaction.picked === correctLabel;
      const next2 = await recordAttempt(current.id, slot, interaction.picked, isCorrect);
      setState({ picked: interaction.picked, feedback: isCorrect ? "correct" : "wrong" });
      setProgress(next2);
    } else {
      setProgress(next1);
      setState({ picked: null, feedback: null });
    }
  }, [current, progress, topState, bottomState]);

  const onBookmark = useCallback(async () => {
    if (!current) return;
    setProgress(await toggleBookmark(current.id));
  }, [current]);

  const onMark = useCallback(async (status: "known" | "review") => {
    if (!current) return;
    setProgress(await setCardStatus(current.id, status));
    goNext();
  }, [current, goNext]);

  // Keyboard: 1/2/3/4 picks for TOP slot (most common). Hold shift for bottom.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!current) return;
      const slot: Slot = e.shiftKey || showBottom && topState.feedback ? "bottom" : "top";
      if (e.key === "1") onPick(slot, "①");
      else if (e.key === "2") onPick(slot, "②");
      else if (e.key === "3") onPick(slot, "③");
      else if (e.key === "4") onPick(slot, "④");
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key.toLowerCase() === "k") onMark("known");
      else if (e.key.toLowerCase() === "r") onMark("review");
      else if (e.key.toLowerCase() === "b") onBookmark();
      else if (e.key.toLowerCase() === "a") setShowBottom((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, onPick, goNext, goPrev, onMark, onBookmark, showBottom, topState.feedback]);

  function setParam(key: string, val: string | undefined) {
    const sp = new URLSearchParams(params.toString());
    if (val === undefined) sp.delete(key);
    else sp.set(key, val);
    const q = sp.toString();
    return q ? `/study?${q}` : "/study";
  }

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

  const slotData = progress.slots[current.id] ?? {};
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
        {!revealed && (
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 backdrop-blur-md bg-stone-50/70 dark:bg-stone-900/70 flex items-center justify-center border-t border-stone-300 dark:border-stone-700"
            style={{ height: "42%" }}
          >
            <span className="text-sm text-stone-600 dark:text-stone-300">
              아래 버튼을 누르면 정답·해설 영역이 공개됩니다
            </span>
          </div>
        )}
      </div>

      {/* TOP slot */}
      <SlotPanel
        slotName="top"
        title={showBottom ? "위 문제" : "정답 선택"}
        choices={CHOICES}
        registered={slotData.top?.answer}
        attempt={slotData.top}
        state={topState}
        disabled={false}
        onPick={(label) => onPick("top", label)}
        onRegister={(label) => onRegister("top", label)}
      />

      {/* Toggle bottom slot */}
      {!showBottom && (
        <button
          onClick={() => setShowBottom(true)}
          className="w-full text-xs py-2 rounded bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-dashed border-stone-300 dark:border-stone-700"
        >
          ▼ 이 카드에 두 번째 문제도 있어요 (A)
        </button>
      )}

      {/* BOTTOM slot */}
      {showBottom && (
        <SlotPanel
          slotName="bottom"
          title="아래 문제"
          choices={CHOICES}
          registered={slotData.bottom?.answer}
          attempt={slotData.bottom}
          state={bottomState}
          disabled={false}
          onPick={(label) => onPick("bottom", label)}
          onRegister={(label) => onRegister("bottom", label)}
          onHide={() => setShowBottom(false)}
        />
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
        키보드: 1·2·3·4=답 (Shift+숫자=아래 문제) · A=두 번째 문제 표시 · ←→=이동 · K=익힘 · R=다시 · B=북마크
      </div>

      {/* Note */}
      <details className="text-sm">
        <summary className="cursor-pointer text-stone-600 dark:text-stone-400">
          메모
        </summary>
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          onBlur={async () => setProgress(await setNote(current.id, noteText))}
          rows={3}
          placeholder="이 카드에 대한 본인 정리"
          className="mt-2 w-full rounded border border-stone-300 dark:border-stone-700 bg-transparent px-3 py-2 text-sm"
        />
      </details>
    </div>
  );
}

function SlotPanel({
  slotName, title, choices, registered, attempt, state, onPick, onRegister, onHide,
}: {
  slotName: Slot;
  title: string;
  choices: ChoiceLabel[];
  registered?: ChoiceLabel;
  attempt?: { correct: number; wrong: number };
  state: SlotInteraction;
  disabled: boolean;
  onPick: (label: ChoiceLabel) => void;
  onRegister: (label: ChoiceLabel) => void;
  onHide?: () => void;
}) {
  void slotName;
  const { picked, feedback } = state;
  return (
    <div className="space-y-2">
      <div className="flex items-center text-xs text-stone-500">
        <span>{title}</span>
        {registered && <span className="ml-2 text-stone-400">정답 등록: {registered}</span>}
        {attempt && (attempt.correct + attempt.wrong > 0) && (
          <span className="ml-2 text-stone-400">{attempt.correct}/{attempt.correct + attempt.wrong}</span>
        )}
        {onHide && (
          <button onClick={onHide} className="ml-auto text-stone-400 hover:text-stone-600">
            ✕ 숨김
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {choices.map((label) => {
          const isPicked = picked === label;
          const isRegistered = registered === label && feedback !== null;
          const showAsCorrect = (feedback === "correct" && isPicked) || (feedback === "wrong" && isRegistered);
          const showAsWrong = feedback === "wrong" && isPicked;
          return (
            <button
              key={label}
              onClick={() => !picked && onPick(label)}
              disabled={picked !== null}
              className={`h-12 rounded-lg text-xl font-bold border transition
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
      {feedback === "register" && (
        <div className="rounded-lg border-2 border-yellow-500 bg-yellow-50 dark:bg-yellow-950/40 p-2 space-y-1">
          <div className="text-xs text-yellow-900 dark:text-yellow-100">
            정답을 한 번만 등록 (해설에 적힌 답을 선택)
          </div>
          <div className="grid grid-cols-4 gap-1">
            {choices.map((label) => (
              <button
                key={label}
                onClick={() => onRegister(label)}
                className="h-9 rounded bg-yellow-500 text-white text-base font-bold"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {feedback === "correct" && (
        <div className="text-xs rounded bg-green-500/15 border border-green-500 p-2">✅ 정답</div>
      )}
      {feedback === "wrong" && (
        <div className="text-xs rounded bg-red-500/15 border border-red-500 p-2">
          ❌ 정답: <span className="font-bold">{registered}</span> · 🔁 다시 볼 것 자동 표시
        </div>
      )}
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
