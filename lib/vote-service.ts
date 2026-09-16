import { getRawDb } from "@/db";
import type { DishDetail } from "@/lib/dish-types";
import { getDishDetail, getUserVote } from "@/lib/ranking-service";
import type { Tier } from "@/lib/ranking";

const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;

export class VoteError extends Error {
  constructor(message: string, public status: number, public currentVote?: { dish: DishDetail; myVote: Tier }) { super(message); }
}

export async function submitVote(dishId: string, userId: string, targetTier: unknown): Promise<{ dish: DishDetail; myVote: Tier }> {
  if (!Number.isInteger(targetTier) || Number(targetTier) < 1 || Number(targetTier) > 5) {
    throw new VoteError("请选择有效等级", 400);
  }
  const tier = Number(targetTier) as Tier;
  const db = getRawDb();
  const visible = await db.prepare(`SELECT 1 FROM dishes d WHERE d.id = ? AND d.merged_into_dish_id IS NULL AND EXISTS (
    SELECT 1 FROM servings s
    JOIN meal_items mi ON mi.serving_id = s.id
    JOIN meals m ON m.id = mi.meal_id
    WHERE s.dish_id = d.id AND s.status = 'active' AND m.status = 'active'
  )`).bind(dishId).first();
  if (!visible) throw new VoteError("菜品不存在或不可见", 404);

  const now = Math.floor(Date.now() / 1000);
  const cutoff = now - RATE_WINDOW_SECONDS;
  const admitted = await db.prepare(`INSERT INTO vote_rate_limits (user_id,window_started_at,attempts) VALUES (?,?,1)
    ON CONFLICT(user_id) DO UPDATE SET
      window_started_at = CASE WHEN vote_rate_limits.window_started_at <= ? THEN excluded.window_started_at ELSE vote_rate_limits.window_started_at END,
      attempts = CASE WHEN vote_rate_limits.window_started_at <= ? THEN 1 ELSE vote_rate_limits.attempts + 1 END
    WHERE vote_rate_limits.window_started_at <= ? OR vote_rate_limits.attempts < ${RATE_LIMIT}
    RETURNING attempts`).bind(userId, now, cutoff, cutoff, cutoff).first();
  if (!admitted) throw new VoteError("提交太频繁，请稍后再试", 429);

  let created;
  try {
    created = await db.prepare(`INSERT INTO votes (id,dish_id,user_id,target_tier) VALUES (?,?,?,?)
      ON CONFLICT(dish_id,user_id) DO NOTHING RETURNING id`)
      .bind(crypto.randomUUID(), dishId, userId, tier).first();
  } catch (error) {
    if (error instanceof Error && error.message.includes("dish_no_longer_active")) throw new VoteError("菜品刚刚被合并，请刷新后再投票", 409);
    throw error;
  }
  if (!created) {
    const [dish, myVote] = await Promise.all([getDishDetail(dishId), getUserVote(dishId, userId)]);
    throw new VoteError("这道菜你已经判过了，已同步已有判决", 409, dish && myVote !== null ? { dish, myVote } : undefined);
  }
  const dish = await getDishDetail(dishId);
  if (!dish) throw new VoteError("菜品不存在或不可见", 404);
  return { dish, myVote: tier };
}
