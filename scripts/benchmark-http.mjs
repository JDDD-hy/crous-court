// Usage: node benchmark-http.mjs <site checkout> <baseline|after> <dish count>
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
const [root,label,countRaw='80']=process.argv.slice(2), count=Number(countRaw);
const tails=process.argv[5]==='--tails';
assert.ok(root && ['baseline','after'].includes(label) && [80,1050].includes(count));
const persist=path.join(root,'.sites-runtime',`http-${label}-${count}-${Date.now()}`);
mkdirSync(persist,{recursive:true});
const config=path.join(root,'dist/server/wrangler.json'), wrangler=path.join(root,'node_modules/wrangler/bin/wrangler.js');
function run(args){const r=spawnSync(process.execPath,[wrangler,...args],{cwd:root,encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);return r.stdout;}
run(['d1','migrations','apply','DB','--local','--persist-to',persist,'--config',config]);
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const sql=`
WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<10001) INSERT INTO users(id) SELECT 'bench-user-'||i FROM n;
WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<=${count}) INSERT INTO dishes(id,original_description,category) SELECT CASE WHEN i=${count+1} THEN 'bench-hot' ELSE 'bench-dish-'||i END,'Benchmark dish','main' FROM n;
WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<=${count}) INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) SELECT 'bench-meal-'||i,CASE WHEN i%2=0 THEN 'venue-experimental' ELSE 'venue-escoffier' END,'bench-user-1','${date}','BENCH-'||i,i FROM n;
WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<=${count}) INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,initial_tier) SELECT 'bench-serving-'||i,CASE WHEN i=${count+1} THEN 'bench-hot' ELSE 'bench-dish-'||i END,CASE WHEN i%2=0 THEN 'venue-experimental' ELSE 'venue-escoffier' END,'${date}','bench-user-1',3 FROM n;
WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<=${count}) INSERT INTO meal_items(meal_id,serving_id,slot) SELECT 'bench-meal-'||i,'bench-serving-'||i,'main' FROM n;
WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<${count*15}) INSERT INTO votes(id,dish_id,user_id,target_tier,created_at) SELECT 'bench-vote-'||i,'bench-dish-'||((i-1)/15+1),'bench-user-'||((i-1)%15+1),i%5+1,printf('2026-09-01 00:%02d:%02d',i/60%60,i%60) FROM n;
WITH RECURSIVE n(i) AS (VALUES(1) UNION ALL SELECT i+1 FROM n WHERE i<=10000) INSERT INTO votes(id,dish_id,user_id,target_tier,created_at) SELECT 'bench-hot-'||i,'bench-hot','bench-user-'||i,CASE WHEN i%2=1 THEN 2 ELSE 3 END,printf('2026-09-%02d %02d:%02d:%02d',1+i/86400,i/3600%24,i/60%60,i%60) FROM n;
`;
const token='performance-local-session',digest=createHash('sha256').update(token).digest('base64url');
const seed=path.join(persist,'benchmark.sql');writeFileSync(seed,sql+`INSERT INTO auth_sessions(token_digest,user_id,expires_at,created_at) VALUES('${digest}','bench-user-1',${Math.floor(Date.now()/1000)+3600},${Math.floor(Date.now()/1000)});`);
run(['d1','execute','DB','--local','--persist-to',persist,'--config',config,'--file',seed,'--yes']);
const envFile=path.join(persist,'public-test.env');writeFileSync(envFile,'AUTH_MODE=local\nAUTH_HMAC_SECRET=national-performance-local-only-secret-32-chars\nADMIN_EMAILS=admin@example.invalid\n');
const port=label==='baseline'?8801:8802, origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,[wrangler,'dev','--local','--config',config,'--persist-to',persist,'--ip','127.0.0.1','--port',String(port),'--inspector-port','0','--env-file',envFile],{cwd:root,stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',v=>logs+=v);child.stderr.on('data',v=>logs+=v);
const report={label,count,hotVotes:10001,recordedAt:new Date().toISOString(),runtime:process.version,persist,metrics:[]};
try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(logs.slice(-2000))),25000);const ready=v=>{if(String(v).includes('Ready on')){clearTimeout(timer);resolve();}};child.stdout.on('data',ready);child.stderr.on('data',ready);});
  async function measure(name,url,samples=15,init={}){
    const rows=[];
    const warmups=tails?10:3;
    for(let i=0;i<samples+warmups;i++){
      const start=performance.now();const response=await fetch(origin+url,{...init,signal:AbortSignal.timeout(45000)});const body=await response.text();
      if(i>=warmups)rows.push({ms:performance.now()-start,status:response.status,bytes:Buffer.byteLength(body)});
    }
    const sorted=rows.map(v=>v.ms).sort((a,b)=>a-b), result={name,url,samples,p50:sorted[Math.floor(samples*.5)],p95:sorted[Math.min(samples-1,Math.ceil(samples*.95)-1)],bytes:rows.at(-1).bytes,statuses:[...new Set(rows.map(v=>v.status))]};
    report.metrics.push({...result,raw:rows});console.log(JSON.stringify(result));
  }
  await measure('all rankings','/api/rankings?venue=all',tails?50:15);
  await measure('one venue','/api/rankings?venue=venue-escoffier',tails?50:15);
  await measure('small dish detail','/api/dishes/bench-dish-1',tails?50:15);
  if(!tails){
  await measure('hot dish detail','/api/dishes/bench-hot',5);
  await measure('rankings HTML','/rankings?venue=all',5);
  await measure('home HTML','/?venue=all',5);
  await measure('duplicate hot vote','/api/dishes/bench-hot/vote',5,{method:'POST',headers:{origin,cookie:`crous_session=${token}`,'content-type':'application/json'},body:JSON.stringify({targetTier:2})});
  }
  report.sourceHashes=Object.fromEntries(['lib/ranking-service.ts','lib/ranking.ts','lib/vote-service.ts'].map(file=>[file,createHash('sha256').update(readFileSync(path.join(root,file))).digest('hex')]));
}finally{
  mkdirSync(path.join(root,'.sites-runtime/benchmarks'),{recursive:true});
  writeFileSync(path.join(root,` .sites-runtime/benchmarks/http-${label}-${count}${tails?'-tails':''}.json`.trim()),JSON.stringify(report,null,2)+'\n');
  child.kill();
}
