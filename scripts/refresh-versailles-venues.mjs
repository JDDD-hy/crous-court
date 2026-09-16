// Official metadata snapshot only. Never geocode, merge service points, or write to D1.
import { writeFile, mkdir } from "node:fs/promises";

const directoryUrl = "https://www.crous-versailles.fr/se-restaurer/ou-manger/";
function plain(html) {
  const entities = { amp: "&", apos: "'", quot: '"', nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—", eacute: "é", Eacute: "É", egrave: "è", agrave: "à", ocirc: "ô", ecirc: "ê", ccedil: "ç", ugrave: "ù", oelig: "œ" };
  return html.replace(/<[^>]*>/g, " ").replace(/&#(x[\da-f]+|\d+);/gi, (_, value) => String.fromCodePoint(value[0].toLowerCase() === "x" ? parseInt(value.slice(1), 16) : Number(value))).replace(/&([a-z]+);/gi, (match, entity) => entities[entity] ?? match).replace(/\s+/g, " ").trim();
}
async function get(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return response.text();
}
const directory = await get(directoryUrl);
const links = [...directory.matchAll(/<a\b[^>]*href="(https:\/\/www\.crous-versailles\.fr\/restaurant\/[^"#]+)"[^>]*>\s*<div class="restaurant_title">([\s\S]*?)<\/div>/g)];
const unique = [...new Map(links.map((match) => [match[1], { url: match[1], directoryName: plain(match[2]) }])).values()];
if (unique.length < 40) throw new Error("Unexpected directory format/count; do not overwrite the snapshot.");
const venues = [];
let cursor = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (cursor < unique.length) {
    const { url, directoryName } = unique[cursor++];
    const page = await get(url);
    const name = plain(page.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
    if (!name) throw new Error(`Missing official name: ${url}`);
    const address = plain(page.match(/Adresse<\/div>\s*<p>([\s\S]*?)<\/p>/i)?.[1] ?? "");
    const point = page.match(/https:\/\/www\.google\.com\/maps\/dir\/\/(-?[\d.]+),(-?[\d.]+)/);
    const coordinates = point ? { latitude: Number(point[1]), longitude: Number(point[2]) } : null;
    if (coordinates && (!Number.isFinite(coordinates.latitude) || !Number.isFinite(coordinates.longitude) || Math.abs(coordinates.latitude) > 90 || Math.abs(coordinates.longitude) > 180)) throw new Error(`Invalid coordinates: ${url}`);
    const postalCode = address.match(/\b\d{5}\b/)?.[0] ?? null;
    const warnings = [];
    if (!address) warnings.push("missing-address");
    if (!coordinates) warnings.push("missing-coordinates");
    if (postalCode && !/^(75|77|78|91|92|93|94|95)/.test(postalCode)) warnings.push("postal-code-outside-idf");
    if (coordinates && (coordinates.latitude < 48.1 || coordinates.latitude > 49.3 || coordinates.longitude < 1.4 || coordinates.longitude > 3.6)) warnings.push("coordinates-outside-idf");
    const type = /administratif/i.test(name) ? "administrative" : /^RU\b|Restaurant universitaire/i.test(name) ? "ru" : /caf[ée]t[ée]ria/i.test(name) ? "cafeteria" : /brasserie/i.test(name) ? "brasserie" : /libre.service|self/i.test(name) ? "self" : "other";
    venues.push({ id: new URL(url).pathname.split("/").filter(Boolean).at(-1), name, directoryName, type, address, postalCode, coordinates, officialUrl: url, warnings });
  }
}));
venues.sort((a, b) => a.name.localeCompare(b.name, "fr"));
const result = { source: directoryUrl, checkedOn: new Date().toISOString().slice(0, 10), coordinateSource: "Official detail page navigation link; not independently surveyed", venues };
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/versailles-venues.json", import.meta.url), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({ total: venues.length, withCoordinates: venues.filter((venue) => venue.coordinates).length, warnings: venues.filter((venue) => venue.warnings.length).map(({ name, warnings }) => ({ name, warnings })) }, null, 2));
