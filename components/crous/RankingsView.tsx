"use client";
import { useT } from "@/lib/i18n/client";
import { Flame } from "lucide-react";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { Ranking } from "./HomeSections";

export function RankingsView({ dishes, category, venueQuery, offset, authenticated, reviewedDishIds }: { dishes: DishSummary[]; category: "main" | "side"; venueQuery: string; offset: number; authenticated: boolean; reviewedDishIds: Readonly<Record<string,Tier>> }) {
  const t = useT();
  function href(next:string) { const params = new URLSearchParams(venueQuery); params.set("category",next); return `/rankings?${params}`; }
  return <div className="mt-6"><nav className="mb-7 flex flex-wrap gap-3">{(["main","side"] as const).map(value=><a key={value} aria-current={category===value ? "page" : undefined} className={`inline-flex min-h-12 items-center border-3 border-ink px-4 py-2 text-base font-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-verdict ${category===value ? "bg-ink text-paper shadow-[4px_4px_0_#a94d49]" : "bg-paper hover:bg-accent/20"}`} href={href(value)}>{t(value==="main" ? "🍛 主食" : "🥄 小菜")}</a>)}</nav><Ranking title={t(category==="main" ? "主食夯拉榜" : "小菜捡漏榜")} icon={category==="main" ? <Flame className="size-6 text-verdict" /> : <span aria-hidden="true">🥄</span>} items={dishes} venueQuery={venueQuery} offset={offset} authenticated={authenticated} reviewedDishIds={reviewedDishIds} /></div>;
}
