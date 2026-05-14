import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "소방설비기사(전기) 기출 문제은행",
  description: "2025년 기출문제 단기 회독용 학습 도구",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#c2410c",
  width: "device-width",
  initialScale: 1,
};

const nav = [
  { href: "/", label: "홈" },
  { href: "/questions", label: "문제" },
  { href: "/mnemonics", label: "암기팁" },
  { href: "/mock", label: "모의고사" },
  { href: "/notes", label: "오답·북마크" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 dark:border-stone-800 sticky top-0 bg-stone-50/90 dark:bg-stone-950/90 backdrop-blur z-10">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4 overflow-x-auto">
            <Link href="/" className="font-bold text-brand-700 dark:text-brand-500 whitespace-nowrap">
              🔥 소방기사(전기)
            </Link>
            <nav className="flex gap-3 text-sm">
              {nav.slice(1).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-stone-700 dark:text-stone-300 hover:text-brand-700 whitespace-nowrap"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-4">{children}</main>
        <footer className="border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500 py-4 text-center">
          개인 학습용 · 데이터 출처: 본인 보유 기출문제집
        </footer>
      </body>
    </html>
  );
}
