/* eslint-disable @next/next/no-html-link-for-pages -- Vinext client navigation can retain a stale route; header actions require full navigation. */

import { Gavel } from "lucide-react";
import { UploadNav } from "./UploadNav";
import { EmailLogoutButton } from "./EmailLogoutButton";

export function SiteHeader({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink/15 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="/story" aria-label="查看 CROUS法庭的故事" className="flex items-center gap-2 font-black tracking-tight">
          <span className="grid size-10 rotate-[-4deg] place-items-center rounded-sm bg-verdict text-paper shadow-[3px_3px_0_#202624]"><Gavel aria-hidden="true" className="size-5" /></span>
          <span className="text-xl">CROUS法庭</span>
        </a>
        <nav aria-label="主导航" className="flex items-center gap-2 text-sm font-bold">
          <a href="/" className="hidden rounded-full px-3 py-2 hover:bg-ink/5 sm:block">今日开庭</a>
          <UploadNav authenticated={authenticated} />
          {authenticated && <EmailLogoutButton />}
        </nav>
      </div>
    </header>
  );
}
