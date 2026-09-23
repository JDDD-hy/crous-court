// Actual migration constraints; all mutations remain in disposable memory.
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const db = new DatabaseSync(':memory:');
const migrations = readdirSync(new URL('drizzle/', root)).filter(name => name.endsWith('.sql')).sort();
for (const name of migrations.filter(name => name < '0024')) db.exec(readFileSync(new URL(`drizzle/${name}`, root),'utf8'));
db.exec(`
  INSERT INTO venues(id,canonical_name,nickname,display_number) VALUES('iso-a','Same name','A',20001),('iso-b','Same name','B',20002);
  INSERT INTO users(id) VALUES('iso-u'),('iso-other');
  INSERT INTO dishes(id,venue_id,category) VALUES('iso-da','iso-a','main'),('iso-da2','iso-a','main'),('iso-db','iso-b','main'),('iso-null',NULL,'main');
  INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('iso-sa','iso-da','iso-a','2026-09-22','iso-u',3),('iso-sb','iso-db','iso-b','2026-09-22','iso-other',3),('iso-legacy-a','iso-null','iso-a','2026-09-22','iso-other',3),('iso-legacy-b','iso-null','iso-b','2026-09-22','iso-u',3);
  INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES('iso-ma','iso-a','iso-u','2026-09-22','ISO-A',1);
  INSERT INTO meal_items(meal_id,serving_id,slot) VALUES('iso-ma','iso-sa','main');
  INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('iso-vote','iso-da','iso-u',3),('iso-legacy-vote','iso-null','iso-other',3);
`);
for (const name of migrations.filter(name => name >= '0024')) db.exec(readFileSync(new URL(`drizzle/${name}`,root),'utf8'));
const checks = [];
function check(name, sql, shouldReject = true) {
  db.exec('SAVEPOINT probe');
  let error = null;
  try { db.exec(sql); } catch (cause) { error = cause.message; }
  db.exec('ROLLBACK TO probe; RELEASE probe');
  checks.push({ name, passed: shouldReject ? Boolean(error) : !error, expected: shouldReject ? 'rejected' : 'allowed', actual: error ?? 'allowed' });
}
check('Cross-venue serving INSERT', "INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('bad','iso-da','iso-b','2026-09-22','iso-u',3)");
check('Same-venue serving INSERT allowed', "INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('good','iso-da','iso-a','2026-09-22','iso-u',3)", false);
check('First serving binds a new unassigned dish', "INSERT INTO dishes(id,category) VALUES('fresh','main'); INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('fresh-s','fresh','iso-a','2026-09-22','iso-u',3); INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('fresh-v','fresh','iso-u',3)", false);
check('Legacy shared dish cannot be silently bound by a new serving', "INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('legacy-new','iso-null','iso-a','2026-09-22','iso-u',3)");
check('Missing dish rejected', "INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('missing-s','missing-d','iso-a','2026-09-22','iso-u',3)");
check('Cross-venue serving dish UPDATE', "UPDATE servings SET dish_id='iso-db' WHERE id='iso-sa'");
check('Cross-venue serving venue UPDATE', "UPDATE servings SET venue_id='iso-b' WHERE id='iso-sa'");
check('Cross-venue serving combined dish+venue UPDATE', "UPDATE servings SET dish_id='iso-db',venue_id='iso-b' WHERE id='iso-sa'");
check('Cross-venue ordinary vote UPDATE', "UPDATE votes SET dish_id='iso-db' WHERE id='iso-vote'");
check('Cross-venue merge pointer UPDATE', "UPDATE dishes SET merged_into_dish_id='iso-db' WHERE id='iso-da'");
check('Bound dish venue immutable', "UPDATE dishes SET venue_id='iso-b' WHERE id='iso-da'");
check('Bound dish venue cannot become null', "UPDATE dishes SET venue_id=NULL WHERE id='iso-da'");
check('Unassigned dish cannot receive new votes', "INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('bad-vote','iso-null','iso-u',3)");
check('Legacy anonymous vote cannot gain guessed provenance during move', "UPDATE votes SET dish_id='iso-db',source_serving_id='iso-sb' WHERE id='iso-legacy-vote'");
check('Legacy anonymous vote cannot gain guessed provenance before move', "UPDATE votes SET source_serving_id='iso-legacy-a' WHERE id='iso-legacy-vote'");
check('Same-venue serving reassociation allowed', "UPDATE servings SET dish_id='iso-da2' WHERE id='iso-sa'", false);
check('Same-venue ordinary vote move allowed', "UPDATE votes SET dish_id='iso-da2' WHERE id='iso-vote'", false);
check('Same-venue merge pointer allowed', "UPDATE dishes SET merged_into_dish_id='iso-da2' WHERE id='iso-da'", false);
check('Same user independently votes at another venue', "INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('independent','iso-db','iso-u',1)", false);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
const report = { recordedAt:new Date().toISOString(), sourceHashes:Object.fromEntries(migrations.map(name=>[name,createHash('sha256').update(readFileSync(new URL(`drizzle/${name}`,root))).digest('hex')])), checks, passed:checks.filter(c=>c.passed).length, failed:checks.filter(c=>!c.passed).length };
console.log(JSON.stringify({...report,sourceHashes:undefined},null,2));
db.close();
process.exitCode = report.failed ? 1 : 0;
