import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "../db";
import { dishAliases, dishes, mealItems, meals, photos, servings, venues, votes } from "../db/schema";
import type { DishCategory, DishDetail, DishSummary } from "./dish-types";
import { calculateVerdict, compareVerdicts, type Tier } from "./ranking";

const imageByDish: Record<string, string> = {
  "couscous-boulettes": "/meals/couscous.jpg",
  "lentilles-saucisse": "/meals/lentilles-saucisse.jpg",
  "mystery-dessert": "/meals/poulet-haricots.jpg",
};

export async function listRankings(category?: DishCategory): Promise<DishSummary[]> {
  const db = getDb();
  const dishRows = await db.select().from(dishes).where(category ? and(eq(dishes.category, category), isNull(dishes.mergedIntoDishId)) : isNull(dishes.mergedIntoDishId));
  if (!dishRows.length) return [];

  const ids = dishRows.map((dish) => dish.id);
  const [voteRows, servingRows, aliasRows] = await Promise.all([
    db.select({ dishId: votes.dishId, targetTier: votes.targetTier }).from(votes).where(inArray(votes.dishId, ids)),
    db.select({
      id: servings.id,
      mealId: meals.id,
      dishId: servings.dishId,
      date: servings.servedOn,
      initialTier: servings.initialTier,
      originalDescription: servings.originalDescription,
      venueName: venues.canonicalName,
      venueNickname: venues.nickname,
      photoId: photos.id,
    }).from(servings)
      .innerJoin(venues, eq(servings.venueId, venues.id))
      .innerJoin(mealItems, eq(mealItems.servingId, servings.id))
      .innerJoin(meals, and(eq(meals.id, mealItems.mealId), eq(meals.status, "active")))
      .leftJoin(photos, eq(photos.mealId, meals.id))
      .where(and(inArray(servings.dishId, ids), eq(servings.status, "active")))
      .orderBy(desc(servings.servedOn)),
    db.select({ dishId: dishAliases.dishId, name: dishAliases.name }).from(dishAliases).where(inArray(dishAliases.dishId, ids)),
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
  const aliasByDish = new Map<string, string>();
  for (const alias of aliasRows) if (!aliasByDish.has(alias.dishId)) aliasByDish.set(alias.dishId, alias.name);

  return dishRows.flatMap((dish) => {
    const verdict = calculateVerdict(targetsByDish.get(dish.id) ?? []);
    const serving = servingByDish.get(dish.id);
    if (!serving) return [];
    return [{
      verdict,
      dish: {
        id: dish.id,
        name: dish.canonicalNameFr ?? dish.canonicalNameZh ?? aliasByDish.get(dish.id) ?? `神秘菜品 #${dish.id.slice(-4)}`,
        zh: dish.canonicalNameZh ?? aliasByDish.get(dish.id) ?? (dish.originalDescription || "等待群众认菜"),
        venue: `${serving.venueNickname} · ${serving.venueName}`,
        date: serving.date,
        image: serving.photoId ? `/api/photos/${serving.photoId}` : imageByDish[dish.id] ?? "/file.svg",
        tier: verdict.tier,
        initialTier: (serving?.initialTier as Tier | undefined) ?? null,
        votes: verdict.voteCount,
        distribution: verdict.distribution,
        category: dish.category,
        namingStatus: dish.namingStatus,
        status: verdict.status,
      } satisfies DishSummary,
    }];
  }).sort((a, b) => compareVerdicts(a.verdict, b.verdict) || a.dish.id.localeCompare(b.dish.id))
    .map((entry) => entry.dish);
}

export async function getDishDetail(id: string): Promise<DishDetail | null> {
  const rankings = await listRankings();
  const summary = rankings.find((dish) => dish.id === id);
  if (!summary) return null;

  const db = getDb();
  const servingRows = await db.select({
      id: servings.id,
      mealId: meals.id,
      date: servings.servedOn,
      initialTier: servings.initialTier,
      originalDescription: servings.originalDescription,
      venueName: venues.canonicalName,
      venueNickname: venues.nickname,
      photoId: photos.id,
    }).from(servings)
      .innerJoin(venues, eq(servings.venueId, venues.id))
      .innerJoin(mealItems, eq(mealItems.servingId, servings.id))
      .innerJoin(meals, and(eq(meals.id, mealItems.mealId), eq(meals.status, "active")))
      .leftJoin(photos, eq(photos.mealId, meals.id))
      .where(and(eq(servings.dishId, id), eq(servings.status, "active")))
      .orderBy(desc(servings.servedOn));
  const uniqueServings = [...new Map(servingRows.map((serving) => [`${serving.id}:${serving.photoId ?? ""}`, serving])).values()];
  return {
    ...summary,
    servings: uniqueServings.map((serving) => ({
      id: serving.id,
      mealId: serving.mealId,
      date: serving.date,
      venue: `${serving.venueNickname} · ${serving.venueName}`,
      initialTier: serving.initialTier as Tier,
      originalDescription: serving.originalDescription,
      image: serving.photoId ? `/api/photos/${serving.photoId}` : null,
    })),
  };
}

export async function getUserVote(dishId: string, userId: string): Promise<Tier | null> {
  const row = await getDb().select({ targetTier: votes.targetTier }).from(votes)
    .where(and(eq(votes.dishId, dishId), eq(votes.userId, userId))).limit(1);
  return (row[0]?.targetTier as Tier | undefined) ?? null;
}

export async function getUserVotes(dishIds: string[], userId: string): Promise<Record<string, Tier>> {
  if (!dishIds.length) return {};
  const rows = await getDb().select({ dishId: votes.dishId, targetTier: votes.targetTier }).from(votes)
    .where(and(inArray(votes.dishId, dishIds), eq(votes.userId, userId)));
  return Object.fromEntries(rows.map((row) => [row.dishId, row.targetTier as Tier]));
}
