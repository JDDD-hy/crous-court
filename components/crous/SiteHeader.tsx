"use client";
import { LanguageSwitch, useT } from "@/lib/i18n/client";
import { useVenueQuery } from "@/lib/use-venue-query";


// Full navigation keeps the current venue scope in sync with server-rendered data.

import { Gavel } from "lucide-react";
import { UploadNav } from "./UploadNav";
import { UsageGuide } from "./UsageGuide";
import { EmailLogoutButton } from "./EmailLogoutButton";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

export function SiteHeader({ authenticated = false, venueQuery = "", scopeControl }: { authenticated?: boolean; venueQuery?: string; scopeControl?: ReactNode }) {
  const t = useT();
  const query = useVenueQuery(venueQuery);
  const [venueReminder, setVenueReminder] = useState(false);
  useEffect(() => { const clear = () => setVenueReminder(false); window.addEventListener("crous-venue-selected", clear); return () => window.removeEventListener("crous-venue-selected", clear); }, []);
  return (
    <header className="sticky top-0 z-40 border-b-2 border-ink/15 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
        <a href={`/story${query}`} aria-label={t("查看 CROUS法庭的故事")} className="flex items-center gap-2 font-black tracking-tight">
          <span className="grid size-10 rotate-[-4deg] place-items-center rounded-sm bg-verdict text-paper shadow-[3px_3px_0_#202624]"><Gavel aria-hidden="true" className="size-5" /></span>
          <span className="text-lg sm:text-xl">{t("CROUS法庭")}</span>
        </a>
        <nav aria-label={t("主导航")} className="flex max-w-full flex-wrap items-center gap-2 text-sm font-bold" onClickCapture={event => {
          const link = (event.target as HTMLElement).closest("a");
          const required = document.querySelector<HTMLElement>('[data-venue-required="true"]');
          if (!link || !required || !["/", "/rankings"].includes(new URL(link.href).pathname)) return;
          event.preventDefault(); setVenueReminder(true); required.scrollIntoView({ block: "center" });
          required.querySelector<HTMLButtonElement>("button")?.focus();
        }}>
          {scopeControl}
          <a href={`/rankings${query}`} className="hidden rounded-full px-3 py-2 hover:bg-ink/5 sm:block">{t("长期榜单")}</a>
          <a href={`/${query}`} className="hidden rounded-full px-3 py-2 hover:bg-ink/5 sm:block">{t("今日开庭")}</a>
          <UploadNav authenticated={authenticated} venueQuery={query} />
          <UsageGuide />
          {authenticated && <EmailLogoutButton />}
          <LanguageSwitch />
        </nav>
      </div>
      {venueReminder && <p role="alert" className="mx-auto max-w-6xl px-4 pb-3 text-sm text-verdict">{t("请先选择案发地点，再查看今日开庭或长期榜单。")}</p>}
    </header>
  );
}
