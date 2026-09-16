import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { venues } from "@/db/schema";
import directory from "@/data/versailles-venues.json";
import { cookies } from "next/headers";
import { venueCookie } from "./venue-preference";

// Historical records identify the whole venue, not a particular RU/cafeteria counter.
const directoryIds: Record<string, string[]> = {
  "venue-escoffier": ["ru-escoffier-2", "cafeteria-escoffier-2"],
  "venue-experimental": ["ru-lexperimental-2", "cafeteria-lexperimental-2"],
};

export async function getVenueScope(value: string | string[] | undefined, usePreference = false) {
  if (value === undefined && usePreference) {
    const saved = (await cookies()).get(venueCookie)?.value;
    try { if (saved && saved.length <= 6000) value = decodeURIComponent(saved).split(","); } catch { /* Invalid preference is ignored. */ }
  }
  const rows = await getDb().select({ id: venues.id, name: venues.canonicalName, address: venues.address }).from(venues).where(eq(venues.active, true));
  const options = rows.map(row => ({ ...row, legacy: Boolean(directoryIds[row.id]), points: directory.venues.filter(item => item.id === row.id || directoryIds[row.id]?.includes(item.id)).map(item => item.warnings.includes("coordinates-outside-idf") ? null : item.coordinates) }));
  const requested = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const all = requested.length === 1 && requested[0] === "all";
  const ids = [...new Set(requested.filter(id => rows.some(row => row.id === id)))];
  const invalid = requested.some(id => id !== "none" && !rows.some(row => row.id === id)) && !all;
  const query = new URLSearchParams();
  for (const id of all ? ["all"] : invalid ? ["none"] : ids.length ? ids : requested.length ? ["none"] : []) query.append("venue", id);
  return { options, ids: all ? undefined : invalid ? [] : ids, invalid, pending: !requested.length, query: query.size ? `?${query}` : "" };
}
