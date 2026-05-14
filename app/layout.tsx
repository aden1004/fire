import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "소방설비기사(전기) 기출 회독",
  description: "2025년 기출문제 페이지 회독 도구",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#c2410c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-stone-200 dark:border-stone-800 sticky top-0 bg-stone-50/90 dark:bg-stone-950/90 backdrop-blur z-20">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4 overflow-x-auto text-sm">
            <Link href="/" className="font-bold text-brand-700 dark:text-brand-500 whitespace-nowrap">
              🔥 소방기사(전기)
            </Link>
            <nav className="flex gap-3">
              <Link href="/pages" className="text-stone-700 dark:text-stone-300 hover:text-brand-700 whitespace-nowrap">페이지</Link>
              <Link href="/mnemonics" className="text-stone-700 dark:text-stone-300 hover:text-brand-700 whitespace-nowrap">암기팁</Link>
              <Link href="/notes" className="text-stone-700 dark:text-stone-300 hover:text-brand-700 whitespace-nowrap">북마크</Link>
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-4">{children}</main>
        <footer className="border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500 py-4 text-center">
          개인 학습용 · 본인 보유 기출문제집 페이지 회독
        </footer>
      </body>
    </html>
  );
}
