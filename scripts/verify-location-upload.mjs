import assert from 'node:assert/strict';
import { request as nodeRequest } from 'node:http';
import { pathToFileURL } from 'node:url';

const origin = 'http://127.0.0.1:8794';
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const http = {
    async call(url, init = {}) {
      const jar = (await context.cookies()).map(c => c.name + '=' + c.value).join('; ');
      const headers = { connection: 'close', ...(jar ? { cookie: jar } : {}), ...init.headers };
      let body = init.data;
      if (body !== undefined && typeof body !== 'string') { body = JSON.stringify(body); headers['content-type'] = 'application/json'; }
      const send = () => new Promise((resolve,reject)=> {
        const req=nodeRequest(url,{method:init.method || 'GET',headers:{...headers,...(body !== undefined ? {'content-length':Buffer.byteLength(body)} : {})},agent:false}, res=> { let text=''; res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:new Headers(res.headers),text})); });
        req.on('error',reject);req.setTimeout(10000,()=>req.destroy(new Error('Timeout '+url)));req.end(body);
      });
      let response; try { response = await send(); } catch(error) { if(init.method && init.method !== 'GET') throw error; console.log('Retrying local read after cold-route timeout:',new URL(url).pathname); response=await send(); } let text=response.text;
      if(response.status===503 && text.includes('worker restarted')) {response=await send();text=response.text;}
      const cookie = response.headers.get('set-cookie');
      if (cookie) { const first = cookie.split(';')[0]; const i = first.indexOf('='); await context.addCookies([{name:first.slice(0,i),value:first.slice(i+1),url:origin}]); }
      return {status:()=>response.status,headers:()=>Object.fromEntries(response.headers),text:async()=>text,json:async()=>JSON.parse(text)};
    },
    get(url) { return this.call(url); },
    post(url, init) { return this.call(url, {...init,method:'POST'}); }
  };
  const post = async (path, data) => { const response = await http.post(origin + path, { data, headers: { origin } }); if (response.status() === 503 && (await response.text()).includes("worker restarted")) return http.post(origin + path, { data, headers: { origin } }); return response; };
  const protectedPosts = ['/api/uploads','/api/ai/identify','/api/dishes/no-dish/vote','/api/dishes/no-dish/names','/api/dishes/no-dish/names/no-name/endorse','/api/reports','/api/admin/actions'];
  for (const path of protectedPosts) assert.equal((await post(path, {})).status(), 401, path);
  assert.equal((await http.get(origin + '/api/admin/queue')).status(),401);
  for (const path of [...protectedPosts, '/api/auth/email/request','/api/auth/email/verify','/api/auth/logout']) assert.equal((await http.post(origin+path,{data:{},headers:{origin:'https://example.invalid'}})).status(),403,path);
  for (const path of ['/api/auth/email/request','/api/auth/email/verify']) for (const data of ['null','[]','"string"']) assert.equal((await http.post(origin+path,{data,headers:{origin,'content-type':'application/json'}})).status(),400,path);
  assert.equal((await http.get(origin+'/api/dishes/no-dish')).status(),404);
  assert.equal((await http.get(origin+'/api/photos/no-photo')).status(),404);
  assert.equal((await http.get(origin+'/api/name-suggestions?dishId=no-dish')).status(),404);
  assert.equal((await http.get(origin+'/api/name-suggestions')).status(),400);
  assert.equal((await http.get(origin+'/api/dishes/candidates?category=bad')).status(),400);
  assert.equal((await http.get(origin+'/api/rankings?venue=invalid')).status(),400);
  const page = await context.newPage(); const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/upload');
  assert.equal(await page.locator('input[type=file]').count(),0,'Login precedes uploading');
  await page.addInitScript(()=> { navigator.geolocation.getCurrentPosition=ok=>ok({coords:{latitude:48.7128,longitude:2.2051,accuracy:20}}); });
  async function login(email) { const challenge=await (await post('/api/auth/email/request',{email})).json(); assert.ok(challenge.data?.devCode,JSON.stringify(challenge)); assert.equal((await post('/api/auth/email/verify',{email,challengeId:challenge.data.challengeId,code:challenge.data.devCode})).status(),200); }
  await login(`location-${Date.now()}@example.invalid`);
  assert.equal((await post('/api/admin/actions',{action:'hide_meal',mealId:'missing'})).status(),403);
  assert.equal((await http.get(origin+'/api/admin/queue')).status(),403);
  for (const path of ['/api/dishes/no-dish/vote','/api/dishes/no-dish/names','/api/reports']) assert.equal((await http.post(origin+path,{data:'null',headers:{origin,'content-type':'application/json'}})).status(),400,path);
  await page.reload({waitUntil:'networkidle'});
  await page.getByRole('button',{name:'使用以上附近餐厅',exact:true}).waitFor();
  assert.equal(await page.locator('input[type=file]').count(),0,'Location confirmation precedes photo');
  const beforeSelection = page.url();
  let navigations = 0; page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  for (const name of ['今日开庭', '长期榜单']) await page.getByRole('link',{name,exact:true}).click();
  assert.equal(page.url(), beforeSelection);
  assert.equal(navigations, 0, 'Missing venue cannot start a navigation loop');
  await page.getByRole('alert').filter({hasText:'请先选择案发地点'}).waitFor();
  await page.getByRole('button',{name:'使用以上附近餐厅',exact:true}).click();
  assert.equal(await page.getByRole('alert').filter({hasText:'请先选择案发地点'}).count(),0);
  const ids=await page.locator('select[name=venueId] option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean));
  assert.equal(ids.length,4,'RU and cafes are separate official venues');
  assert.ok(ids.every(id=>!id.startsWith('venue-')));
  assert.equal(await page.locator('select[name=venueId]').inputValue(),'');
  assert.equal(/🏫|🏠/.test(await page.locator('select[name=venueId]').innerText()),false);
  await page.locator('select[name=venueId]').selectOption(ids[0]);
  await page.locator('input[type=file]').setInputFiles('.sites-runtime/upload-fixtures/oversized-48MiB.png');
  await page.getByRole('alert').filter({hasText:'原图不能超过 12 MB'}).waitFor();
  await page.locator('input[type=file]').setInputFiles('public/meals/couscous.jpg');
  await page.locator('img[alt="已清理元数据的餐盘预览"]').waitFor();
  await page.locator('input[name=mainName]').fill('地点归属验收菜');
  await page.getByRole('button',{name:'切换地点',exact:true}).click();
  await page.getByRole('button',{name:'+ 自己输入',exact:true}).click();
  await page.getByLabel('餐厅名称或城市').fill('Coulée');
  await page.getByRole('button',{name:/Brasserie La Coulée Verte/}).click();
  assert.equal(await page.getByRole('link',{name:'长期榜单',exact:true}).getAttribute('href'),'/rankings?venue=brasserie-la-coulee-verte-2','Navigation follows replaceState after changing upload scope');
  assert.equal(await page.locator('select[name=venueId]').inputValue(),'','Changing scope clears old venue');
  assert.equal(await page.locator('input[name=mainName]').inputValue(),'地点归属验收菜','Draft remains');
  await page.locator('select[name=venueId]').selectOption('brasserie-la-coulee-verte-2');
  await page.getByRole('checkbox').check();
  const responsePromise=page.waitForResponse(r=>r.url().endsWith('/api/uploads') && r.request().method()==='POST');
  await page.getByRole('button',{name:'发布并立案',exact:true}).click();
  const published=await responsePromise; assert.equal(published.status(),201,await published.text()); const meal=(await published.json()).data;
  await page.getByRole('heading',{name:'证物已入库',exact:true}).waitFor();
  const photo=await http.get(origin+'/api/photos/'+meal.photoId); assert.equal(photo.status(),200); assert.equal(photo.headers()['cache-control'],'no-store');
  const result=await (await http.get(origin+'/api/rankings?venue=brasserie-la-coulee-verte-2')).json();
  const dish=result.data.find(d=>d.originalDescription==='地点归属验收菜'); assert.ok(dish); assert.equal(dish.votes,1); assert.equal(dish.venue,'Brasserie La Coulée Verte');
  assert.equal((await post('/api/dishes/'+dish.id+'/vote',{targetTier:5})).status(),409);
  assert.equal((await post('/api/dishes/'+dish.id+'/names',{name:'验收新名',evidenceType:'ate_today'})).status(),201);
  assert.equal((await post('/api/dishes/'+dish.id+'/names/not-found/endorse',{})).status(),404);
  assert.equal((await post('/api/reports',{dishId:dish.id,reason:'wrong_dish'})).status(),201);
  await page.goto(origin+'/rankings',{waitUntil:'networkidle'});
  assert.ok((await page.locator('header summary').innerText()).includes('Coulée'),'Preference follows to rankings');
  // A shared URL must win over another saved venue, including a trip through dish details.
  await context.addCookies([{name:'crous-venues',value:ids[0],url:origin}]);
  await page.goto(origin+'/upload?venue=brasserie-la-coulee-verte-2',{waitUntil:'networkidle'});
  assert.deepEqual(await page.locator('select[name=venueId] option').evaluateAll(nodes=>nodes.map(n=>n.value).filter(Boolean)),['brasserie-la-coulee-verte-2']);
  await page.getByRole('link',{name:'长期榜单',exact:true}).click();
  await page.waitForURL('**/rankings?venue=brasserie-la-coulee-verte-2');
  await page.locator(`a[data-ranking-card][href="/dish/${dish.id}?venue=brasserie-la-coulee-verte-2"]`).click();
  await page.waitForURL(`**/dish/${dish.id}?venue=brasserie-la-coulee-verte-2`);
  await page.getByRole('link',{name:'长期榜单',exact:true}).click();
  await page.waitForURL('**/rankings?venue=brasserie-la-coulee-verte-2');
  assert.ok((await page.locator('header summary').innerText()).includes('Coulée'));
  await page.getByRole('link',{name:'查看 CROUS法庭的故事',exact:true}).click();
  await page.waitForURL('**/story?venue=brasserie-la-coulee-verte-2');
  await page.getByRole('link',{name:/去长期榜单旁听/}).click();
  await page.waitForURL('**/rankings?venue=brasserie-la-coulee-verte-2');
  await context.clearCookies({name:'crous-venues'});
  await page.goto(origin+'/upload?venue=brasserie-la-coulee-verte-2',{waitUntil:'networkidle'});
  await page.getByRole('link',{name:'长期榜单',exact:true}).click();
  await page.waitForURL('**/rankings?venue=brasserie-la-coulee-verte-2');
  assert.equal(await page.locator('[data-venue-required="true"]').count(),0,'Explicit selection works without a cookie');
  await context.addCookies([{name:'crous-venues',value:'brasserie-la-coulee-verte-2',url:origin}]);
  await context.addCookies([{name:'crous-locale',value:'en',url:origin}]);
  await page.goto(origin+'/upload',{waitUntil:'networkidle'});
  assert.equal(await page.locator('select[name=venueId] option').count(),2);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.screenshot({path:'.sites-runtime/review-20260915/upload-venues-mobile.png',fullPage:true});
  await login('review-admin@example.invalid');
  assert.equal((await http.get(origin+'/api/admin/queue')).status(),200);
  assert.equal((await post('/api/admin/actions',{action:'hide_meal',mealId:meal.mealId})).status(),200);
  assert.equal((await http.get(origin+'/api/photos/'+meal.photoId)).status(),404);
  assert.equal((await http.get(origin+'/api/dishes/'+dish.id)).status(),404);
  assert.equal((await http.get(origin+'/api/name-suggestions?dishId='+dish.id)).status(),404);
  const candidates=await (await http.get(origin+'/api/dishes/candidates?category=main&q='+encodeURIComponent('地点归属验收菜'))).json(); assert.deepEqual(candidates.data,[]);
  assert.equal((await post('/api/auth/logout',{})).status(),200);
  assert.equal((await http.get(origin+'/api/admin/queue')).status(),401);
  assert.deepEqual(errors,[]);
  console.log('PASS: all 16 route boundaries; login/location/photo sequence; four nearby official venues; manual search; draft preservation; upload persistence and vote; cookie/English/mobile; moderation visibility.');
} finally { await browser.close(); }
