import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { distanceMeters, normalizeVenueText, searchVenues, type Venue } from "../lib/venue-search.ts";

const point = { latitude: 48.7128, longitude: 2.2051 };
const ru: Venue = { id: "ru-escoffier", name: "RU Escoffier", directoryName: "RU Escoffier", type: "ru", address: "22 cours Pierre Vasseur, 91120 Palaiseau", postalCode: "91120", coordinates: point, officialUrl: "https://www.crous-versailles.fr/restaurant/ru-escoffier-2/", warnings: [] };
const cafe: Venue = { ...ru, id: "cafe-escoffier", name: "Cafétéria Escoffier", directoryName: "Cafétéria Escoffier", type: "cafeteria" };
const other: Venue = { ...ru, id: "experimental", name: "RU L’Expérimental", directoryName: "RU L’Expérimental", coordinates: null };

test("venue search separates colocated services and ranks text before location", () => {
  const venues = [ru, cafe, other];
  assert.equal(normalizeVenueText(" L’EXPÉRIMENTAL "), "l experimental");
  assert.deepEqual(searchVenues(venues, "escoffier").map(({ venue }) => venue.id).sort(), [cafe.id, ru.id].sort());
  assert.equal(searchVenues(venues, "ru escoffier", point)[0].venue.id, ru.id);
  assert.equal(searchVenues(venues, "cafet escoffier")[0].venue.id, cafe.id);
  assert.equal(searchVenues(venues, "食堂 experimental")[0].venue.id, other.id);
  assert.equal(searchVenues(venues, "L'experimental")[0].venue.id, other.id);
  assert.equal(searchVenues(venues, "91120 pala").length, 3);
  assert.equal(searchVenues(venues, "91121").length, 0);
  assert.equal(searchVenues(venues, "escofier").length, 2);
  assert.ok(searchVenues(venues, "escfofier").every((match) => match.approximate));
  assert.equal(searchVenues(venues, "inexistent").length, 0);
  assert.equal(searchVenues(venues, "", point).at(-1)?.venue.id, other.id);
  assert.equal(searchVenues(venues, "", { latitude: NaN, longitude: 0 })[0].distance, null);
});

test("Haversine covers identity, a known arc, date line and invalid input", () => {
  assert.equal(distanceMeters(point, point), 0);
  assert.ok(Math.abs(distanceMeters({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) - 111195.08) < 1);
  assert.ok(distanceMeters({ latitude: 0, longitude: 179.9 }, { latitude: 0, longitude: -179.9 }) < 23000);
  assert.throws(() => distanceMeters(point, { latitude: 91, longitude: 0 }));
});

test("official snapshot preserves distinct services, provenance and suspicious data", () => {
  const snapshot = JSON.parse(readFileSync(new URL("../data/versailles-venues.json", import.meta.url), "utf8")) as { venues: Venue[] };
  assert.ok(snapshot.venues.length >= 60);
  assert.equal(new Set(snapshot.venues.map((venue) => venue.id)).size, snapshot.venues.length);
  for (const venue of snapshot.venues) {
    assert.ok(venue.name && venue.address);
    assert.ok(venue.officialUrl.startsWith("https://www.crous-versailles.fr/restaurant/"));
    if (venue.coordinates) assert.ok(Number.isFinite(distanceMeters(point, venue.coordinates)));
  }
  assert.equal(searchVenues(snapshot.venues, "Escoffier").length, 2);
  assert.equal(searchVenues(snapshot.venues, "experimental").length, 2);
  const suspicious = snapshot.venues.find((venue) => venue.name === "RU Escoffier");
  assert.ok(suspicious);
  if (suspicious.address.includes("31120")) assert.ok(suspicious.warnings.includes("postal-code-outside-idf"));
});
