import Link from "next/link";
import { getAllPages, getDataset, SUBJECTS } from "@/lib/data";

export default function HomePage() {
  const ds = getDataset();
  const pages = getAllPages().filter((p) => !p.is_cover);
  const rounds = [1, 2, 3] as const;

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">소방설비기사(전기) 2025 기출 회독</h1>
        <p className="text-stone-600 dark:text-stone-400 mt-1 text-sm">
          전체 {pages.length}페이지 · 3개 회차 · 4과목 · 암기팁 키워드 {ds.mnemonic_keywords.length}개
        </p>
        <p className="text-xs text-stone-500 mt-2">
          원본 책 페이지를 그대로 표시합니다. 클릭해서 넘기며 회독하세요.
        </p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">회차별</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {rounds.map((r) => {
            const info = ds.rounds[String(r)];
            const count = pages.filter((p) => p.round === r).length;
            return (
              <Link
                key={r}
                href={`/pages?round=${r}`}
                className="rounded-lg border border-stone-300 dark:border-stone-700 p-3"
              >
                <div className="text-xs text-stone-500">제{r}회 · {info.date} 시행</div>
                <div className="font-medium mt-1">책 페이지 25-{info.first_page} ~ 25-{info.last_page}</div>
                <div className="text-xs text-stone-500 mt-1">{count}페이지</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">과목별 (전 회차 통합)</h2>
        <div className="grid grid-cols-2 gap-2">
          {SUBJECTS.map((s) => {
            const count = pages.filter((p) => p.subjects.includes(s.id)).length;
            return (
              <Link
                key={s.id}
                href={`/pages?subject=${s.id}`}
                className="rounded-lg border border-stone-300 dark:border-stone-700 p-3 text-sm"
              >
                <div className="text-xs text-stone-500">{s.id}과목</div>
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-stone-500 mt-1">{count}페이지</div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg bg-stone-100 dark:bg-stone-900 p-4 text-sm">
        <h2 className="font-semibold mb-1">학습 팁</h2>
        <ul className="list-disc list-inside space-y-1 text-stone-700 dark:text-stone-300">
          <li>페이지 뷰어에서 좌/우 화살표 또는 화면 클릭으로 넘김</li>
          <li>북마크 🔖 표시 → /notes 에서 한 번에 복습</li>
          <li>과목 필터는 근사치 (페이지 경계 문제 포함 가능)</li>
        </ul>
      </section>
    </div>
  );
}
