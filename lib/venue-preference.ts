import { distanceMeters, normalizeVenueText, validCoordinates, type Coordinates } from "./venue-search.ts";

export type VenueOption = { id: string; name: string; address: string | null; points: Array<Coordinates | null>; legacy: boolean };
export const venueCookie = "crous-venues";

export function nearbyVenues(options: VenueOption[], position: Coordinates) {
  if (!validCoordinates(position)) return [];
  return options.filter(option => !option.legacy).map(option => ({ option, distance: Math.min(...option.points.filter((point): point is Coordinates => Boolean(point && validCoordinates(point))).map(point => distanceMeters(position, point))) }))
    .filter(item => item.distance <= 1000).sort((a, b) => a.distance - b.distance || a.option.name.localeCompare(b.option.name, "fr"));
}

export function matchVenue(option: VenueOption, query: string) {
  return normalizeVenueText(`${option.name} ${option.address ?? ""}`).includes(normalizeVenueText(query.slice(0, 160)));
}

export function saveVenuePreference(ids: string[]) {
  document.cookie = `${venueCookie}=${encodeURIComponent(ids.join(","))}; Path=/; Max-Age=2592000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  window.dispatchEvent(new Event("crous-venue-selected"));
}
