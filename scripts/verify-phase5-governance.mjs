import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanCanvasJpeg } from "../lib/upload/canvas-jpeg.ts";
import { verifyAiMergeReview } from "./verify-ai-merge-review.mjs";
import { verifySplitVotes } from "./verify-split-votes.mjs";
import { verifyEnglishNames } from "./verify-english-names.mjs";
import { verifyAdminDishSearch } from "./verify-admin-dish-search.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const persist = path.join(root, ".sites-runtime", "phase5-governance-verification");
const wrangler = path.join(root, "node_modules", "wrangler", "wrangler-dist", "cli.js");
const config = path.join(root, "dist", "server", "wrangler.json");
const origin = "http://127.0.0.1:8793";
const secret = "phase5-governance-verification-secret-at-least-32-chars";
let modelCalls = 0;
let mergeCalls = 0;
const mergeInputs = [];
const fakeAi = createServer(async (_request, response) => {
  let raw = ""; for await (const chunk of _request) raw += chunk;
  const body = JSON.parse(raw);
  if (body.response_format?.json_schema?.name === "crous_merge_review") {
    mergeCalls += 1;
    const ids = new Set(JSON.parse(body.messages[1].content).dishes.map((d) => d.id));
    mergeInputs.push(ids);
    const pairs = [["merge-a", "merge-b"], ["merge-c", "merge-d"]].filter(([a, b]) => ids.has(a) && ids.has(b)).map(([sourceId, targetId]) => ({ sourceId, targetId, reason: "名称语义相近", uncertainty: "需要人工核对照片" }));
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(mergeCalls === 1 ? { pairs: [{ ...pairs[0], targetId: "invented" }] } : { pairs }) } }] }));
    return;
  }
  modelCalls += 1;
  const content = modelCalls === 1 ? JSON.stringify({ is_food_image: true }) : JSON.stringify({ analysis_status: "identified", is_food_image: true, is_standard_meal: false, staple: { name: "粗麦粉配肉丸", confidence: 0.82, region: { x: 0.12, y: 0.2, width: 0.58, height: 0.64 } }, side_dishes: [{ name: "原味酸奶", type: "酸奶", ingredients: [], confidence: 0.78, region: { x: 0.74, y: 0.16, width: 0.18, height: 0.22 } }], other_visible_items: [], warnings: [], scene_description: "餐盘中有粗麦粉配肉丸和一杯酸奶。" });
  response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ choices: [{ message: { content } }] }));
});
await new Promise((resolve) => fakeAi.listen(8796, "127.0.0.1", resolve));

function run(args) { const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: "utf8" }); assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout; }
async function request(url, method = "GET", body, cookie) {
  const init = { method, headers: { origin, connection: "close", ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10_000) };
  try { const response = await fetch(`${origin}${url}`, init); if (response.status === 503 && (await response.clone().text()).includes("worker restarted")) return fetch(`${origin}${url}`, { ...init, signal: AbortSignal.timeout(10_000) }); return response; }
  catch (error) {
    // Local D1 CLI fixture writes can restart workerd; only read requests are safe to retry.
    if (method === "GET" && error instanceof TypeError) return fetch(`${origin}${url}`, { ...init, signal: AbortSignal.timeout(10_000) });
    throw new Error(`${method} ${url} failed: ${error instanceof Error ? error.message : error}\n${output.slice(-4000)}`);
  }
}
async function login(email) { const requested = await request("/api/auth/email/request", "POST", { email }); const challenge = await requested.json(); assert.equal(requested.status, 200, JSON.stringify(challenge)); const verified = await request("/api/auth/email/verify", "POST", { email, challengeId: challenge.data.challengeId, code: challenge.data.devCode }); assert.equal(verified.status, 200); return verified.headers.get("set-cookie").split(";")[0]; }

