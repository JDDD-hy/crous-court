import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { dishes, servings, venues, votes } from "../db/schema";
import type { DishCategory, DishDetail, DishSummary } from "./dish-types";
import { calculateVerdict, compareVerdicts, type Tier } from "./ranking";

const imageByDish: Record<string, string> = {
  "couscous-boulettes": "/meals/couscous.jpg",
  "lentilles-saucisse": "/meals/lentilles-saucisse.jpg",
  "mystery-dessert": "/meals/poulet-haricots.jpg",
};

export async function listRankings(category?: DishCategory): Promise<DishSummary[]> {
  const db = getDb();
  const dishRows = await db.select().from(dishes).where(category ? eq(dishes.category, category) : undefined);
  if (!dishRows.length) return [];

  const ids = dishRows.map((dish) => dish.id);
  const [voteRows, servingRows] = await Promise.all([
    db.select({ dishId: votes.dishId, targetTier: votes.targetTier }).from(votes).where(inArray(votes.dishId, ids)),
    db.select({
      id: servings.id,
      dishId: servings.dishId,
      date: servings.servedOn,
      initialTier: servings.initialTier,
      venueName: venues.canonicalName,
      venueNickname: venues.nickname,
    }).from(servings).innerJoin(venues, eq(servings.venueId, venues.id))
      .where(and(inArray(servings.dishId, ids), eq(servings.status, "active")))
      .orderBy(desc(servings.servedOn)),
  ]);

  const targetsByDish = new Map<string, number[]>();
  for (const vote of voteRows) {
    const targets = targetsByDish.get(vote.dishId) ?? [];
    targets.push(vote.targetTier);
    targetsByDish.set(vote.dishId, targets);
  }
  const servingByDish = new Map<string, (typeof servingRows)[number]>();
  for (const serving of servingRows) {
    if (!servingByDish.has(serving.dishId)) servingByDish.set(serving.dishId, serving);
  }

  return dishRows.map((dish) => {
    const verdict = calculateVerdict(targetsByDish.get(dish.id) ?? []);
    const serving = servingByDish.get(dish.id);
    return {
      verdict,
      dish: {
        id: dish.id,
        name: dish.canonicalNameFr ?? `神秘菜品 #${dish.id.slice(-4)}`,
        zh: dish.canonicalNameZh ?? (dish.originalDescription || "等待群众认菜"),
        venue: serving ? `${serving.venueNickname} · ${serving.venueName}` : "暂无出餐记录",
        date: serving?.date ?? "",
        image: imageByDish[dish.id] ?? "/file.svg",
        tier: verdict.tier,
        initialTier: (serving?.initialTier as Tier | undefined) ?? null,
        votes: verdict.voteCount,
        category: dish.category,
        status: verdict.status,
      } satisfies DishSummary,
    };
  }).sort((a, b) => compareVerdicts(a.verdict, b.verdict) || a.dish.id.localeCompare(b.dish.id))
    .map((entry) => entry.dish);
}

export async function getDishDetail(id: string): Promise<DishDetail | null> {
  const rankings = await listRankings();
  const summary = rankings.find((dish) => dish.id === id);
  if (!summary) return null;

  const db = getDb();
  const [voteRows, servingRows] = await Promise.all([
    db.select({ targetTier: votes.targetTier }).from(votes).where(eq(votes.dishId, id)),
    db.select({
      id: servings.id,
      date: servings.servedOn,
      initialTier: servings.initialTier,
      venueName: venues.canonicalName,
      venueNickname: venues.nickname,
    }).from(servings).innerJoin(venues, eq(servings.venueId, venues.id))
      .where(and(eq(servings.dishId, id), eq(servings.status, "active")))
      .orderBy(desc(servings.servedOn)),
  ]);
  const verdict = calculateVerdict(voteRows.map((vote) => vote.targetTier));
  return {
    ...summary,
    distribution: verdict.distribution,
    servings: servingRows.map((serving) => ({
      id: serving.id,
      date: serving.date,
      venue: `${serving.venueNickname} · ${serving.venueName}`,
      initialTier: serving.initialTier as Tier,
    })),
  };
}
