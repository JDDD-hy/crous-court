import directory from "@/data/national-venues.json";
import { getRawDb } from "@/db";
import { isCafeteria, type VenueOption } from "./venue-preference";

export type CatalogVenue = VenueOption & { displayNumber: number; sourceId: string; timezone: string };
export const catalogVenues: CatalogVenue[] = directory.venues;
export const catalogById = new Map(catalogVenues.map(venue => [venue.id, venue]));

export async function getSelectableVenues(ids?: string[]) {
  const rows = await getRawDb().prepare(`SELECT id, canonical_name name, address, active, timezone FROM venues${ids ? " WHERE id IN (SELECT value FROM json_each(?))" : ""}`)
    .bind(...(ids ? [JSON.stringify(ids)] : [])).all<{ id: string; name: string; address: string | null; active: number; timezone: string }>();
  const stored = new Map(rows.results.map(row => [row.id, row]));
  const requested = ids ? new Set(ids) : null;
  const options: VenueOption[] = catalogVenues.filter(venue => !isCafeteria(venue) && (!requested || requested.has(venue.id)) && stored.get(venue.id)?.active !== 0)
    .map(venue => ({ id: venue.id, name: venue.name, address: venue.address, points: venue.points, legacy: false, city: venue.city, cityCode: venue.cityCode, region: venue.region, regionCode: venue.regionCode, crous: venue.crous, crousId: venue.crousId, type: venue.type, timezone: venue.timezone, officialUrl: venue.officialUrl, warnings: venue.warnings }));
  // Historical identities remain resolvable; they are never offered as new choices.
  for (const row of rows.results) if (row.active && !catalogById.has(row.id) && !isCafeteria(row)) options.push({ ...row, points: [], legacy: true });
  return options;
}

export function catalogVenueInsert(db: D1Database, venue: CatalogVenue) {
  return db.prepare("INSERT INTO venues (id, canonical_name, nickname, address, display_number, timezone) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING")
    .bind(venue.id, venue.name, venue.name, venue.address, venue.displayNumber, venue.timezone);
}
