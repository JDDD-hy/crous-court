import { and, desc, eq } from "drizzle-orm";
import { getDb, getRawDb } from "../db";
import { mealItems, meals, photos, servings, venues, votes } from "../db/schema";
import type { DishCategory, DishDetail } from "./dish-types";
import { type Tier, type TierHistoryEntry } from "./ranking";
import { getLocale } from "./i18n/server";
import { rankingPage } from "./ranking-summary";
import { dishHistoryPageQueries, evidencePageSize, historyPageSize } from './dish-history-query';
export { rankingPage } from "./ranking-summary";

export async function listRankings(category?: DishCategory, venueIds?: string[]) {
  return (await rankingPage({ category, venueIds })).dishes;
}

export async function getDishSummary(id: string) { return (await rankingPage({ dishId: id, limit: 1 })).dishes[0] ?? null; }

export async function getDishDetail(id: string, evidencePage = 1, historyPage = 1): Promise<DishDetail | null> {
  if (!Number.isSafeInteger(evidencePage) || evidencePage < 1 || evidencePage > 10000) throw new RangeError("Invalid evidence page");
  const locale = await getLocale();
  const summary = await getDishSummary(id);
  if (!summary) return null;

  const db = getDb();
  const rawDb = getRawDb();
  const historyQueries = dishHistoryPageQueries(id, historyPage);
  const readServings = (page: number) => db.select({
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
      .orderBy(desc(servings.servedOn), desc(servings.createdAt), servings.id, photos.id).limit(evidencePageSize).offset((page - 1) * evidencePageSize);
  const [requestedServings, historyBatch, countRow] = await Promise.all([readServings(evidencePage),
    rawDb.batch<{ page: number; rows_json: string }>(historyQueries.map(query => rawDb.prepare(query.sql).bind(...query.bindings))),
    getRawDb().prepare(`SELECT COUNT(*) records, COUNT(DISTINCT s.id) sightings FROM servings s JOIN meal_items mi ON mi.serving_id=s.id JOIN meals m ON m.id=mi.meal_id LEFT JOIN photos p ON p.meal_id=m.id WHERE s.dish_id=? AND s.status='active' AND m.status='active'`).bind(id).first<{ records: number; sightings: number }>(),
  ]);
  const historyResult = historyBatch.at(-1)?.results[0];
  const historyRows = JSON.parse(historyResult?.rows_json ?? '[]') as (TierHistoryEntry & { total: number })[];
  historyPage = historyResult?.page ?? 1;
  let servingRows = requestedServings;
  if (!servingRows.length && evidencePage > 1) {
    evidencePage = 1;
    servingRows = await readServings(evidencePage);
  }
  const uniqueServings = [...new Map(servingRows.map((serving) => [`${serving.id}:${serving.photoId ?? ""}`, serving])).values()];
  return {
    ...summary,
    servings: uniqueServings.map((serving) => ({
      id: serving.id,
      mealId: serving.mealId,
      date: serving.date,
      venue: locale === "en" || serving.venueNickname === serving.venueName ? serving.venueName : `${serving.venueNickname} · ${serving.venueName}`,
      initialTier: serving.initialTier as Tier,
      originalDescription: serving.originalDescription,
      image: serving.photoId ? `/api/photos/${serving.photoId}` : null,
    })),
    tierHistory: historyRows.map(({tier,at,voteCount})=>({tier,at,voteCount})),
    evidencePagination: { page: evidencePage, size: evidencePageSize, total: countRow?.records ?? 0 },
    historyPagination: { page: historyPage, size: historyPageSize, total: historyRows[0]?.total ?? 0 },
    servingCount: countRow?.sightings ?? 0,
  };
}

export async function getUserVote(dishId: string, userId: string): Promise<Tier | null> {
  const row = await getDb().select({ targetTier: votes.targetTier }).from(votes)
    .where(and(eq(votes.dishId, dishId), eq(votes.userId, userId))).limit(1);
  return (row[0]?.targetTier as Tier | undefined) ?? null;
}

export async function getUserVotes(dishIds: string[], userId: string): Promise<Record<string, Tier>> {
  if (!dishIds.length) return {};
  const rows = await getRawDb().prepare("SELECT dish_id, target_tier FROM votes WHERE user_id = ? AND dish_id IN (SELECT value FROM json_each(?))").bind(userId, JSON.stringify(dishIds)).all<{dish_id: string; target_tier: Tier}>();
  return Object.fromEntries(rows.results.map(row => [row.dish_id, row.target_tier]));
}
