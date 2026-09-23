import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { rankingQuery } from '../lib/ranking-query.ts';

// Local synthetic query cost only: excludes Worker, HTTP, rendering and production latency.
const db = new DatabaseSync(':memory:');
for (const file of readdirSync('drizzle').filter(file => file.endsWith('.sql')).sort()) db.exec(readFileSync(`drizzle/${file}`, 'utf8'));
db.exec("INSERT INTO users(id) VALUES('bench-stacks'); BEGIN");
for (let i = 0; i < 14; i++) db.prepare('INSERT INTO venues(id,canonical_name,nickname,display_number) VALUES(?,?,?,?)').run(`v${i}`,`v${i}`,`v${i}`,400000+i);
for (let i = 0; i < 1051; i++) {
  const id=`d${i}`,venue=`v${i%14}`;
  db.prepare("INSERT INTO dishes(id,venue_id,legacy_source_id,category,original_description) VALUES(?,?,?,'main','Benchmark')").run(id,venue,`g${Math.floor(i/14)}`);
  db.prepare("INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES(?,?,'bench-stacks','2026-09-23',?,?)").run(id,venue,id,i+1);
  db.prepare("INSERT INTO servings(id,dish_id,venue_id,creator_id,served_on,initial_tier) VALUES(?,?,?,'bench-stacks','2026-09-23',?)").run(id,id,venue,i%5+1);
  db.prepare("INSERT INTO meal_items(meal_id,serving_id,slot) VALUES(?,?,'main')").run(id,id);
  db.prepare("INSERT INTO votes(id,dish_id,user_id,source_serving_id,target_tier) VALUES(?,?,'bench-stacks',?,?)").run(id,id,id,i%5+1);
}
db.exec('COMMIT');
const cases = [
  ['flat', { category:'main' }],
  ['grouped', { category:'main',grouped:true }],
  ['expanded', { category:'main',relatedTo:'d0',limit:12 }],
].map(([name,input]) => { const q=rankingQuery(input);return {name, statement:db.prepare(q.sql),bindings:q.bindings,times:[],rows:[]}; });
for (let i=0;i<55;i++) for (const entry of i%2 ? [...cases].reverse() : cases) {
  const start=performance.now();entry.rows=entry.statement.all(...entry.bindings);
  if(i>=5) entry.times.push(performance.now()-start);
}
const result=cases.map(({name,times,rows})=>{times.sort((a,b)=>a-b);return {name,samples:times.length,p50ms:+times[24].toFixed(3),p95ms:+times[47].toFixed(3),rows:rows.length,total:rows[0].total_count};});
console.log(JSON.stringify({runtime:process.version,dishes:1051,votes:1051,venues:14,metrics:result},null,2));
db.close();
