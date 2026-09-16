import { getRawDb } from "@/db";
import { GovernanceError } from "./errors";

export async function enforceGovernanceLimit(userId: string, action: "suggest_name" | "endorse_name" | "report" | "merge_review", limit: number) {
  const now = Math.floor(Date.now() / 1000);
  const result = await getRawDb().prepare(`INSERT INTO governance_rate_limits (user_id,action,window_started_at,attempts) VALUES (?,?,?,1)
    ON CONFLICT(user_id,action) DO UPDATE SET
      window_started_at=CASE WHEN window_started_at<=? THEN excluded.window_started_at ELSE window_started_at END,
      attempts=CASE WHEN window_started_at<=? THEN 1 ELSE attempts+1 END
    WHERE window_started_at<=? OR attempts<?
    RETURNING attempts`).bind(userId, action, now, now - 3600, now - 3600, now - 3600, limit).first();
  if (!result) throw new GovernanceError("操作太频繁，请稍后再试", 429);
}
