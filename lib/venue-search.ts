export type Coordinates = { latitude: number; longitude: number };
export type Venue = {
  id: string;
  name: string;
  directoryName: string;
  type: string;
  address: string;
  postalCode: string | null;
  coordinates: Coordinates | null;
  officialUrl: string;
  warnings: string[];
};

export function normalizeVenueText(value: string): string {
  return value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function validCoordinates(point: Coordinates): boolean {
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180;
}

export function distanceMeters(a: Coordinates, b: Coordinates): number {
  if (!validCoordinates(a) || !validCoordinates(b)) throw new Error("Invalid coordinates");
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

// One edit only, including an adjacent transposition. No fuzzy postal codes.
function oneTypo(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
  return a.length > b.length ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

const aliases: Record<string, string> = {
  ru: "ru restaurant universitaire university dining hall 大学食堂 食堂",
  cafeteria: "cafeteria cafet cafe coffee 简餐店 简餐 咖啡厅",
  brasserie: "brasserie 小餐厅",
  administrative: "administratif staff administrative 职工餐厅",
  self: "libre service self 自选餐厅",
};
const ignored = new Set(["de", "du", "des", "la", "le", "les", "l", "d", "the", "crous"]);

export type VenueMatch = { venue: Venue; score: number; approximate: boolean; distance: number | null };

export function searchVenues(venues: readonly Venue[], query: string, position?: Coordinates | null): VenueMatch[] {
  const normalized = normalizeVenueText(query.slice(0, 160));
  const tokens = normalized.split(" ").filter((token) => token && !ignored.has(token));
  const located = position && validCoordinates(position) ? position : null;
  const matches = venues.flatMap((venue): VenueMatch[] => {
    const name = normalizeVenueText(venue.name);
    const words = normalizeVenueText(`${venue.name} ${venue.directoryName} ${venue.address} ${aliases[venue.type] ?? ""}`).split(" ");
    let score = normalized && normalized === name ? 100 : 0;
    let approximate = false;
    for (const token of tokens) {
      if (words.includes(token)) score += 10;
      else if (words.some((word) => word.startsWith(token))) score += 7;
      else if (/^[a-z]{5,}$/.test(token) && words.some((word) => /^[a-z]+$/.test(word) && oneTypo(token, word))) { score += 1; approximate = true; }
      else return [];
    }
    const reliablePoint = venue.coordinates && !venue.warnings.includes("coordinates-outside-idf") ? venue.coordinates : null;
    return [{ venue, score, approximate, distance: located && reliablePoint ? distanceMeters(located, reliablePoint) : null }];
  });
  // Typo suggestions appear only if the query has no exact/prefix results.
  const exact = matches.filter((match) => !match.approximate);
  return (exact.length ? exact : matches).sort((a, b) => b.score - a.score || (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.venue.name.localeCompare(b.venue.name, "fr") || a.venue.id.localeCompare(b.venue.id));
}
