import { cookies } from "next/headers";
import { venueCookie } from "./venue-preference";
import { parseVenueScope } from "./venue-scope-input";
import { getSelectableVenues } from "./venue-catalog";

export async function getVenueScope(value: string | string[] | undefined, usePreference = false) {
  if (value === undefined && usePreference) {
    const saved = (await cookies()).get(venueCookie)?.value;
    try { if (saved && saved.length <= 3500) value = decodeURIComponent(saved).split(","); } catch { /* Ignore malformed device preferences. */ }
  }
  const parsed = parseVenueScope(value);
  const all = !parsed.invalid && parsed.requested.length === 1 && parsed.requested[0] === "all";
  const requested = parsed.requested.filter(id => id !== "all" && id !== "none");
  const options = requested.length ? await getSelectableVenues(requested) : [];
  const known = new Set(options.map(row => row.id));
  const invalid = parsed.invalid || requested.some(id => !known.has(id));
  const ids = invalid ? [] : requested;
  const query = new URLSearchParams();
  for (const id of all ? ["all"] : invalid ? ["none"] : ids.length ? ids : parsed.pending ? [] : ["none"]) query.append("venue", id);
  return { options, ids: all ? undefined : ids, invalid, pending: parsed.pending, query: query.size ? `?${query}` : "" };
}