await rm(persist, { recursive: true, force: true });
run(["d1", "migrations", "apply", "DB", "--local", "--persist-to", persist, "--config", config]);
run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--file", path.join(root, "db", "fixtures.sql"), "--yes"]);
const child = spawn(process.execPath, [wrangler, "dev", "--config", config, "--local", "--persist-to", persist, "--ip", "127.0.0.1", "--port", "8793", "--inspector-port", "0", "--var", "AUTH_MODE:local", "--var", `AUTH_HMAC_SECRET:${secret}`, "--var", "ADMIN_EMAILS:admin@example.invalid", "--var", "AI_BASE_URL:http://127.0.0.1:8796/v1", "--var", "AI_API_KEY:test-only", "--var", "AI_MODEL:test-vision"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let output = ""; child.stdout.on("data", (chunk) => output += chunk); child.stderr.on("data", (chunk) => output += chunk);
await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error(`Worker did not start\n${output.slice(-4000)}`)), 20_000); const ready = (chunk) => { if (String(chunk).includes("Ready on")) { clearTimeout(timeout); resolve(); } }; child.stdout.on("data", ready); child.stderr.on("data", ready); });

try {
  const anonymous = await request("/api/dishes/mystery-dessert/names", "POST", { name: "Crème dessert", evidenceType: "ate_today" }); assert.equal(anonymous.status, 401); await anonymous.text();
  const [one, two, three, admin] = await Promise.all([login("one@example.invalid"), login("two@example.invalid"), login("three@example.invalid"), login("admin@example.invalid")]);
  const image = await readFile(path.join(root, "public", "meals", "couscous.jpg"));
  const secondImage = await readFile(path.join(root, "public", "meals", "lentilles-saucisse.jpg"));
  const thirdImage = await readFile(path.join(root, "public", "meals", "poulet-haricots.jpg"));
  async function upload(cookie, bytes = image, name = "测试主食", dishId = "") { const form = new FormData(); for (const [key, value] of Object.entries({ venueId: "venue-escoffier", eatenOn: "2026-09-11", mainName: name, mainDishId: dishId, mainTier: "3", rightsConfirmed: "true" })) form.set(key, value); form.set("canonical", new Blob([bytes], { type: "image/jpeg" }), "meal.jpg"); form.set("thumbnail", new Blob([bytes], { type: "image/jpeg" }), "thumb.jpg"); return fetch(`${origin}/api/uploads`, { method: "POST", headers: { origin, cookie }, body: form, signal: AbortSignal.timeout(10_000) }); }
  const firstUpload = await upload(one); assert.equal(firstUpload.status, 201, await firstUpload.text());
  const sameUserDuplicate = await upload(one); assert.equal(sameUserDuplicate.status, 400, await sameUserDuplicate.text());
  const otherUserSameFile = await upload(two); assert.equal(otherUserSameFile.status, 201, await otherUserSameFile.text());
  const firstSighting = await upload(one, secondImage, "Semoule vue par moi", "couscous-boulettes"); assert.equal(firstSighting.status, 201, await firstSighting.text());
  const secondSighting = await upload(one, thirdImage, "Couscous cette fois", "couscous-boulettes"); assert.equal(secondSighting.status, 201, await secondSighting.text());
  const initialCandidates = await request("/api/dishes/candidates?category=main&q=lentilles").then((response) => response.json());
  assert.equal(initialCandidates.data[0].id, "lentilles-saucisse");
  const proposed = await request("/api/dishes/mystery-dessert/names", "POST", { name: "Crème dessert", evidenceType: "ate_today" }, one);
  const proposal = await proposed.json(); assert.equal(proposed.status, 201, JSON.stringify(proposal));
  assert.equal(proposal.data.supporters, 0);
  const selfEndorsement = await request(`/api/dishes/mystery-dessert/names/${proposal.data.id}/endorse`, "POST", {}, one); assert.equal(selfEndorsement.status, 409); await selfEndorsement.text();
  const endorsedTwo = await request(`/api/dishes/mystery-dessert/names/${proposal.data.id}/endorse`, "POST", {}, two); assert.equal(endorsedTwo.status, 200); await endorsedTwo.text();
  const endorsedThree = await request(`/api/dishes/mystery-dessert/names/${proposal.data.id}/endorse`, "POST", {}, three); assert.equal(endorsedThree.status, 200); await endorsedThree.text();
  const endorsedAdmin = await request(`/api/dishes/mystery-dessert/names/${proposal.data.id}/endorse`, "POST", {}, admin); assert.equal(endorsedAdmin.status, 200); await endorsedAdmin.text();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const reported = await request("/api/reports", "POST", { dishId: "mystery-dessert", reason: "wrong_dish", details: "名称可能不对" }, one);
  const report = await reported.json(); assert.equal(reported.status, 201, JSON.stringify(report));
  for (let attempt = 1; attempt < 10; attempt += 1) {
    const accepted = await request("/api/reports", "POST", { dishId: "mystery-dessert", reason: "wrong_dish" }, one);
    assert.equal(accepted.status, 201, await accepted.text());
  }
  const throttled = await request("/api/reports", "POST", { dishId: "mystery-dessert", reason: "wrong_dish" }, one);
  assert.equal(throttled.status, 429, await throttled.text());
  const denied = await request("/api/admin/actions", "POST", { action: "resolve_report", reportId: report.data.id }, one); assert.equal(denied.status, 403); await denied.text();
  const verifiedName = await request("/api/admin/actions", "POST", { action: "verify_name", suggestionId: proposal.data.id, language: "fr" }, admin); assert.equal(verifiedName.status, 200, await verifiedName.text());
  const resolvedReport = await request("/api/admin/actions", "POST", { action: "resolve_report", reportId: report.data.id }, admin); assert.equal(resolvedReport.status, 200, await resolvedReport.text());

  const merged = await request("/api/admin/actions", "POST", { action: "merge_dish", sourceDishId: "lentilles-saucisse", targetDishId: "couscous-boulettes" }, admin);
  assert.equal(merged.status, 200, await merged.text());
  const split = await request("/api/admin/actions", "POST", { action: "split_serving", servingId: "fixture-serving-01", name: "重新立案的主食" }, admin);
  const splitBody = await split.json();
  assert.equal(split.status, 200, JSON.stringify(splitBody));
  const splitDetail = await request(`/api/dishes/${splitBody.data.dishId}`).then((r) => r.json());
  assert.equal(splitDetail.data.votes, 1, "split must retain the serving creator's initial vote");

  for (const [bytes, code] of [[new Uint8Array(), "IMAGE_EMPTY"], [Uint8Array.from([255,216,255,225,0,2,255,217]), "JPEG_APP1_METADATA"]]) {
    const invalidForm = new FormData(); invalidForm.set("image", new Blob([bytes], { type: "image/jpeg" }), "photo.jpg");
    const invalid = await fetch(`${origin}/api/ai/identify`, { method: "POST", headers: { origin, cookie: one }, body: invalidForm });
    const diagnostic = await invalid.json();
    assert.equal(invalid.status, 400); assert.equal(diagnostic.code, code);
    assert.match(diagnostic.requestId, /^[0-9a-f-]{36}$/);
    assert.notEqual(diagnostic.error, "识别图片无效");
    assert.equal(modelCalls, 0, "invalid images must not reach the AI provider");
  }
  const app1 = Uint8Array.from([255,225,0,8,69,120,105,102,0,0]);
  const safariEncoded = new Blob([image.subarray(0, 2), app1, image.subarray(2)], { type: "image/jpeg" });
  const cleaned = await cleanCanvasJpeg(safariEncoded);
  assert.deepEqual(Buffer.from(await cleaned.arrayBuffer()), image);
  const aiForm = new FormData(); aiForm.set("image", cleaned);
  const ai = await fetch(`${origin}/api/ai/identify`, { method: "POST", headers: { origin, cookie: one }, body: aiForm });
  const aiResult = await ai.json(); assert.equal(ai.status, 200, JSON.stringify(aiResult)); assert.equal(aiResult.data.staple.name, "粗麦粉配肉丸"); assert.deepEqual(aiResult.data.staple.region, { x: 0.12, y: 0.2, width: 0.58, height: 0.64 }); assert.equal(modelCalls, 2);
  await verifyAiMergeReview({ request, admin, ordinary: one, sql: (command, json = false) => {
    const output = run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--command", command, ...(json ? ["--json"] : [])]);
    return json ? JSON.parse(output) : output;
  } });
  await verifySplitVotes({ request, admin, ordinary: one, sql: (command, json = false) => {
    const output = run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--command", command, ...(json ? ["--json"] : [])]);
    return json ? JSON.parse(output) : output;
  } });
  await verifyEnglishNames({ request, admin, ordinary: one, sql: (command, json = false) => {
    const result = run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--command", command, ...(json ? ["--json"] : [])]);
    return json ? JSON.parse(result) : result;
  } });
  await verifyAdminDishSearch({ request, admin, ordinary: one, sql: (command) => run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--command", command]) });
  assert.ok(mergeInputs.length > 0 && mergeInputs.every(ids=>!ids.has('merge-empty')), 'empty dishes must never reach the AI prompt');
} finally {
  child.kill();
  await Promise.race([new Promise((resolve) => child.once("exit", resolve)), new Promise((resolve) => setTimeout(resolve, 3_000))]);
  child.stdout.destroy(); child.stderr.destroy(); child.unref();
  await new Promise((resolve) => fakeAi.close(resolve));
}

const verified = JSON.parse(run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--command", "SELECT naming_status,canonical_name_fr,original_description FROM dishes WHERE id='mystery-dessert'; SELECT COUNT(*) count FROM moderation_actions; SELECT COUNT(*) count FROM votes GROUP BY dish_id,user_id HAVING count > 1; SELECT merged_into_dish_id FROM dishes WHERE id='lentilles-saucisse'; SELECT status,(SELECT COUNT(*) FROM name_endorsements WHERE suggestion_id=name_suggestions.id) supporters FROM name_suggestions WHERE dish_id='mystery-dessert'; SELECT dish_id FROM dish_aliases WHERE normalized_name='crème dessert'; SELECT attempts FROM ai_rate_limits; SELECT COUNT(*) count FROM ai_identifications; SELECT original_description FROM servings WHERE original_description IN ('Semoule vue par moi','Couscous cette fois') ORDER BY original_description; SELECT COUNT(*) count FROM votes v JOIN users u ON u.id=v.user_id WHERE v.dish_id='couscous-boulettes' AND u.email_digest IS NOT NULL; SELECT attempts FROM governance_rate_limits WHERE action='report'", "--json"]));
assert.deepEqual(verified[0].results, [{ naming_status: "verified", canonical_name_fr: "Crème dessert", original_description: "巧克力？慕斯？案情复杂" }]);
assert.ok(verified[1].results[0].count >= 4); assert.deepEqual(verified[2].results, []); assert.equal(verified[3].results[0].merged_into_dish_id, "couscous-boulettes");
assert.deepEqual(verified[4].results, [{ status: "verified", supporters: 3 }]); assert.deepEqual(verified[5].results, [{ dish_id: "mystery-dessert" }]);
assert.deepEqual(verified[6].results, [{ attempts: 1 }]); assert.deepEqual(verified[7].results, [{ count: 1 }]);
assert.deepEqual(verified[8].results, [{ original_description: "Couscous cette fois" }, { original_description: "Semoule vue par moi" }]); assert.equal(verified[9].results[0].count, 1);
assert.deepEqual(verified[10].results, [{ attempts: 10 }]);
console.log("Phase 5 governance verification passed: per-user duplicate hashing, repeat Dish sightings, community naming, alias search, rate-limited reports, admin allowlist, audited merge/split, and strict AI retry/cache.");
