import assert from "node:assert/strict";

export async function verifySplitVotes({ request, admin, ordinary, sql }) {
  sql(`INSERT INTO dishes(id,original_description,category) VALUES ('split-origin','两种甜点混在一起','side');
    INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES
    ('split-meal1','venue-escoffier','fixture-user-01','2026-09-01','split-1',901),
    ('split-meal2','venue-escoffier','fixture-user-02','2026-09-02','split-2',902),
    ('split-meal3','venue-escoffier','fixture-user-01','2026-09-03','split-3',903);
    INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier,created_at) VALUES
    ('split-s1','split-origin','venue-escoffier','2026-09-01','fixture-user-01',2,'2026-09-01 12:00:00'),
    ('split-s2','split-origin','venue-escoffier','2026-09-02','fixture-user-02',5,'2026-09-02 12:00:00'),
    ('split-s3','split-origin','venue-escoffier','2026-09-03','fixture-user-01',4,'2026-09-03 12:00:00');
    INSERT INTO meal_items(meal_id,serving_id,slot) VALUES ('split-meal1','split-s1','side_1'),('split-meal2','split-s2','side_1'),('split-meal3','split-s3','side_1');
    INSERT INTO votes(id,dish_id,user_id,target_tier,source_serving_id,created_at) VALUES
    ('split-v1','split-origin','fixture-user-01',2,'split-s1','2026-09-01 12:00:00'),
    ('split-v2','split-origin','fixture-user-02',5,'split-s2','2026-09-02 12:00:00');
    INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES ('split-community','split-origin','fixture-user-03',3);`);
  const action = (body, cookie = admin) => request('/api/admin/actions', 'POST', body, cookie);
  const split = (servingId) => action({ action: 'split_serving', servingId, name: '独立甜点' });
  const detail = (id) => request(`/api/dishes/${id}`).then(r => r.json()).then(r => r.data);
  const votes = (id) => sql(`SELECT user_id,target_tier,source_serving_id FROM votes WHERE dish_id='${id}' ORDER BY user_id`, true)[0].results;
  assert.equal((await action({ action: 'split_serving', servingId: 'split-s1', name: '甜点' }, ordinary)).status, 403);
  const parallel = await Promise.all([split('split-s1'), split('split-s1')]);
  assert.deepEqual(parallel.map(r => r.status).sort(), [200,409]);
  const new1 = (await parallel.find(r => r.status === 200).json()).data.dishId;
  assert.deepEqual(votes(new1), [{ user_id:'fixture-user-01',target_tier:2,source_serving_id:'split-s1' }]);
  assert.equal(votes('split-origin').length, 3);
  assert.equal(votes('split-origin')[0].target_tier, 4, 'earliest remaining observation supplies the original dish initial');
  const firstDetail = await detail(new1); assert.equal(firstDetail.votes, 1); assert.equal(firstDetail.tier, 2); assert.deepEqual(firstDetail.distribution,[0,1,0,0,0]);
  const second = await split('split-s2'); const secondBody = await second.json(); assert.equal(second.status,200,JSON.stringify(secondBody));
  const new2 = secondBody.data.dishId;
  assert.equal((await split('split-s3')).status,409,'do not orphan a singleton dish');
  assert.deepEqual(votes('split-origin').map(v=>v.target_tier),[4,3]);
  const merged = await action({action:'merge_dish',sourceDishId:new1,targetDishId:'split-origin'}); assert.equal(merged.status,200,await merged.text());
  assert.deepEqual(votes('split-origin').map(v=>v.target_tier),[2,3]);
  const again = await split('split-s3'); const againBody = await again.json(); assert.equal(again.status,200,JSON.stringify(againBody));
  assert.deepEqual(votes(againBody.data.dishId).map(v=>v.target_tier),[4], 'split restores a previously deduplicated observation initial');
  assert.deepEqual(votes('split-origin').map(v=>v.target_tier),[2,3]);
  assert.equal((await request(`/api/dishes/${new1}/vote`,'POST',{targetTier:3},ordinary)).status,404);
  // Reproduce a historical split without provenance/initial, then verify explicit repair is idempotent.
  sql(`DELETE FROM votes WHERE dish_id='${new2}'`);
  const queue = await request('/api/admin/queue','GET',undefined,admin).then(r=>r.json());
  assert.ok(queue.data.splitRepairs.some(r=>r.serving_id==='split-s2'));
  assert.equal((await action({action:'repair_split_vote',servingId:'split-s2'},ordinary)).status,403);
  const repairs=await Promise.all([action({action:'repair_split_vote',servingId:'split-s2'}),action({action:'repair_split_vote',servingId:'split-s2'})]);
  assert.deepEqual(repairs.map(r=>r.status).sort(),[200,409]);
  assert.deepEqual(votes(new2),[{user_id:'fixture-user-02',target_tier:5,source_serving_id:'split-s2'}]);
  assert.equal((await detail(new2)).votes,1);
  const audit = sql("SELECT details_json FROM moderation_actions WHERE action='merge_dish' AND json_extract(details_json,'$.targetId')='split-origin'",true)[0].results;
  assert.equal(JSON.parse(audit[0].details_json).conflictingVotes.length,2);
  sql(`INSERT INTO dishes(id,category) VALUES ('tie-1a','side'),('tie-1b','side'),('tie-2a','side'),('tie-2b','side');
    INSERT INTO votes(id,dish_id,user_id,target_tier,created_at) VALUES
    ('a-tie1','tie-1a','fixture-user-01',2,'2026-09-01'),('z-tie1','tie-1b','fixture-user-01',5,'2026-09-01'),
    ('a-tie2','tie-2a','fixture-user-01',2,'2026-09-01'),('z-tie2','tie-2b','fixture-user-01',5,'2026-09-01');`);
  assert.equal((await action({action:'merge_dish',sourceDishId:'tie-1a',targetDishId:'tie-1b'})).status,200);
  assert.equal((await action({action:'merge_dish',sourceDishId:'tie-2b',targetDishId:'tie-2a'})).status,200);
  assert.equal(votes('tie-1b')[0].target_tier,2);
  assert.equal(votes('tie-2a')[0].target_tier,2,'same-time winner must not depend on merge direction');
  assert.equal((await action({action:'merge_dish',sourceDishId:'tie-1b',targetDishId:'tie-1b'})).status,400);
  assert.equal((await action({action:'merge_dish',sourceDishId:'tie-1b',targetDishId:'couscous-boulettes'})).status,409);
  console.log('Split/merge vote audit passed: initial provenance, concurrency, repeat protection, remaining observations, merge/split cycle, historical repair, old-target refusal and conflict evidence.');
}
