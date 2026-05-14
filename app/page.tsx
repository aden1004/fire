import Link from "next/link";
import { getAllCards, getDataset, SUBJECTS } from "@/lib/data";

export default function HomePage() {
  const ds = getDataset();
  const cards = getAllCards();
  const rounds = [1, 2, 3] as const;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">소방설비기사(전기) 2025 기출 카드</h1>
        <p className="text-stone-600 dark:text-stone-400 mt-1 text-sm">
          전체 {cards.length}장 카드 · 3개 회차 · 4과목 · 암기팁 키워드 {ds.mnemonic_keywords.length}개
        </p>
        <p className="text-xs text-stone-500 mt-2">
          한 장씩 보고 → 정답·해설 보기 → 익힘/다시 표시 → 다음 카드.
        </p>
      </section>

      <section>
        <Link
          href="/study"
          className="block w-full rounded-lg bg-brand-700 text-white p-4 text-center font-medium"
        >
          ▶ 학습 시작 (이어보기)
        </Link>
      </section>

      <section>
        <h2 className="font-semibold mb-2">회차별</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {rounds.map((r) => {
            const info = ds.rounds[String(r)];
            const count = cards.filter((c) => c.round === r).length;
            return (
              <Link
                key={r}
                href={`/study?round=${r}`}
                className="rounded-lg border border-stone-300 dark:border-stone-700 p-3"
              >
                <div className="text-xs text-stone-500">제{r}회 · {info.date} 시행</div>
                <div className="font-medium mt-1">{count}장 카드</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">과목별 (전 회차)</h2>
        <div className="grid grid-cols-2 gap-2">
          {SUBJECTS.map((s) => {
            const count = cards.filter((c) => c.subjects.includes(s.id)).length;
            return (
              <Link
                key={s.id}
                href={`/study?subject=${s.id}`}
                className="rounded-lg border border-stone-300 dark:border-stone-700 p-3 text-sm"
              >
                <div className="text-xs text-stone-500">{s.id}과목</div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-stone-500 mt-1">{count}장</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link
          href="/mnemonics"
          className="rounded-lg border border-stone-300 dark:border-stone-700 p-3 text-sm"
        >
          <div className="text-xs text-stone-500">암기팁</div>
          <div className="font-medium">키워드 {ds.mnemonic_keywords.length}개</div>
        </Link>
        <Link
          href="/notes"
          className="rounded-lg border border-stone-300 dark:border-stone-700 p-3 text-sm"
        >
          <div className="text-xs text-stone-500">복습</div>
          <div className="font-medium">북마크·다시 볼 것</div>
        </Link>
      </section>

      <section className="rounded-lg bg-stone-100 dark:bg-stone-900 p-4 text-xs text-stone-700 dark:text-stone-300">
        <p className="font-semibold mb-1">사용 팁</p>
        <ul className="list-disc list-inside space-y-1">
          <li>카드 = 책 페이지의 한쪽 컬럼 (보통 문제 1~2개 포함)</li>
          <li>화면 하단 흐릿한 영역을 탭하면 정답·해설이 보임</li>
          <li>Space/Enter = 정답 보기 → 다음, ←→ = 이동, K = 익힘, R = 다시, B = 북마크</li>
          <li>마지막으로 본 카드 위치는 자동 저장됨</li>
        </ul>
      </section>
    </div>
  );
}
