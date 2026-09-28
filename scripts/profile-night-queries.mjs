// Local synthetic SQLite query cost/plan. Excludes D1 network, Worker and rendering time.
// node scripts/profile-night-queries.mjs .sites-runtime/concurrency-*/v3/d1/miniflare-D1DatabaseObject/<db>.sqlite
import assert from 'node:assert/strict';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { rankingQuery } from '../lib/ranking-query.ts';
import { dishHistoryQuery } from '../lib/dish-history-query.ts';
const file = path.resolve(process.argv[2]);
assert.ok(file.startsWith(path.resolve('.sites-runtime') + path.sep), 'Only disposable local databases are accepted');
const db = new DatabaseSync(file, { readOnly: true });
const cases = [
  ['ranking-all', rankingQuery({})],
  ['ranking-grouped', rankingQuery({ grouped: true })],
  ['ranking-one-venue', rankingQuery({ venueIds: ['load-v0'] })],
  ['related-12', rankingQuery({ relatedTo: 'load-d0', limit: 12 })],
  ['hot-summary', rankingQuery({ dishId: 'load-hot', limit: 1 })],
  ['hot-history-uncached', dishHistoryQuery('load-hot')],
  ['hot-history-cache-read', { sql: 'SELECT page,rows_json FROM dish_history_pages WHERE dish_id=? AND page=1', bindings: ['load-hot'] }],
].map(([name, query]) => ({ name, query, statement: db.prepare(query.sql), times: [], rows: [] }));
try {
  for (let round = 0; round < 33; round++) for (const entry of round % 2 ? [...cases].reverse() : cases) {
    const started = performance.now(); entry.rows = entry.statement.all(...entry.query.bindings);
    if (round >= 3) entry.times.push(performance.now() - started);
  }
  console.log(JSON.stringify({ runtime: process.version, file, samples: 30,
    dishes: db.prepare('SELECT count(*) n FROM dishes').get().n,
    votes: db.prepare('SELECT count(*) n FROM votes').get().n,
    queries: cases.map(({ name, query, times, rows }) => {
      times.sort((a, b) => a - b);
      return { name, p50ms: +times[14].toFixed(3), p95ms: +times[28].toFixed(3), rows: rows.length,
        plan: db.prepare('EXPLAIN QUERY PLAN ' + query.sql).all(...query.bindings).map(row => row.detail) };
    }),
  }, null, 2));
} finally { db.close(); }
