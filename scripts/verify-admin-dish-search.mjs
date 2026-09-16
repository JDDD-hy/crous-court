import assert from "node:assert/strict";

export async function verifyAdminDishSearch({ request, admin, ordinary, sql }) {
  assert.equal((await request('/api/admin/dishes')).status,401);
  assert.equal((await request('/api/admin/dishes','GET',undefined,ordinary)).status,403);
  const read = async (query='',offset=0) => {
    const response = await request(`/api/admin/dishes?${new URLSearchParams({q:query,offset:String(offset)})}`,'GET',undefined,admin);
    assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
    return (await response.json()).data;
  };
  const dish = (await read('couscous-boulettes')).items.find(d=>d.id==='couscous-boulettes');
  assert.ok(dish.visible); assert.ok(dish.votes>0); assert.ok(dish.servings>0);
  const old = (await read('lentilles-saucisse')).items.find(d=>d.id==='lentilles-saucisse');
  assert.equal(old.merged_into_dish_id,'couscous-boulettes');
  sql(`INSERT INTO dishes(id,original_description,category,canonical_name_en) VALUES
    ('lookup-alpha','碎肉、土豆和蔬菜混合主餐','main','Minced meat with vegetables'),
    ('lookup-beta','肉条+土豆+花菜胡萝卜丝','main',NULL);
    INSERT INTO dish_aliases(id,dish_id,name,normalized_name,source) VALUES
    ('lookup-alias','lookup-alpha','肉末100%_','肉末100%_','admin');
    INSERT INTO dishes(id,original_description,category) VALUES ${Array.from({length:27},(_,i)=>`('page-${String(i).padStart(2,'0')}','分页查询测试','side')`).join(',')};`);
  for(const q of ['碎肉','MINCED MEAT','肉末100%_','lookup-alpha']) {
    assert.deepEqual((await read(q)).items.map(d=>d.id),['lookup-alpha']);
  }
  assert.deepEqual((await read('肉条+土豆+花菜胡萝卜丝')).items.map(d=>d.id),['lookup-beta']);
  assert.deepEqual((await read("' OR 1=1 --")).items,[]);
  const first=await read('分页查询测试'); const second=await read('分页查询测试',first.nextOffset);
  assert.equal(first.items.length,25); assert.equal(second.items.length,2); assert.equal(second.nextOffset,null);
  assert.equal(new Set([...first.items,...second.items].map(d=>d.id)).size,27);
  for(const params of ['offset=-1','offset=NaN','offset=0.5',`q=${'x'.repeat(161)}`]) {
    assert.equal((await request(`/api/admin/dishes?${params}`,'GET',undefined,admin)).status,400);
  }
  assert.ok((await read()).items.length>0);
  console.log('Admin dish lookup passed: admin-only access, names/aliases/IDs, literal symbols, merged status, counts, pagination, invalid input and private cache.');
}
