import Link from "next/link";
import { getAllQuestions, listRounds, SUBJECTS } from "@/lib/data";

export default function HomePage() {
  const qs = getAllQuestions();
  const rounds = listRounds();
  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-bold">소방설비기사(전기) 기출 회독</h1>
        <p className="text-stone-600 dark:text-stone-400 mt-1 text-sm">
          전체 {qs.length}문항 · {rounds.length}개 회차 · 4개 과목
        </p>
      </section>

      <section>
        <h2 className="font-semibold mb-2">빠른 시작</h2>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/questions?importance=3"
            className="rounded-lg bg-brand-700 text-white p-4 text-center text-sm font-medium"
          >
            ★★★ 별3 집중
          </Link>
          <Link
            href="/mock"
            className="rounded-lg bg-stone-200 dark:bg-stone-800 p-4 text-center text-sm font-medium"
          >
            모의고사 (80문 · 2시간)
          </Link>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">과목별</h2>
        <div className="grid grid-cols-2 gap-2">
          {SUBJECTS.map((s) => (
            <Link
              key={s.id}
              href={`/questions?subject=${s.id}`}
              className="rounded-lg border border-stone-300 dark:border-stone-700 p-3 text-sm"
            >
              <div className="text-xs text-stone-500">{s.id}과목</div>
              <div className="font-medium">{s.name}</div>
              <div className="text-xs text-stone-500 mt-1">
                {qs.filter((q) => q.subject === s.id).length}문항
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-2">회차별</h2>
        <div className="flex gap-2 flex-wrap">
          {rounds.map((r) => (
            <Link
              key={r}
              href={`/questions?round=${r}`}
              className="rounded-full px-3 py-1.5 bg-stone-200 dark:bg-stone-800 text-sm"
            >
              제{r}회
            </Link>
          ))}
        </div>
      </section>

      <section className="text-xs text-stone-500 border-t border-stone-200 dark:border-stone-800 pt-4">
        실제 데이터를 채우려면 <code>scripts/README.md</code> 절차에 따라
        OCR 힌트 추출 → 페이지 렌더 → Vision 추출 → 빌드를 수행하세요.
        현재 샘플 데이터가 표시 중이라면 <code>data/normalized/2025.json</code>이
        아직 생성되지 않은 상태입니다.
      </section>
    </div>
  );
}
