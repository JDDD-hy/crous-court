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

// Run the whole list in one D1 batch. SQLite serializes the conditional fill,
// so concurrent cold requests do not each replay every vote.
export function dishHistoryPageQueries(id: string, page = 1) {
  const fill = (page: number) => {
    const history = dishHistoryQuery(id, page);
    return {
      sql: `INSERT INTO dish_history_pages(dish_id,page,rows_json)
        SELECT ?,?,(SELECT json_group_array(json_object('at',at,'tier',tier,'voteCount',voteCount,'total',total)) FROM (${history.sql}))
        WHERE NOT EXISTS(SELECT 1 FROM dish_history_pages WHERE dish_id=? AND page=?)
        AND EXISTS(SELECT 1 FROM dishes WHERE id=?)
        ${page === 1 ? '' : `AND COALESCE((SELECT json_extract(rows_json,'$[0].total') FROM dish_history_pages WHERE dish_id=? AND page=1),0)>?`}
        ON CONFLICT(dish_id,page) DO NOTHING`,
      bindings: [id,page,...history.bindings,id,page,id,...(page === 1 ? [] : [id,(page-1)*historyPageSize])],
    };
  };
  // Validate before creating any statements, including the always-cached first page.
  dishHistoryQuery(id, page);
  return [fill(1), ...(page === 1 ? [] : [fill(page)]), {
    sql: `SELECT page,rows_json FROM dish_history_pages WHERE dish_id=? AND page=CASE
      WHEN COALESCE((SELECT json_extract(rows_json,'$[0].total') FROM dish_history_pages WHERE dish_id=? AND page=1),0)>? THEN ? ELSE 1 END`,
    bindings: [id,id,(page-1)*historyPageSize,page],
  }];
}
