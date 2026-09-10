import Link from "next/link";
import { Camera, Gavel } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink/15 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-black tracking-tight">
          <span className="grid size-10 rotate-[-4deg] place-items-center rounded-sm bg-verdict text-paper shadow-[3px_3px_0_#202624]"><Gavel aria-hidden="true" className="size-5" /></span>
          <span className="text-xl">CROUS法庭</span>
        </Link>
        <nav aria-label="主导航" className="flex items-center gap-2 text-sm font-bold">
          <Link href="/" className="hidden rounded-full px-3 py-2 hover:bg-ink/5 sm:block">今日开庭</Link>
          <Link href="/upload" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-paper shadow-[3px_3px_0_#c99a4b] transition-transform hover:-translate-y-0.5"><Camera aria-hidden="true" className="size-4" /> 投稿</Link>
        </nav>
      </div>
    </header>
  );
}
