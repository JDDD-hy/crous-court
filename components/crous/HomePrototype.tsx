"use client";

import { useEffect, useState } from "react";
import type { DishSummary } from "@/lib/dish-types";
import type { Tier } from "@/lib/ranking";
import { firstUnreviewedIndex, nextDefendantIndex } from "@/lib/defendant-rotation";
import { HomeCourt, HomeExtras } from "./HomeSections";
import { SiteHeader } from "./SiteHeader";

export function HomePrototype({ meals, authenticated, myVotes }: { meals: DishSummary[]; authenticated: boolean; myVotes: Record<string, Tier> }) {
  const [currentMeals, setCurrentMeals] = useState(meals);
  const [currentVotes, setCurrentVotes] = useState(myVotes);
  const [featuredIndex, setFeaturedIndex] = useState(() => firstUnreviewedIndex(meals.map((dish) => dish.id), myVotes));
  const [rotationPaused, setRotationPaused] = useState(false);
  const featured = currentMeals[featuredIndex];
  useEffect(() => {
    if (currentMeals.length < 2 || rotationPaused) return;
    const timer = window.setInterval(() => setFeaturedIndex((index) => nextDefendantIndex(index, currentMeals.length)), 8_000);
    return () => window.clearInterval(timer);
  }, [currentMeals.length, rotationPaused]);

  if (!featured) {
    return <div className="min-h-screen bg-background text-foreground"><SiteHeader authenticated={authenticated} /><main className="mx-auto max-w-4xl px-6 py-24 text-center"><p className="text-6xl" aria-hidden="true">🍽️</p><h1 className="mt-5 text-4xl font-black">今天还没有案件</h1><p className="mt-3 text-ink/65">等待第一份餐盘投稿。</p></main></div>;
  }

  const rankedMeals = [...currentMeals].sort((a, b) => (a.tier ?? 6) - (b.tier ?? 6) || b.votes - a.votes || a.id.localeCompare(b.id));
  const updateDish = (dish: DishSummary) => setCurrentMeals((items) => items.map((item) => item.id === dish.id ? dish : item));
  return <div className="min-h-screen overflow-x-hidden bg-background text-foreground"><SiteHeader authenticated={authenticated} /><main>
    <HomeCourt dish={featured} authenticated={authenticated} myVote={currentVotes[featured.id] ?? null} onChange={updateDish} onVotingChange={setRotationPaused}
      reviewed={currentVotes[featured.id] !== undefined} onVoteConfirmed={(dishId, tier) => setCurrentVotes((votes) => ({ ...votes, [dishId]: tier }))}
      position={featuredIndex + 1} total={currentMeals.length}
      onPrevious={() => setFeaturedIndex((index) => nextDefendantIndex(index, currentMeals.length, -1))}
      onNext={() => setFeaturedIndex((index) => nextDefendantIndex(index, currentMeals.length))} />
    <HomeExtras meals={rankedMeals} />
  </main></div>;
}
