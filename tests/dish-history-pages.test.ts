import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { dishHistoryPageQueries, dishHistoryQuery } from "../lib/dish-history-query.ts";

function fixture(count = 10001) {
  const db = new DatabaseSync(":memory:");
  db.exec(`PRAGMA foreign_keys=ON;
    CREATE TABLE dishes(id TEXT PRIMARY KEY);
    CREATE TABLE votes(id TEXT PRIMARY KEY,dish_id TEXT REFERENCES dishes(id),target_tier INTEGER,created_at TEXT);
    CREATE INDEX votes_dish_history_idx ON votes(dish_id,created_at,id,target_tier);
    INSERT INTO dishes VALUES ('hot'),('other'),('empty');`);
  db.exec(readFileSync(new URL("../drizzle/0026_dish_history_pages.sql", import.meta.url), "utf8"));
  let taps = 0;
  db.function("vote_tap", (id) => { assert.equal(typeof id, "string"); taps++; return 1; });
  const insert = db.prepare("INSERT INTO votes VALUES(?,?,?,?)");
  db.exec("BEGIN");
  for (let i = count - 1; i >= 0; i--) insert.run(String(i).padStart(8, "0"), "hot", i % 2 ? 3 : 2, String(Math.floor(i / 3)).padStart(8, "0"));
  insert.run("other-vote", "other", 5, "0");
  db.exec("COMMIT");

  function read(dish: string, page = 1, failTail = false) {
    const queries = dishHistoryPageQueries(dish, page);
    db.exec("BEGIN");
    try {
      for (const query of queries.slice(0, -1)) {
        // A side-effecting probe on the votes source proves its execution count.
        assert.ok(query.sql.includes("WHERE dish_id=? WINDOW"));
        const sql = query.sql.replace("WHERE dish_id=? WINDOW", "WHERE dish_id=? AND vote_tap(id)=1 WINDOW");
        db.prepare(sql).run(...query.bindings);
      }
      const query = queries.at(-1)!;
      const row = db.prepare(query.sql).get(...query.bindings);
      if (failTail) db.exec("INSERT INTO dishes VALUES ('hot')");
      db.exec("COMMIT");
      if (!row) return undefined;
      assert.equal(typeof row.rows_json, "string");
      return { page: Number(row.page), rows: JSON.parse(String(row.rows_json)) };
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
  function expected(dish: string, page = 1) {
    const query = dishHistoryQuery(dish, page);
    return db.prepare(query.sql).all(...query.bindings).map(row => ({ ...row }));
  }
  const entries = (dish: string) => Number(db.prepare("SELECT COUNT(*) n FROM dish_history_pages WHERE dish_id=?").get(dish)?.n);
  return { db, read, expected, insert, entries, taps: () => taps, resetTaps: () => { taps = 0; } };
}

test("actual history page SQL computes once for queued cold requests and skips votes on hits or invalid pages", async () => {
  const f = fixture();
  try {
    const expected = f.expected("hot");
    const queued = await Promise.all(Array.from({ length: 50 }, () => Promise.resolve().then(() => f.read("hot"))));
    assert.equal(f.taps(), 10001);
    assert.equal(f.entries("hot"), 1);
    for (const result of queued) assert.deepEqual(result, { page: 1, rows: expected });
    f.resetTaps();
    for (let i = 0; i < 50; i++) assert.deepEqual(f.read("hot"), queued[0]);
    for (const page of [210, 211, 9999, 10000]) assert.deepEqual(f.read("hot", page), queued[0]);
    assert.equal(f.taps(), 0);
    assert.equal(f.entries("hot"), 1);
    for (const page of [2, 209]) assert.deepEqual(f.read("hot", page), { page, rows: f.expected("hot", page) });
    assert.equal(f.taps(), 20002);

    f.db.exec("DELETE FROM dish_history_pages WHERE dish_id='hot'"); f.resetTaps();
    for (let i = 0; i < 50; i++) assert.deepEqual(f.read("hot", 10000), queued[0]);
    assert.equal(f.taps(), 10001);
    assert.equal(f.entries("hot"), 1);
    f.db.exec("DELETE FROM dish_history_pages WHERE dish_id='hot'"); f.resetTaps();
    const second = f.expected("hot", 2);
    for (let i = 0; i < 50; i++) assert.deepEqual(f.read("hot", 2), { page: 2, rows: second });
    assert.equal(f.taps(), 20002);
    assert.equal(f.entries("hot"), 2);
    f.resetTaps();
    for (let i = 0; i < 50; i++) assert.deepEqual(f.read("empty", 10000), { page: 1, rows: [] });
    assert.equal(f.entries("empty"), 1);
    assert.equal(f.read("missing"), undefined);
    assert.equal(f.taps(), 0);
    assert.throws(() => dishHistoryPageQueries("hot", 0), RangeError);
    assert.throws(() => dishHistoryPageQueries("hot", 10001), RangeError);
  } finally { f.db.close(); }
});

test("actual migration invalidates all affected pages atomically and preserves unrelated history", () => {
  const f = fixture(101);
  try {
    f.read("other");
    const other = f.db.prepare("SELECT rows_json FROM dish_history_pages WHERE dish_id='other'").get()?.rows_json;
    const checkMutation = (mutate: () => unknown) => {
      f.read("hot"); f.read("hot", 2); mutate();
      assert.equal(f.entries("hot"), 0);
      assert.equal(f.db.prepare("SELECT rows_json FROM dish_history_pages WHERE dish_id='other'").get()?.rows_json, other);
      assert.deepEqual(f.read("hot"), { page: 1, rows: f.expected("hot") });
    };
    checkMutation(() => f.insert.run("new", "hot", 5, "new"));
    checkMutation(() => f.db.exec("UPDATE votes SET target_tier=1 WHERE id='new'"));
    checkMutation(() => f.db.exec("UPDATE votes SET created_at='00000001' WHERE id='new'"));
    checkMutation(() => f.db.exec("UPDATE votes SET id='renamed' WHERE id='new'"));
    checkMutation(() => f.db.exec("DELETE FROM votes WHERE id='renamed'"));
    f.db.exec("UPDATE votes SET dish_id='other' WHERE id='00000000'");
    assert.equal(f.entries("hot"), 0); assert.equal(f.entries("other"), 0);
    for (const dish of ["hot", "other"]) assert.deepEqual(f.read(dish), { page: 1, rows: f.expected(dish) });
    const before = f.read("hot");
    f.db.exec("BEGIN; DELETE FROM votes WHERE dish_id='hot'; ROLLBACK;");
    assert.deepEqual(f.read("hot"), before);
    f.db.exec("DELETE FROM dish_history_pages WHERE dish_id='hot'");
    assert.throws(() => f.read("hot", 1, true));
    assert.equal(f.entries("hot"), 0);
    f.db.exec("DELETE FROM votes WHERE dish_id='hot'");
    assert.deepEqual(f.read("hot"), { page: 1, rows: [] });
    f.db.exec("DELETE FROM dishes WHERE id='hot'");
    assert.equal(f.entries("hot"), 0);
  } finally { f.db.close(); }
});
