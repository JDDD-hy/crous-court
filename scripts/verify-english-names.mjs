import assert from "node:assert/strict";
import { dishPresentation } from "../lib/i18n/dish-presentation.ts";

// Runs inside verify-phase5-governance.mjs's disposable local D1 and Worker.
export async function verifyEnglishNames({ request, admin, ordinary, sql }) {
  sql(`INSERT INTO dishes(id,canonical_name_fr,canonical_name_zh,original_description,category,naming_status) VALUES
    ('locale-name-source','Crème vanille','香草布丁','投稿保留 Vanilla user name','main','verified');
    INSERT INTO dishes(id,canonical_name_fr,canonical_name_en,original_description,category,naming_status) VALUES
    ('locale-name-target','Flan nature','Target custard','Target original name','main','verified');
    INSERT INTO meals(id,venue_id,creator_id,eaten_on,case_number,display_order) VALUES
    ('locale-name-meal','venue-escoffier','fixture-user-01','2026-09-08','20260908-0-901',901);
    INSERT INTO servings(id,dish_id,venue_id,served_on,creator_id,original_description,initial_tier) VALUES
    ('locale-name-serving','locale-name-source','venue-escoffier','2026-09-08','fixture-user-01','投稿保留 Vanilla user name',3);
    INSERT INTO meal_items(meal_id,serving_id,slot) VALUES ('locale-name-meal','locale-name-serving','main');`);
  const proposed = await request("/api/dishes/locale-name-source/names", "POST", { name: "Vanilla review pudding", evidenceType: "menu_photo" }, ordinary);
  const proposal = await proposed.json();
  assert.equal(proposed.status, 201, JSON.stringify(proposal));
  const action = { action: "verify_name", suggestionId: proposal.data.id, language: "en" };
  const denied = await request("/api/admin/actions", "POST", action, ordinary);
  assert.equal(denied.status, 403); await denied.text();
  const invalid = await request("/api/admin/actions", "POST", { ...action, language: "en; DROP TABLE dishes" }, admin);
  assert.equal(invalid.status, 400); await invalid.text();
  const confirmed = await request("/api/admin/actions", "POST", action, admin);
  assert.equal(confirmed.status, 200, await confirmed.text());

  const stored = sql("SELECT canonical_name_en,canonical_name_fr,canonical_name_zh,original_description FROM dishes WHERE id='locale-name-source'; SELECT name,language FROM dish_aliases WHERE dish_id='locale-name-source' AND normalized_name='vanilla review pudding'; SELECT original_description FROM servings WHERE id='locale-name-serving';", true);
  assert.deepEqual(stored[0].results, [{ canonical_name_en: "Vanilla review pudding", canonical_name_fr: "Crème vanille", canonical_name_zh: "香草布丁", original_description: "投稿保留 Vanilla user name" }]);
  assert.deepEqual(stored[1].results, [{ name: "Vanilla review pudding", language: "en" }]);
  assert.deepEqual(stored[2].results, [{ original_description: "投稿保留 Vanilla user name" }]);

  for (const locale of ["zh", "en"]) {
    const cookie = `${admin}; crous-locale=${locale}`;
    const detailResponse = await request("/api/dishes/locale-name-source", "GET", undefined, cookie);
    const detail = await detailResponse.json();
    assert.equal(detailResponse.status, 200, JSON.stringify(detail));
    assert.equal(detail.data.canonicalNameFr, "Crème vanille");
    assert.equal(detail.data.originalDescription, "投稿保留 Vanilla user name");
    assert.equal(detail.data.servings[0].originalDescription, "投稿保留 Vanilla user name");
    const expected = locale === "zh" ? "香草布丁" : "Vanilla review pudding";
    assert.deepEqual(dishPresentation(detail.data, locale), { primary: expected, secondary: null, card: expected });
    const candidates = await request("/api/dishes/candidates?category=main&q=Vanilla%20review", "GET", undefined, cookie).then(r => r.json());
    assert.ok(candidates.data.some(dish => dish.id === "locale-name-source" && dish.name === expected));
  }

  const merged = await request("/api/admin/actions", "POST", { action: "merge_dish", sourceDishId: "locale-name-source", targetDishId: "locale-name-target" }, admin);
  assert.equal(merged.status, 200, await merged.text());
  const afterMerge = sql("SELECT canonical_name_en,canonical_name_fr,original_description FROM dishes WHERE id='locale-name-target'; SELECT name,language FROM dish_aliases WHERE dish_id='locale-name-target' AND normalized_name='vanilla review pudding';", true);
  assert.deepEqual(afterMerge[0].results, [{ canonical_name_en: "Target custard", canonical_name_fr: "Flan nature", original_description: "Target original name" }]);
  assert.deepEqual(afterMerge[1].results, [{ name: "Vanilla review pudding", language: "en" }]);
  const matches = await request("/api/dishes/candidates?category=main&q=Vanilla%20review", "GET", undefined, `${admin}; crous-locale=en`).then(r => r.json());
  assert.ok(matches.data.some(dish => dish.id === "locale-name-target" && dish.name === "Target custard"));
  assert.ok(matches.data.every(dish => dish.id !== "locale-name-source"));
  console.log("English names passed: authorized confirmation, language validation, French/Chinese/original preservation, locale presentation, candidate search and merged English aliases.");
}
