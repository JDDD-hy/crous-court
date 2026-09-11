"use client";

import { useState } from "react";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { HomeCourt, HomeRankings } from "./HomeSections";
import { SiteHeader } from "./SiteHeader";

export function HomePrototype({ meals, authenticated, myVote }: { meals: DishSummary[]; authenticated: boolean; myVote: Tier | null }) {
  const [featured, setFeatured] = useState(meals[0]);
  if (!featured) {
    return <div className="min-h-screen bg-background text-foreground"><SiteHeader /><main className="mx-auto max-w-4xl px-6 py-24 text-center"><p className="text-6xl" aria-hidden="true">🍽️</p><h1 className="mt-5 text-4xl font-black">今天还没有案件</h1><p className="mt-3 text-ink/65">等待第一份餐盘投稿。</p></main></div>;
  }

  const rankedMeals = meals.map((dish) => dish.id === featured.id ? featured : dish)
    .sort((a, b) => (a.tier ?? 6) - (b.tier ?? 6) || b.votes - a.votes || a.id.localeCompare(b.id));
  return <div className="min-h-screen overflow-x-hidden bg-background text-foreground"><SiteHeader /><main>
    <HomeCourt dish={featured} authenticated={authenticated} myVote={myVote} onChange={setFeatured} />
    <HomeRankings meals={rankedMeals} />
  </main></div>;
}
