// Local-only closed-loop HTTP load test. Uses a new disposable database, never production.
// Run after npm run build: node scripts/benchmark-concurrency.mjs [--smoke] [--authenticated] [--mixed-only]
// Compare warm history reads with --history-only [--worker-config=path/to/saved-build/wrangler.json].
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { monitorEventLoopDelay } from 'node:perf_hooks';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const historyOnly=process.argv.includes('--history-only');
const smoke=process.argv.includes('--smoke'), levels=historyOnly?[50]:smoke?[1,5]:[1,5,10,20,50], durationMs=smoke?1000:10000;
const authenticated=process.argv.includes('--authenticated'), viewerCount=authenticated?50:0;
const workloads=historyOnly?['read']:process.argv.includes('--mixed-only')?['mixed']:authenticated?['read','mixed']:['read','write','mixed'];
const persist=path.join(root,'.sites-runtime',`concurrency-${Date.now()}`), port=8814, origin=`http://127.0.0.1:${port}`;
const wrangler=path.join(root,'node_modules/wrangler/bin/wrangler.js'),config=path.resolve(root,process.argv.find(arg=>arg.startsWith('--worker-config='))?.slice(16)??'dist/server/wrangler.json');
const poolSize=20000, baselineVotes=25751+viewerCount;
mkdirSync(persist,{recursive:true});
function run(args) {const result=spawnSync(process.execPath,[wrangler,...args],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});assert.equal(result.status,0,result.stdout+result.stderr);return result.stdout;}
run(['d1','migrations','apply','DB','--local','--persist-to',persist,'--config',config]);
const sqliteDir=path.join(persist,'v3/d1/miniflare-D1DatabaseObject');
const files=readdirSync(sqliteDir).filter(name=>name.endsWith('.sqlite')&&name!=='metadata.sqlite');assert.equal(files.length,1);
const sqlitePath=path.join(sqliteDir,files[0]);
const db=new DatabaseSync(sqlitePath);db.exec('PRAGMA foreign_keys=ON; BEGIN');
db.exec("WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<10001) INSERT INTO users(id) SELECT 'seed-user-'||i FROM n");
const userInsert=db.prepare('INSERT INTO users(id) VALUES(?)'),sessionInsert=db.prepare('INSERT INTO auth_sessions(token_digest,user_id,expires_at,created_at) VALUES(?,?,?,?)');
const now=Math.floor(Date.now()/1000), tokens=Array.from({length:poolSize+viewerCount},(_,i)=>`local-concurrency-token-${i}`);
for(let i=0;i<tokens.length;i++) {const id=i<poolSize?`load-user-${i}`:`viewer-user-${i-poolSize}`;userInsert.run(id);sessionInsert.run(createHash('sha256').update(tokens[i]).digest('base64url'),id,now+21600,now);}
for(let i=0;i<14;i++)db.prepare('INSERT INTO venues(id,canonical_name,nickname,display_number) VALUES(?,?,?,?)').run(`load-v${i}`,`Load venue ${i}`,`Load venue ${i}`,800000+i);
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
for(let i=0;i<1051;i++) {
 const id=i===1050?'load-hot':`load-d${i}`,venue=`load-v${i%14}`;
 db.prepare("INSERT INTO dishes(id,venue_id,legacy_source_id,category,original_description) VALUES(?,?,?,'main','Load test dish')").run(id,venue,i===1050?null:`load-g${Math.floor(i/14)}`);
 db.prepare("INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES(?,?,'seed-user-1',?,?,?)").run(id,venue,date,id,i+1);
 db.prepare("INSERT INTO servings(id,dish_id,venue_id,creator_id,served_on,initial_tier) VALUES(?,?,?,'seed-user-1',?,3)").run(id,id,venue,date);
 db.prepare("INSERT INTO meal_items(meal_id,serving_id,slot) VALUES(?,?,'main')").run(id,id);
}
db.exec("WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<15750) INSERT INTO votes(id,dish_id,user_id,target_tier,created_at) SELECT 'seed-vote-'||i,'load-d'||((i-1)/15),'seed-user-'||((i-1)%15+1),i%5+1,printf('2026-09-01 00:%02d:%02d',i/60%60,i%60) FROM n");
db.exec("WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<10001) INSERT INTO votes(id,dish_id,user_id,target_tier,created_at) SELECT 'seed-hot-'||i,'load-hot','seed-user-'||i,CASE WHEN i%2=1 THEN 2 ELSE 3 END,printf('2026-09-01 %02d:%02d:%02d',i/3600%24,i/60%60,i%60) FROM n");
for(let i=0;i<viewerCount;i++)db.prepare('INSERT INTO votes(id,dish_id,user_id,target_tier) VALUES(?,?,?,?)').run(`viewer-vote-${i}`,`load-d${i%14}`,`viewer-user-${i}`,i%5+1);
db.exec('COMMIT');assert.equal(db.prepare('SELECT count(*) n FROM votes').get().n,baselineVotes);db.close();
const envFile=path.join(persist,'public-test.env');writeFileSync(envFile,'AUTH_MODE=local\nAUTH_HMAC_SECRET=concurrency-local-only-secret-at-least-32-chars\n');
const resetFile=path.join(persist,'reset.sql');writeFileSync(resetFile,"DELETE FROM votes WHERE user_id LIKE 'load-user-%'; DELETE FROM vote_rate_limits WHERE user_id LIKE 'load-user-%';");
function snapshot(sql) {const conn=new DatabaseSync(sqlitePath,{readOnly:true});try{return conn.prepare(sql).all();}finally{conn.close();}}
async function reset() {
 // Keep HTTP connection cleanup running while Wrangler resets the fixture between stages.
 await new Promise((resolve,reject)=>{
  const process=spawn(globalThis.process.execPath,[wrangler,'d1','execute','DB','--local','--persist-to',persist,'--config',config,'--file',resetFile,'--yes'],{cwd:root,stdio:['ignore','pipe','pipe']});
  let output='';process.stdout.on('data',data=>{output+=data;});process.stderr.on('data',data=>{output+=data;});process.once('error',reject);process.once('close',code=>code===0?resolve():reject(Error(output)));
 });
 assert.equal(snapshot('SELECT count(*) n FROM votes')[0].n,baselineVotes);
}
const report={recordedAt:new Date().toISOString(),head:spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).stdout.trim(),runtime:process.version,hardware:{cpu:cpus()[0].model,logicalCpus:cpus().length,ramGiB:+(totalmem()/2**30).toFixed(1)},smoke,persist,levels,durationMs,dishes:1051,baselineVotes,venues:14,groups:76,stages:[],correctness:[],sourceHashes:Object.fromEntries(['lib/vote-service.ts','lib/ranking-query.ts','dist/server/index.js','dist/server/wrangler.json'].map(file=>[file,createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')]))};
report.authenticated=authenticated;report.viewerAccounts=viewerCount;report.workloads=workloads;report.scenarios={};
report.historyOnly=historyOnly;report.actualConfig=config;report.loadedBundleSha256=createHash('sha256').update(readFileSync(path.join(path.dirname(config),'index.js'))).digest('hex');
const reportFile=path.join(persist,'results.json');
const child=spawn(process.execPath,[wrangler,'dev','--local','--config',config,'--persist-to',persist,'--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--env-file',envFile],{cwd:root,stdio:['ignore','pipe','pipe']});
let logs='';const log=data=>{logs=(logs+String(data)).slice(-12000);};child.stdout.on('data',log);child.stderr.on('data',log);
const readCases=[
 ['html','/rankings?venue=all'],['all','/api/rankings?venue=all'],['hot','/api/dishes/load-hot'],
 ['html','/rankings?venue=all'],['single','/api/rankings?venue=load-v0'],['related','/api/rankings?venue=all&relatedTo=load-d0'],
 ['hot','/api/dishes/load-hot'],['html','/rankings?venue=all'],['directory','/api/venues'],['all','/api/rankings?venue=all']
].filter(([kind])=>!historyOnly||kind==='hot');
async function request(kind,url,user,tier) {
 const start=performance.now();let row;
 try {
  const response=await fetch(origin+url,{signal:AbortSignal.timeout(10000),...(kind==='vote'?{method:'POST',headers:{origin,'content-type':'application/json',cookie:`crous_session=${tokens[user]}`},body:JSON.stringify({targetTier:tier})}:user===undefined?{}:{headers:{cookie:`crous_session=${tokens[user]}`}})});
  const body=await response.text();row={kind,ms:performance.now()-start,status:response.status,bytes:Buffer.byteLength(body)};
  if(response.status!==200)row.response=body.slice(0,1000);
  if(response.status===200) {
   if(kind==='html')assert.equal((body.match(/data-dish-stack=/g)??[]).length,48);
   else {
    const json=JSON.parse(body);
    if(kind==='vote'){assert.equal(json.data.myVote,tier);assert.equal(json.data.dish.id,url.split('/')[3]);assert.equal(json.data.dish.tierHistory,undefined);}
    else if(kind==='hot'){assert.equal(json.data.id,'load-hot');assert.ok(json.data.tierHistory.length<=48);}
    else if(kind==='directory')assert.ok(json.data.length>=985);
    else {assert.ok(json.data.length<=(kind==='related'?12:48));if(kind==='single')assert.ok(json.data.every(dish=>dish.venueId==='load-v0'));}
    if(kind==='related') {
     const marker=user>=poolSize?`load-d${(user-poolSize)%14}`:null;
     const expected=marker&&json.data.some(dish=>dish.id===marker)?{[marker]:(user-poolSize)%5+1}:{};
     assert.deepEqual(json.reviewedDishIds,expected);assert.equal(response.headers.get('cache-control'),'private, no-store');
    }
   }
  }
 }catch(error){row??={kind,ms:performance.now()-start,status:0,bytes:0};row.error=String(error.message).slice(0,180);if(error.cause)row.cause=String(error.cause.code??error.cause.message).slice(0,180);}
 return row;
}
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return +(sorted[Math.max(0,Math.ceil(sorted.length*p)-1)]??0).toFixed(2);};
function summary(rows,elapsedMs) {const latencies=rows.map(row=>row.ms),statuses={};for(const row of rows)statuses[row.status]=(statuses[row.status]??0)+1;return {requests:rows.length,rps:+(rows.length/(elapsedMs/1000)).toFixed(2),p50ms:percentile(latencies,.5),p95ms:percentile(latencies,.95),p99ms:percentile(latencies,.99),maxMs:+Math.max(0,...latencies).toFixed(2),statuses,errors:rows.filter(row=>row.status!==200||row.error).length};}
async function verifyVotes(accepted) {
 const rows=snapshot("SELECT dish_id,target_tier,count(*) n FROM votes WHERE user_id LIKE 'load-user-%' GROUP BY dish_id,target_tier ORDER BY dish_id,target_tier");
 const expected=new Map();for(const {dish,tier} of accepted){const key=`${dish}:${tier}`;expected.set(key,(expected.get(key)??0)+1);}
 assert.deepEqual(rows.map(row=>[`${row.dish_id}:${row.target_tier}`,row.n]),[...expected].sort(([a],[b])=>a.localeCompare(b)));
 assert.equal(snapshot('SELECT count(*) n FROM votes')[0].n,baselineVotes+accepted.length);
 assert.deepEqual(snapshot('PRAGMA foreign_key_check'),[]);
 for(const dish of new Set(accepted.map(row=>row.dish))) {
  const distribution=[0,0,0,0,0];for(const row of snapshot(`SELECT target_tier,count(*) n FROM votes WHERE dish_id='${dish}' GROUP BY target_tier`)) distribution[row.target_tier-1]=row.n;
  const count=distribution.reduce((a,b)=>a+b,0);let cumulative=0;const tier=distribution.findIndex(n=>(cumulative+=n)>count/2)+1;
  const body=await(await fetch(`${origin}/api/dishes/${dish}`)).json();assert.deepEqual(body.data.distribution,distribution);assert.equal(body.data.votes,count);assert.equal(body.data.tier,tier);
 }
 return {accepted:accepted.length,persisted:rows.reduce((sum,row)=>sum+row.n,0),foreignKeyErrors:0,distributionAndMedian:'match'};
}
async function stage(workload,concurrency) {
 const raw=[],accepted=[];let sequence=0,reads=0,writes=0,inFlight=0,peak=0;
 const eventLoop=monitorEventLoopDelay({resolution:20});eventLoop.enable();
 const start=performance.now(),deadline=start+durationMs;
 await Promise.all(Array.from({length:concurrency},async(_,lane)=>{
  while(performance.now()<deadline){
   const index=sequence++,writing=workload==='write'||(workload==='mixed'&&index%5===0);
   let kind,url,user,tier,dish;
   if(writing){user=writes++;assert.ok(user<poolSize-100,'Synthetic user pool exhausted');dish=user%5===0?'load-d1':'load-hot';tier=user%5+1;kind='vote';url=`/api/dishes/${dish}/vote`;}
   else {[kind,url]=readCases[reads++%readCases.length];if(authenticated)user=poolSize+lane;}
   const offsetMs=performance.now()-start;peak=Math.max(peak,++inFlight);
   const row=await request(kind,url,user,tier);inFlight--;raw.push({...row,offsetMs:+offsetMs.toFixed(2)});
   if(writing&&row.status===200&&!row.error)accepted.push({dish,tier});
  }
 }));
 const elapsedMs=performance.now()-start;eventLoop.disable();
 const result={workload,concurrency,peak,elapsedMs:+elapsedMs.toFixed(2),...summary(raw,elapsedMs),loadGeneratorLoopP99ms:+(eventLoop.percentile(99)/1e6).toFixed(2),byKind:Object.fromEntries([...new Set(raw.map(row=>row.kind))].map(kind=>[kind,summary(raw.filter(row=>row.kind===kind),elapsedMs)])),raw};
 try {result.consistency=await verifyVotes(accepted);}catch(error){result.consistency={error:String(error.message)};}
 report.stages.push(result);writeFileSync(reportFile,JSON.stringify(report,null,2));
 const {raw:unused,byKind,...brief}=result;void unused;void byKind;console.log(JSON.stringify(brief));
 if(result.errors){report.httpFailures=(report.httpFailures??0)+result.errors;process.exitCode=1;}
 assert.ok(!result.consistency.error,result.consistency.error);
 await reset();
}
try {
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs.slice(-1800))),30000);const ready=data=>{if(String(data).includes('Ready on')){clearTimeout(timer);resolve();}};child.stdout.on('data',ready);child.stderr.on('data',ready);child.once('error',reject);});
 for(let i=0;i<20;i++){const [kind,url]=readCases[i%readCases.length];const row=await request(kind,url,authenticated?poolSize+i%viewerCount:undefined);assert.equal(row.status,200);assert.equal(row.error,undefined);}
 if(!historyOnly){for(let i=0;i<10;i++)assert.equal((await request('vote','/api/dishes/load-hot/vote',i,3)).status,200);await reset();}
 console.log(JSON.stringify({ready:true,reportFile,levels,durationMs}));
 for(const workload of workloads)for(const concurrency of levels)await stage(workload,concurrency);
 if(authenticated) {
  // Each account casts a different tier on the same dish; private state must follow its session.
  const voters=Array.from({length:50},(_,i)=>({user:18000+i,tier:i%5+1}));
  const receipts=await Promise.all(voters.map(({user,tier})=>request('vote','/api/dishes/load-hot/vote',user,tier)));
  assert.ok(receipts.every(row=>row.status===200&&!row.error));
  await verifyVotes(voters.map(({tier})=>({dish:'load-hot',tier})));
  await Promise.all(voters.map(async({user,tier})=>{
   const headers={cookie:`crous_session=${tokens[user]}`};
   const response=await fetch(`${origin}/api/rankings?venue=all&relatedTo=load-hot`,{headers});assert.equal(response.status,200);
   assert.equal(response.headers.get('cache-control'),'private, no-store');assert.deepEqual((await response.json()).reviewedDishIds,{'load-hot':tier});
   const duplicate=await fetch(`${origin}/api/dishes/load-hot/vote`,{method:'POST',headers:{...headers,origin,'content-type':'application/json'},body:JSON.stringify({targetTier:6-tier})});
   assert.equal(duplicate.status,409);assert.equal((await duplicate.json()).data.myVote,tier);
  }));
  const anonymous=await fetch(`${origin}/api/rankings?venue=all&relatedTo=load-hot`);assert.equal(anonymous.status,200);assert.deepEqual((await anonymous.json()).reviewedDishIds,{});
  await verifyVotes(voters.map(({tier})=>({dish:'load-hot',tier})));
  report.correctness.push('50 independent accounts vote on one dish: all 50 persist; private reviewedDishIds and duplicate receipts match each account; anonymous response contains no user votes');
  const viewers=await Promise.all(Array.from({length:viewerCount},(_,i)=>request('related','/api/rankings?venue=all&relatedTo=load-d0',poolSize+i)));
  assert.ok(viewers.every(row=>row.status===200&&!row.error));
  report.correctness.push('50 reader accounts: each response exposes only the current account marker vote within its returned page');await reset();
 }
 const duplicates=await Promise.all(Array.from({length:20},()=>request('vote','/api/dishes/load-hot/vote',19000,4)));
 report.scenarios.duplicates=duplicates;
 assert.equal(duplicates.filter(row=>row.status===200).length,1);assert.equal(duplicates.filter(row=>row.status===409).length,19);
 await verifyVotes([{dish:'load-hot',tier:4}]);report.correctness.push('20 simultaneous duplicate votes: exactly 1 accepted, 19 HTTP409, one persisted vote');await reset();
 const twoVenues=await Promise.all(['load-hot','load-d1'].map(dish=>request('vote',`/api/dishes/${dish}/vote`,19001,dish==='load-hot'?1:5)));
 report.scenarios.twoVenues=twoVenues;
 assert.ok(twoVenues.every(row=>row.status===200));await verifyVotes([{dish:'load-hot',tier:1},{dish:'load-d1',tier:5}]);report.correctness.push('Same account votes simultaneously in two restaurants: two independent scores and votes');await reset();
 const limited=await Promise.all(Array.from({length:60},(_,i)=>request('vote',`/api/dishes/load-d${i+2}/vote`,19002,3)));
 report.scenarios.limited=limited;
 assert.equal(limited.filter(row=>row.status===200).length,30);assert.equal(limited.filter(row=>row.status===429).length,30);
 await verifyVotes(limited.flatMap((row,i)=>row.status===200?[{dish:`load-d${i+2}`,tier:3}]:[]));report.correctness.push('60 simultaneous distinct votes by one account: exactly 30 accepted and 30 HTTP429');await reset();
 report.completedAt=new Date().toISOString();console.log(JSON.stringify({completed:true,reportFile,correctness:report.correctness}));
}catch(error){report.failure=String(error.stack);process.exitCode=1;console.error(error.message);}
finally{writeFileSync(reportFile,JSON.stringify(report,null,2));writeFileSync(path.join(persist,'worker-tail.log'),logs);child.kill();}
