import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { rankingQuery, type RankingQuery } from "../lib/ranking-query.ts";

test("stack pagination keeps shared provenance together without pooling votes, names or scope", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const file of readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort()) db.exec(readFileSync(`drizzle/${file}`, "utf8"));
    db.exec("INSERT INTO users(id,email_digest) VALUES('stack-user','stack-user')");
    const venues = Array.from({length:15},(_,i)=>`stack-v${i}`);
    venues.forEach((id,i)=>db.prepare("INSERT INTO venues(id,canonical_name,nickname,display_number) VALUES(?,?,?,?)").run(id,id,id,200000+i));
    let sequence=0;
    function add(id:string, venue:string, root:string|null, tier:number, category="main") {
      db.prepare("INSERT INTO dishes(id,venue_id,legacy_source_id,category,original_description) VALUES(?,?,?,?,'Same dish name')").run(id,venue,root,category);
      db.prepare("INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES(?,?,'stack-user','2026-09-23',?,?)").run(id,venue,id,++sequence);
      db.prepare("INSERT INTO servings(id,dish_id,venue_id,creator_id,served_on,initial_tier) VALUES(?,?,?,'stack-user','2026-09-23',?)").run(id,id,venue,tier);
      db.prepare("INSERT INTO meal_items(meal_id,serving_id,slot) VALUES(?,?,?)").run(id,id,category === "main" ? "main" : "side_1");
      db.prepare("INSERT INTO votes(id,dish_id,user_id,source_serving_id,target_tier) VALUES(?,?,'stack-user',?,?)").run(id,id,id,tier);
    }
    const query=(input:RankingQuery)=>{ const q=rankingQuery(input);return db.prepare(q.sql).all(...q.bindings); };
    for(let i=0;i<14;i++) add(`shared-${String(i).padStart(2,'0')}`,venues[i],"shared-root",i===0?1:5);
    add("separate-a",venues[0],null,2); add("separate-b",venues[1],null,3);
    add("side-category",venues[14],"shared-root",2,"side");
    add("hidden",venues[0],"hidden-root",1); db.exec("UPDATE servings SET status='hidden' WHERE id='hidden'");
    add("hidden-meal",venues[0],"meal-root",1); db.exec("UPDATE meals SET status='hidden' WHERE id='hidden-meal'");
    add("merged",venues[0],"merged-root",1); db.exec("UPDATE dishes SET merged_into_dish_id='separate-a' WHERE id='merged'");
    const base={category:"main" as const,venueIds:venues};
    const grouped=query({...base,grouped:true});
    assert.equal(grouped.length,3);
    assert.equal(grouped[0].group_size,14);
    assert.equal(grouped[0].vote_count,1);
    assert.equal(grouped[0].sort_tier,1);
    assert.equal(grouped[0].total_count,3);
    assert.equal(new Set(grouped.map(row=>row.group_id)).size,3,"Equal names without provenance remain separate");
    const first=query({...base,relatedTo:"shared-00",limit:12});
    const next=query({...base,relatedTo:"shared-00",limit:12,page:2});
    assert.equal(first.length,12); assert.equal(next.length,2);
    assert.equal(first[0].total_count,14);
    assert.equal(new Set([...first,...next].map(row=>row.id)).size,14);
    assert.ok([...first,...next].every(row=>row.vote_count===1 && row.group_id==="shared-root"));
    const scoped=query({...base,venueIds:[venues[1]],grouped:true});
    assert.equal(scoped.length,2); assert.ok(scoped.every(row=>row.group_size===1));
    assert.deepEqual(query({...base,venueIds:[venues[1]],relatedTo:"shared-00"}).map(row=>row.id),["shared-01"]);
    assert.deepEqual(query({...base,relatedTo:"merged"}),[]);
    for(let i=0;i<50;i++) add(`single-${i}`,venues[0],null,4);
    const pages=[query({...base,grouped:true,page:1}),query({...base,grouped:true,page:2})];
    assert.equal(pages[0].length,48);assert.equal(pages[1].length,5);
    assert.equal(new Set(pages.flat().map(row=>row.group_id)).size,53);
    assert.equal(pages[0][0].total_count,53);
  } finally { db.close(); }
});
