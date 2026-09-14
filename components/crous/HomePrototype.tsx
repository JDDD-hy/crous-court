"use client";

import { useEffect, useState } from "react";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { firstUnreviewedIndex, nextDefendantIndex } from "@/lib/defendant-rotation";
import { HomeCourt, HomeExtras } from "./HomeSections";
import { SiteHeader } from "./SiteHeader";

export function HomePrototype({ meals, courtDates, authenticated, myVotes }: { meals: DishSummary[]; courtDates: string[]; authenticated: boolean; myVotes: Record<string, Tier> }) {
  const [currentMeals, setCurrentMeals] = useState(meals);
  const [currentVotes, setCurrentVotes] = useState(myVotes);
  const courtMeals = currentMeals.filter((dish) => courtDates.includes(dish.date));
  const [featuredIndex, setFeaturedIndex] = useState(() => firstUnreviewedIndex(courtMeals.map((dish) => dish.id), myVotes));
  const [rotationPaused, setRotationPaused] = useState(false);
  const featured = courtMeals[featuredIndex];
  useEffect(() => {
    if (courtMeals.length < 2 || rotationPaused) return;
    const timer = window.setInterval(() => setFeaturedIndex((index) => nextDefendantIndex(index, courtMeals.length)), 8_000);
    return () => window.clearInterval(timer);
  }, [courtMeals.length, rotationPaused]);

  if (!featured) {
    return <div className="min-h-screen bg-background text-foreground"><SiteHeader authenticated={authenticated} /><main><section className="mx-auto max-w-4xl px-6 py-24 text-center"><p className="text-6xl" aria-hidden="true">🍽️</p><h1 className="mt-5 text-4xl font-black">今天和昨天暂无案件</h1><p className="mt-3 text-ink/65">更早的菜品可以去<a href="/rankings" className="underline">长期榜单</a>查看。</p></section><HomeExtras meals={currentMeals} /></main></div>;
  }

  const rankedMeals = [...currentMeals].sort((a, b) => (a.tier ?? 6) - (b.tier ?? 6) || b.votes - a.votes || a.id.localeCompare(b.id));
  const updateDish = (dish: DishSummary) => setCurrentMeals((items) => items.map((item) => item.id === dish.id ? dish : item));
  return <div className="min-h-screen overflow-x-hidden bg-background text-foreground"><SiteHeader authenticated={authenticated} /><main>
    <HomeCourt dish={featured} authenticated={authenticated} myVote={currentVotes[featured.id] ?? null} onChange={updateDish} onVotingChange={setRotationPaused}
      reviewed={currentVotes[featured.id] !== undefined} onVoteConfirmed={(dishId, tier) => setCurrentVotes((votes) => ({ ...votes, [dishId]: tier }))}
      position={featuredIndex + 1} total={courtMeals.length}
      onPrevious={() => setFeaturedIndex((index) => nextDefendantIndex(index, courtMeals.length, -1))}
      onNext={() => setFeaturedIndex((index) => nextDefendantIndex(index, courtMeals.length))} />
    <HomeExtras meals={rankedMeals} />
  </main></div>;
}
