import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync,readdirSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createHash } from 'node:crypto';
import { restaurantIsolationStatements,isolationMigrationId } from '../lib/restaurant-isolation.ts';
const root=new URL('../',import.meta.url);
const shared='3dc63a37-5ad5-47f4-9b2a-b3ea00ca147c';
const a='54af46ba-ff74-45bc-ad0a-717bdeb8128c',b='f2215e9e-b33d-4e3e-bb10-1f49383810f6';
const migrationFiles=readdirSync(new URL('drizzle/',root)).filter(n=>n.endsWith('.sql')).sort();
const checks=[];
function database({unknownCross=false,sharedPresent=true}={}) {
  const sqlite=new DatabaseSync(':memory:');
  for(const name of migrationFiles.filter(n=>n<'0024')) sqlite.exec(readFileSync(new URL(`drizzle/${name}`,root),'utf8'));
  sqlite.exec(`INSERT INTO users(id) VALUES('check-a'),('check-b'),('check-c');
    INSERT INTO dishes(id,original_description,category) VALUES('single','Historical name','main');
    INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('single-s','single','cafeteria-escoffier-2','2026-09-20','check-a',5);
    INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('single-v','single','check-a',5);
    INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES('single-m','cafeteria-escoffier-2','check-a','2026-09-20','ORIGINAL-SINGLE-CASE',1);
    INSERT INTO meal_items(meal_id,serving_id,slot) VALUES('single-m','single-s','main');`);
  if(sharedPresent) sqlite.exec(`INSERT INTO dishes(id,original_description,category) VALUES('${shared}','Shared historical name','main');
    INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('${a}','${shared}','cafeteria-lexperimental-2','2026-09-21','check-a',3),('${b}','${shared}','cafeteria-escoffier-2','2026-09-21','check-b',2);
    INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES('shared-ma','cafeteria-lexperimental-2','check-a','2026-09-21','ORIGINAL-A-CASE',1),('shared-mb','cafeteria-escoffier-2','check-b','2026-09-21','ORIGINAL-B-CASE',1);
    INSERT INTO meal_items(meal_id,serving_id,slot) VALUES('shared-ma','${a}','main'),('shared-mb','${b}','main');
    INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('104dfe09-8513-49bf-a2de-a628059b5cb6','${shared}','check-a',3),('1f0e4251-503e-4d29-a640-f09f0eb93b98','${shared}','check-b',2),('69961d21-1d83-4ac5-b5a9-cf87a73a0099','${shared}','check-c',3);`);
  if(unknownCross) sqlite.exec(`INSERT INTO dishes(id,category) VALUES('unreviewed','main'); INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('unexpected-a','unreviewed','cafeteria-lexperimental-2','2026-09-21','check-a',3),('unexpected-b','unreviewed','cafeteria-escoffier-2','2026-09-21','check-b',2);`);
  for(const name of migrationFiles.filter(n=>n>='0024')) sqlite.exec(readFileSync(new URL(`drizzle/${name}`,root),'utf8'));
  let tail=Promise.resolve();
  const api={calls:0,prepare(sql) {let values=[];return {sql,get values(){return values},bind(...args){values=args;return this},async first(){await Promise.resolve();return sqlite.prepare(sql).get(...values)??null},async all(){return {results:sqlite.prepare(sql).all(...values)}}};},batch(statements){
    api.calls++;const operation=tail.then(()=>{sqlite.exec('BEGIN');try{const result=statements.map(s=>({meta:{changes:Number(sqlite.prepare(s.sql).run(...s.values).changes)}}));sqlite.exec('COMMIT');return result;}catch(error){sqlite.exec('ROLLBACK');throw error;}});tail=operation.catch(()=>{});return operation;
  }};
  return {sqlite,api};
}
function snapshot(sqlite) {return JSON.stringify(['dishes','servings','votes','meals','meal_items','photos','app_data_migrations'].map(table=>sqlite.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));}
const middlewareSource=readFileSync(new URL('middleware.ts',root),'utf8');
function worker(api) {
  const code=stripTypeScriptTypes(middlewareSource.replace(/^import .*;\r?\n/gm,'')).replaceAll('export ','');
  return new Function('NextResponse','getRawDb','isolationMigrationId','restaurantIsolationStatements','console',code+'\nreturn middleware;')({next:()=>new Response(null,{status:200})},()=>api,isolationMigrationId,restaurantIsolationStatements,{error(){}});
}
function verifyData(sqlite,oldVotes,oldMeals) {
  assert.equal(sqlite.prepare("SELECT venue_id FROM dishes WHERE id='single'").get().venue_id,'cafeteria-escoffier-2');
  assert.deepEqual(sqlite.prepare("SELECT * FROM votes WHERE id='single-v' OR dish_id=? ORDER BY id").all(shared),oldVotes);
  assert.deepEqual(sqlite.prepare('SELECT * FROM meals ORDER BY id').all(),oldMeals);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM dishes WHERE legacy_source_id=? AND venue_id IS NOT NULL').get(shared).n,2);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM votes v JOIN dishes d ON d.id=v.dish_id WHERE d.legacy_source_id=? AND d.venue_id IS NOT NULL').get(shared).n,2);
  assert.deepEqual(sqlite.prepare('SELECT s.id,s.initial_tier,v.target_tier,v.source_serving_id FROM servings s JOIN votes v ON v.source_serving_id=s.id WHERE s.id IN (?,?) ORDER BY s.id').all(a,b).map(row=>({...row})),[{id:a,initial_tier:3,target_tier:3,source_serving_id:a},{id:b,initial_tier:2,target_tier:2,source_serving_id:b}]);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM servings WHERE dish_id=?').get(shared).n,0);
  assert.equal(sqlite.prepare('SELECT venue_id FROM dishes WHERE id=?').get(shared).venue_id,null);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM servings s JOIN dishes d ON d.id=s.dish_id WHERE s.venue_id IS NOT d.venue_id').get().n,0);
  assert.deepEqual(sqlite.prepare('PRAGMA foreign_key_check').all(),[]);
}
{
  const {sqlite,api}=database();
  const oldVotes=sqlite.prepare("SELECT * FROM votes WHERE id='single-v' OR dish_id=? ORDER BY id").all(shared);
  const oldMeals=sqlite.prepare('SELECT * FROM meals ORDER BY id').all();
  await api.batch(restaurantIsolationStatements(api,'first'));
  verifyData(sqlite,oldVotes,oldMeals);
  const after=snapshot(sqlite);await api.batch(restaurantIsolationStatements(api,'retry'));assert.equal(snapshot(sqlite),after);
  checks.push('Exact reviewed shared split: original four votes untouched, two scoped initial votes, meals preserved, rerun unchanged');sqlite.close();
}
{
  const {sqlite,api}=database({sharedPresent:false});await api.batch(restaurantIsolationStatements(api,'single-only'));
  assert.equal(sqlite.prepare("SELECT venue_id FROM dishes WHERE id='single'").get().venue_id,'cafeteria-escoffier-2');
  assert.equal(sqlite.prepare('SELECT count(*) n FROM votes').get().n,1);checks.push('Single-venue only database binds existing Dish in place without cloning votes');sqlite.close();
}
{
  const {sqlite,api}=database();const before=snapshot(sqlite);
  sqlite.exec(`CREATE TRIGGER force_clone_failure BEFORE INSERT ON dishes WHEN NEW.legacy_source_id='${shared}' BEGIN SELECT RAISE(ABORT,'intentional rollback test'); END;`);
  const run=worker(api);const response=await run();assert.equal(response.status,503);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(snapshot(sqlite),before);
  sqlite.exec('DROP TRIGGER force_clone_failure');assert.equal((await run()).status,200);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM app_data_migrations').get().n,1);assert.equal(sqlite.prepare('SELECT count(*) n FROM votes').get().n,6);
  const after=snapshot(sqlite);assert.equal((await run()).status,200);assert.equal(snapshot(sqlite),after);
  checks.push('Injected mid-batch failure rolls back marker and data; same worker returns503, clears failed promise, retries once without duplicate votes');sqlite.close();
}
{
  const {sqlite,api}=database();const run=worker(api);const responses=await Promise.all(Array.from({length:20},()=>run()));assert.ok(responses.every(r=>r.status===200));assert.equal(api.calls,1);assert.equal(sqlite.prepare('SELECT count(*) n FROM votes').get().n,6);checks.push('20 concurrent requests in one worker share one initialization batch');sqlite.close();
}
{
  const {sqlite,api}=database();const one=worker(api),two=worker(api);const responses=await Promise.all(Array.from({length:20},(_,i)=>(i%2?one:two)()));assert.ok(responses.every(r=>r.status===200));assert.ok(api.calls<=2);assert.equal(sqlite.prepare('SELECT count(*) n FROM app_data_migrations').get().n,1);assert.equal(sqlite.prepare('SELECT count(*) n FROM votes').get().n,6);checks.push(`20 concurrent requests across two worker instances: ${api.calls} serialized batches, one winning run_id, two initial votes only`);sqlite.close();
}
{
  const {sqlite,api}=database({unknownCross:true});const before=snapshot(sqlite);const run=worker(api);assert.equal((await run()).status,503);assert.equal(snapshot(sqlite),before);assert.equal((await run()).status,503);assert.equal(snapshot(sqlite),before);checks.push('Unreviewed cross-venue Dish rejects migration twice, leaves all rows and marker unchanged, never runs business response');sqlite.close();
}
{
  const {sqlite,api}=database();
  assert.throws(()=>sqlite.exec("INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES('old-vote','single','check-c',2)"),/dish_venue_mismatch/,'old worker voting on an unassigned historic dish fails closed before the data migration');
  await api.batch([
    api.prepare("INSERT INTO dishes(id,original_description,category,naming_status) VALUES('old-new-dish','Old worker new upload','main','unknown')"),
    api.prepare("INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) VALUES('old-new-serving','old-new-dish','cafeteria-escoffier-2','2026-09-23','check-c',4)"),
    api.prepare("INSERT INTO votes(id,dish_id,user_id,target_tier,source_serving_id) VALUES('old-new-vote','old-new-dish','check-c',4,'old-new-serving')"),
  ]);
  assert.equal(sqlite.prepare("SELECT venue_id FROM dishes WHERE id='old-new-dish'").get().venue_id,'cafeteria-escoffier-2');
  await api.batch(restaurantIsolationStatements(api,'after-old-upload'));
  assert.equal(sqlite.prepare("SELECT target_tier FROM votes WHERE id='old-new-vote'").get().target_tier,4);
  checks.push('Old-writer overlap: fresh unscoped Dish INSERT + first Serving + initial vote remain compatible; historic unassigned vote rejects before migration, confirming a cutover error window');sqlite.close();
}
const report={recordedAt:new Date().toISOString(),checks,sourceHashes:Object.fromEntries(['middleware.ts','lib/restaurant-isolation.ts',...migrationFiles.map(name=>`drizzle/${name}`)].map(name=>[name,createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex')])),caveats:['SQLite proxy models D1 serialized atomic batches and separate worker module state; real deployment routing/old worker draining not tested.','Historical three-vote archive plan approved on 2026-09-23; production migration remains pending release validation.']};
console.log(JSON.stringify({...report,sourceHashes:undefined},null,2));
