import { getRawDb } from "@/db";
import { isolationMigrationId, restaurantIsolationStatements } from "@/lib/restaurant-isolation";
import { reportServerError } from "@/lib/server-error";

let ready: Promise<string> | undefined;
async function initialize() {
  const db = getRawDb();
  if (!await db.prepare("SELECT id FROM app_data_migrations WHERE id=?").bind(isolationMigrationId).first()) await db.batch(restaurantIsolationStatements(db,crypto.randomUUID()));
  const rows = await db.prepare("SELECT name,sql FROM sqlite_schema WHERE name IN (SELECT value FROM json_each(?)) ORDER BY name").bind("[\"dishes_venue_immutable\",\"servings_venue_update\",\"dish_history_pages\",\"votes_history_pages_insert\",\"votes_history_pages_delete\",\"votes_history_pages_update\"]").all<{name:string;sql:string}>();
  const bytes = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(rows.results.map(row=>[row.name,row.sql.replaceAll("\r","")]))));
  return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,"0")).join("");
}

export async function middleware() {
  try {
    ready ??= initialize().catch(error => { ready = undefined; throw error; });
    const schemaDigest = await ready;
    return new Response("升级维护中，请稍后再试。 / Maintenance in progress. Please try again shortly.", {status:503,headers:{"content-type":"text/plain; charset=utf-8","cache-control":"private, no-store","retry-after":"60","x-crous-maintenance":"ready","x-crous-schema-digest":schemaDigest}});
  } catch (error) {
    reportServerError("isolation_init", crypto.randomUUID(), error);
    return new Response("数据服务暂时不可用，请稍后重试。 / Data temporarily unavailable.", {
      status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "30" },
    });
  }
}

export const config = { matcher: ["/:path*"] };
