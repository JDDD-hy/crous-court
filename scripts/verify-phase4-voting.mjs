import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const persist = path.join(root, ".sites-runtime", "phase4-voting-verification");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const config = path.join(root, "dist", "server", "wrangler.json");
const origin = "http://127.0.0.1:8792";
const secret = "phase4-voting-verification-secret-at-least-32-characters";

function run(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return result.stdout;
}
async function post(url, body, cookie, requestOrigin = origin) {
  const init = { method: "POST", headers: { origin: requestOrigin, "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) };
  const response = await fetch(`${origin}${url}`, init);
  if (response.status !== 503 || !await response.clone().text().then((text) => text.includes("worker restarted"))) return response;
  return fetch(`${origin}${url}`, init);
}
async function login(email) {
  const requested = await post("/api/auth/email/request", { email });
  const challenge = await requested.json();
  assert.equal(requested.status, 200, JSON.stringify(challenge));
  const verified = await post("/api/auth/email/verify", { email, challengeId: challenge.data.challengeId, code: challenge.data.devCode });
  assert.equal(verified.status, 200);
  return verified.headers.get("set-cookie").split(";")[0];
}

await rm(persist, { recursive: true, force: true });
run(["d1", "migrations", "apply", "DB", "--local", "--persist-to", persist, "--config", config]);
run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--file", path.join(root, "db", "fixtures.sql"), "--yes"]);

const child = spawn(process.execPath, [wrangler, "dev", "--config", config, "--local", "--persist-to", persist, "--ip", "127.0.0.1", "--port", "8792", "--inspector-port", "0", "--var", "AUTH_MODE:local", "--var", `AUTH_HMAC_SECRET:${secret}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
let output = "";
child.stdout.on("data", (chunk) => output += chunk);
child.stderr.on("data", (chunk) => output += chunk);
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`Worker did not start\n${output.slice(-4000)}`)), 20_000);
  const ready = (chunk) => { if (String(chunk).includes("Ready on")) { clearTimeout(timeout); resolve(); } };
  child.stdout.on("data", ready); child.stderr.on("data", ready);
});

try {
  assert.equal((await post("/api/dishes/mystery-dessert/vote", { targetTier: 1 })).status, 401);
  const cookie = await login("vote-one@example.invalid");
  assert.equal((await post("/api/dishes/mystery-dessert/vote", { targetTier: 1 }, cookie, "https://evil.example")).status, 403);
  const invalid = await post("/api/dishes/mystery-dessert/vote", { targetTier: 0 }, cookie);
  assert.equal(invalid.status, 400, await invalid.text());
  assert.equal((await post("/api/dishes/not-found/vote", { targetTier: 1 }, cookie)).status, 404);

  const first = await post("/api/dishes/mystery-dessert/vote", { targetTier: 1 }, cookie);
  const firstData = (await first.json()).data;
  assert.equal(first.status, 200, JSON.stringify(firstData));
  assert.equal(firstData.dish.votes, 2);
  assert.equal(firstData.dish.tier, 3);
  assert.equal(firstData.myVote, 1);

  const changed = await post("/api/dishes/mystery-dessert/vote", { targetTier: 5 }, cookie);
  assert.equal(changed.status, 409);
  const synchronized = await changed.json();
  assert.equal(synchronized.data.myVote, 1);
  assert.equal(synchronized.data.dish.votes, 2);

  const parallelCookie = await login("vote-parallel@example.invalid");
  const parallel = await Promise.all(Array.from({ length: 10 }, () => post("/api/dishes/lentilles-saucisse/vote", { targetTier: 2 }, parallelCookie)));
  assert.equal(parallel.filter((response) => response.status === 200).length, 1);
  assert.equal(parallel.filter((response) => response.status === 409).length, 9);

  const rateCookie = await login("vote-rate@example.invalid");
  const allowed = await Promise.all(Array.from({ length: 30 }, () => post("/api/dishes/couscous-boulettes/vote", { targetTier: 4 }, rateCookie)));
  assert.equal(allowed.filter((response) => response.status === 200).length, 1);
  assert.equal(allowed.filter((response) => response.status === 409).length, 29);
  assert.equal((await post("/api/dishes/couscous-boulettes/vote", { targetTier: 5 }, rateCookie)).status, 429);

  const rankings = await fetch(`${origin}/api/rankings?category=main`).then((response) => response.json());
  assert.deepEqual(rankings.data.map((dish) => dish.id), ["couscous-boulettes", "lentilles-saucisse"]);
} finally {
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

const rows = JSON.parse(run(["d1", "execute", "DB", "--local", "--persist-to", persist, "--config", config, "--command", "SELECT COUNT(*) AS count,target_tier FROM votes WHERE dish_id='mystery-dessert' AND user_id IN (SELECT id FROM users WHERE id NOT LIKE 'fixture-%'); SELECT dish_id,user_id,COUNT(*) AS count FROM votes GROUP BY dish_id,user_id HAVING count > 1; SELECT attempts FROM vote_rate_limits ORDER BY attempts DESC LIMIT 1", "--json"]));
assert.deepEqual(rows[0].results, [{ count: 1, target_tier: 1 }]);
assert.deepEqual(rows[1].results, []);
assert.equal(rows[2].results[0].attempts, 30);
console.log("Phase 4 voting verification passed: auth/CSRF/validation, immutable one-vote enforcement, concurrency uniqueness, 30/min rate limit, median result, and ranking order.");
