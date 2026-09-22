import { distanceMeters, normalizeVenueText, validCoordinates, type Coordinates } from "./venue-search.ts";

export type VenueOption = { id: string; name: string; address: string | null; points: Array<Coordinates | null>; legacy: boolean;
  city?: string | null; cityCode?: string | null; region?: string | null; regionCode?: string | null; crous?: string; crousId?: string;
  type?: string; timezone?: string; officialUrl?: string; warnings?: string[] };
export const venueCookie = "crous-venues";
export const maxVenueSelection = 32;
export const venueResultPageSize = 12;

export function nearbyVenues(options: VenueOption[], position: Coordinates) {
  if (!validCoordinates(position)) return [];
  return options.filter(option => !option.legacy).map(option => ({ option, distance: Math.min(...option.points.filter((point): point is Coordinates => Boolean(point && validCoordinates(point))).map(point => distanceMeters(position, point))) }))
    .filter(item => item.distance <= 1000).sort((a, b) => a.distance - b.distance || a.option.name.localeCompare(b.option.name, "fr"));
}

const searchText = new WeakMap<VenueOption, string>();
export function matchVenue(option: VenueOption, query: string) {
  let haystack = searchText.get(option);
  if (haystack === undefined) { haystack = normalizeVenueText(`${option.name} ${option.address ?? ""} ${option.city ?? ""} ${option.region ?? ""} ${option.crous ?? ""}`); searchText.set(option,haystack); }
  return normalizeVenueText(query.slice(0, 160)).split(" ").filter(Boolean).every(token => haystack.includes(token));
}

export function saveVenuePreference(ids: string[]) {
  if (ids.length > maxVenueSelection || encodeURIComponent(ids.join(",")).length > 3500) throw new RangeError("Too many selected venues");
  document.cookie = `${venueCookie}=${encodeURIComponent(ids.join(","))}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.dispatchEvent(new Event("crous-venue-selected"));
}
