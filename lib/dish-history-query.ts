export const evidencePageSize = 24;
export const historyPageSize = 48;

// Compute the exact median transitions in SQLite; transfer only the requested page.
export function dishHistoryQuery(id: string, page = 1) {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new RangeError("Invalid history page");
  return { sql: `WITH cumulative AS (
    SELECT created_at at, ROW_NUMBER() OVER w voteCount,
      SUM(target_tier <= 1) OVER w n1, SUM(target_tier <= 2) OVER w n2,
      SUM(target_tier <= 3) OVER w n3, SUM(target_tier <= 4) OVER w n4
    FROM votes WHERE dish_id=? WINDOW w AS (ORDER BY created_at,id ROWS UNBOUNDED PRECEDING)
  ), medians AS (
    SELECT at,voteCount,CASE WHEN n1>voteCount/2 THEN 1 WHEN n2>voteCount/2 THEN 2
      WHEN n3>voteCount/2 THEN 3 WHEN n4>voteCount/2 THEN 4 ELSE 5 END tier FROM cumulative
  ), changes AS (SELECT *, LAG(tier) OVER (ORDER BY voteCount) previous FROM medians)
  SELECT at,voteCount,tier,COUNT(*) OVER () total FROM changes
  WHERE previous IS NULL OR previous<>tier ORDER BY voteCount LIMIT ? OFFSET ?`,
  bindings: [id,historyPageSize,(page-1)*historyPageSize] };
}
