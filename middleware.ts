import { NextResponse } from "next/server";
import { getRawDb } from "@/db";
import { isolationMigrationId, restaurantIsolationStatements } from "@/lib/restaurant-isolation";
import { reportServerError } from "@/lib/server-error";

let ready: Promise<void> | undefined;
async function initialize() {
  const db = getRawDb();
  if (await db.prepare("SELECT id FROM app_data_migrations WHERE id=?").bind(isolationMigrationId).first()) return;
  await db.batch(restaurantIsolationStatements(db,crypto.randomUUID()));
}

export async function middleware() {
  try {
    ready ??= initialize().catch(error => { ready = undefined; throw error; });
    await ready;
    return NextResponse.next();
  } catch (error) {
    reportServerError("isolation_init", crypto.randomUUID(), error);
    return new Response("数据服务暂时不可用，请稍后重试。 / Data temporarily unavailable.", {
      status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "30" },
    });
  }
}

export const config = { matcher: ["/((?!_next/|.*\\.[^/]+$).*)"] };
