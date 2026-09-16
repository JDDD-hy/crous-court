import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const persist = path.join(root, ".sites-runtime", "phase3-auth-verification");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const config = path.join(root, "dist", "server", "wrangler.json");
const origin = "http://127.0.0.1:8791";
const secret = "phase3-auth-verification-secret-at-least-32-characters";

function run(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}

await rm(persist, { recursive: true, force: true });
run(["d1", "migrations", "apply", "DB", "--local", "--persist-to", persist, "--config", config]);
run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--file", path.join(root, "db", "fixtures.sql"), "--yes"]);

const child = spawn(process.execPath, [wrangler, "dev", "--config", config, "--local", "--persist-to", persist, "--ip", "127.0.0.1", "--port", "8791", "--inspector-port", "0", "--var", "AUTH_MODE:local", "--var", `AUTH_HMAC_SECRET:${secret}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
child.stdout.on("data", (chunk) => output += chunk);
child.stderr.on("data", (chunk) => output += chunk);

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Worker did not start\n${output.slice(-4000)}`)), 20_000);
  const check = (chunk) => { if (String(chunk).includes("Ready on")) { clearTimeout(timeout); resolve(); } };
  child.stdout.on("data", check); child.stderr.on("data", check);
});

async function post(url, body, cookie, requestOrigin = origin) {
  return fetch(`${origin}${url}`, { method: "POST", headers: { origin: requestOrigin, "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}

let sessionCookie = "";
let code = "";
try {
  const anonymous = await fetch(`${origin}/api/uploads`, { method: "POST", headers: { origin } });
  assert.equal(anonymous.status, 401);

  const requested = await post("/api/auth/email/request", { email: "auth-test@example.invalid" });
  assert.equal(requested.status, 200);
  const requestPayload = await requested.json();
  assert.match(requestPayload.data.devCode, /^\d{6}$/);
  code = requestPayload.data.devCode;
  const throttled = await post("/api/auth/email/request", { email: "auth-test@example.invalid" });
  assert.equal(throttled.status, 429);
  const parallelRequests = await Promise.all(Array.from({ length: 4 }, () => post("/api/auth/email/request", { email: "parallel-request@example.invalid" })));
  assert.equal(parallelRequests.filter((response) => response.status === 200).length, 1);
  assert.ok(parallelRequests.filter((response) => response.status === 429).length === 3);

  const wrongCode = code === "999999" ? "000000" : "999999";
  const wrong = await post("/api/auth/email/verify", { email: "auth-test@example.invalid", challengeId: requestPayload.data.challengeId, code: wrongCode });
  assert.equal(wrong.status, 400);
  const verified = await post("/api/auth/email/verify", { email: "auth-test@example.invalid", challengeId: requestPayload.data.challengeId, code });
  assert.equal(verified.status, 200);
  sessionCookie = verified.headers.get("set-cookie") ?? "";
  assert.match(sessionCookie, /^crous_session=.+HttpOnly; SameSite=Lax$/);

  const replay = await post("/api/auth/email/verify", { email: "auth-test@example.invalid", challengeId: requestPayload.data.challengeId, code });
  assert.equal(replay.status, 400);
  const limitedRequest = await post("/api/auth/email/request", { email: "attempt-limit@example.invalid" });
  const limitedPayload = await limitedRequest.json();
  for (let attempt = 0; attempt < 5; attempt++) {
    const limitedWrongCode = limitedPayload.data.devCode === "999999" ? "000000" : "999999";
    const rejected = await post("/api/auth/email/verify", { email: "attempt-limit@example.invalid", challengeId: limitedPayload.data.challengeId, code: limitedWrongCode });
    assert.equal(rejected.status, 400);
  }
  const blockedCorrectCode = await post("/api/auth/email/verify", { email: "attempt-limit@example.invalid", challengeId: limitedPayload.data.challengeId, code: limitedPayload.data.devCode });
  assert.equal(blockedCorrectCode.status, 400);
  const parallelAttemptRequest = await post("/api/auth/email/request", { email: "parallel-attempts@example.invalid" });
  const parallelAttemptPayload = await parallelAttemptRequest.json();
  const parallelWrongCode = parallelAttemptPayload.data.devCode === "999999" ? "000000" : "999999";
  const parallelAttempts = await Promise.all(Array.from({ length: 6 }, () => post("/api/auth/email/verify", { email: "parallel-attempts@example.invalid", challengeId: parallelAttemptPayload.data.challengeId, code: parallelWrongCode })));
  assert.ok(parallelAttempts.every((response) => response.status === 400));
  const parallelBlockedCorrect = await post("/api/auth/email/verify", { email: "parallel-attempts@example.invalid", challengeId: parallelAttemptPayload.data.challengeId, code: parallelAttemptPayload.data.devCode });
  assert.equal(parallelBlockedCorrect.status, 400);
  const rawCookie = sessionCookie.split(";")[0];
  for (const endpoint of ["/api/uploads", "/api/ai/identify"]) {
    async function* oversized() { for (let i = 0; i < 384; i++) yield Buffer.alloc(65536, 120); }
    const responses = await Promise.all(Array.from({ length: 6 }, () => fetch(`${origin}${endpoint}`, { method: "POST", headers: { origin, cookie: rawCookie, "content-type": "multipart/form-data; boundary=lengthless", connection: "close" }, body: oversized(), duplex: "half" })));
    assert.deepEqual(responses.map(response => response.status), [413, 413, 413, 413, 413, 413], endpoint);
    await Promise.allSettled(responses.map(response => response.arrayBuffer()));
  }
  console.log("Six concurrent lengthless oversized streams rejected with 413 on each upload and AI route.");
  const image = await readFile(path.join(root, "public", "meals", "couscous.jpg"));
  const invalidMultipart = await fetch(`${origin}/api/uploads`, { method: "POST", headers: { origin, cookie: rawCookie, "content-type": "application/json" }, body: "{}" });
  assert.equal(invalidMultipart.status, 415);
  const aiForm = new FormData();
  aiForm.set("image", new Blob([image], { type: "image/jpeg" }), "ai.jpg");
  const unconfiguredAi = await fetch(`${origin}/api/ai/identify`, { method: "POST", headers: { origin, cookie: rawCookie }, body: aiForm });
  assert.equal(unconfiguredAi.status, 503);
  const futureForm = new FormData();
  for (const [key, value] of Object.entries({ venueId: "venue-escoffier", eatenOn: "2999-01-01", mainName: "", mainTier: "3", rightsConfirmed: "true" })) futureForm.set(key, value);
  futureForm.set("canonical", new Blob([image], { type: "image/jpeg" }), "future.jpg");
  futureForm.set("thumbnail", new Blob([image], { type: "image/jpeg" }), "future-thumb.jpg");
  const futureUpload = await fetch(`${origin}/api/uploads`, { method: "POST", headers: { origin, cookie: rawCookie }, body: futureForm });
  assert.equal(futureUpload.status, 400);
  const upload = (index) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ venueId: "venue-escoffier", eatenOn: "2026-09-11", mainName: `并发测试 ${index}`, mainTier: "3", rightsConfirmed: "true" })) form.set(key, value);
    form.set("mainDishId", "");
    for (let side = 1; side <= 8; side++) {
      const prefix = side === 1 ? "sideOne" : side === 2 ? "sideTwo" : `side${side}`;
      form.set(`${prefix}DishId`, ""); form.set(`${prefix}Name`, `小菜 ${side}`); form.set(`${prefix}Tier`, String((side % 5) + 1));
    }
    const marker = Buffer.from([0xff, 0xee, 0x00, 0x04, index, 0]);
    const uniqueImage = Buffer.concat([image.subarray(0, 2), marker, image.subarray(2)]);
    form.set("canonical", new Blob([uniqueImage], { type: "image/jpeg" }), `meal-${index}.jpg`);
    form.set("thumbnail", new Blob([image], { type: "image/jpeg" }), "thumb.jpg");
    return fetch(`${origin}/api/uploads`, { method: "POST", headers: { origin, cookie: rawCookie }, body: form });
  };
  const parallelUploads = await Promise.all(Array.from({ length: 6 }, (_, index) => upload(index)));
  const uploadStatuses = parallelUploads.map((response) => response.status);
  assert.equal(parallelUploads.filter((response) => response.status === 201).length, 5, `${JSON.stringify(uploadStatuses)}\n${output.slice(-4000)}`);
  assert.equal(parallelUploads.filter((response) => response.status === 400).length, 1, `${JSON.stringify(uploadStatuses)}\n${output.slice(-4000)}`);
  const crossSite = await fetch(`${origin}/api/uploads`, { method: "POST", headers: { origin: "https://evil.example", cookie: rawCookie } });
  assert.equal(crossSite.status, 403);
  const logout = await post("/api/auth/logout", {}, rawCookie);
  assert.equal(logout.status, 200);
  const afterLogout = await fetch(`${origin}/api/uploads`, { method: "POST", headers: { origin, cookie: rawCookie } });
  assert.equal(afterLogout.status, 401);
} finally {
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

const rows = JSON.parse(run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--command", "SELECT email_digest,code_digest FROM email_otp_challenges; SELECT token_digest,revoked_at FROM auth_sessions; SELECT attempts FROM upload_rate_limits", "--json"]));
const challenge = rows[0].results[0];
const session = rows[1].results[0];
assert.notEqual(challenge.email_digest, "auth-test@example.invalid");
assert.notEqual(challenge.code_digest, code);
assert.ok(session.revoked_at);
assert.ok(!sessionCookie.includes(session.token_digest));
assert.equal(rows[2].results[0].attempts, 5);
console.log("Phase 3 email auth verification passed: bounded JSON/multipart, atomic business limits, hardened session, replay/CSRF/logout, and no plaintext credentials in D1.");

const extraRows = JSON.parse(run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--command", "SELECT mi.slot, count(*) AS count FROM meal_items mi JOIN servings s ON s.id=mi.serving_id JOIN votes v ON v.dish_id=s.dish_id AND v.user_id=s.creator_id WHERE s.original_description LIKE '小菜 %' GROUP BY mi.slot ORDER BY mi.slot", "--json"]))[0].results;
assert.deepEqual(extraRows, Array.from({ length: 8 }, (_, index) => ({ slot: `side_${index + 1}`, count: 5 })));
console.log("All eight side dishes persisted with individual initial votes.");
