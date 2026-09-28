// Compile a reviewed public snapshot offline. Never fetch at visitor request time or write D1 here.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
const [source, crosswalk] = process.argv.slice(2);
if (!source || !crosswalk) throw new Error("Usage: node scripts/import-national-venues.mjs <reviewed-snapshot.json> <reviewed-crosswalk.json>");
const records = JSON.parse(readFileSync(source, "utf8"));
const mapping = JSON.parse(readFileSync(crosswalk, "utf8"));
const review = JSON.parse(readFileSync("data/national-reviews.json", "utf8"));
const geography = new Map(review.geography.map(row => [row.id, row]));
const missing = new Map(review.missingRecords.map(row => [row.id, row]));
for (const id of [...geography.keys(), ...missing.keys()]) assert.ok(records.some(row => row.id === id), `Review is stale: ${id}`);
assert.equal(new Set(records.map(row => row.crousId)).size, 26, "Review incomplete feed coverage");
assert.ok(records.length >= 900 && records.length <= 2000, "Review changed directory size");
const old = JSON.parse(readFileSync("data/versailles-venues.json", "utf8")).venues;
const existing = new Map(old.map(row => [row.id, row]));
const mapped = new Map(mapping.map(row => { assert.equal(row.matches.length, 1); assert.ok(existing.has(row.legacyId)); return [row.matches[0].nationalId, row.legacyId]; }));
assert.equal(mapped.size, 66);
const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE venues(id TEXT, canonical_name TEXT, nickname TEXT, address TEXT, display_number INTEGER)");
db.exec(readFileSync("drizzle/0016_official_venues.sql", "utf8"));
const numbers = new Map(db.prepare("SELECT id, display_number FROM venues").all().map(row => [row.id, row.display_number]));
db.close();
const labels = { "aix.marseille":"Aix-Marseille Avignon", amiens:"Amiens Picardie", "antilles.guyane":"Antilles et Guyane", bfc:"Bourgogne-Franche-Comté", bordeaux:"Bordeaux-Aquitaine", "clermont.ferrand":"Clermont Auvergne", corte:"Corse", creteil:"Créteil", grenoble:"Grenoble Alpes", lille:"Lille", limoges:"Limoges", lyon:"Lyon", montpellier:"Montpellier-Occitanie", "nancy.metz":"Lorraine", nantes:"Nantes Pays de la Loire", nice:"Nice-Toulon", normandie:"Normandie", "orleans.tours":"Orléans-Tours", paris:"Paris", poitiers:"Poitiers", reims:"Reims", rennes:"Rennes Bretagne", reunion:"La Réunion et Mayotte", strasbourg:"Strasbourg", toulouse:"Toulouse Occitanie", versailles:"Versailles" };
const venues = records.map(row => {
  assert.match(row.id, /^[a-z0-9-]{1,80}$/); assert.match(row.sourceId, /^r\d+$/);
  assert.ok(labels[row.crousId]); assert.ok(typeof row.name === "string" && row.name.length > 0 && row.name.length <= 300);
  assert.match(row.sourceUrl, /^http:\/\/webservices-v2\.crous-mobile\.fr\/feed\/[a-z.]+\/externe\/resto\.xml$/);
  const id = mapped.get(row.id) ?? row.id;
  const legacy = existing.get(id);
  const correction = geography.get(row.id);
  if (correction) assert.equal(row.cityCode, correction.expectedCityCode, `Review geography again: ${row.id}`);
  if (missing.has(row.id)) assert.equal(row.sourceSha256, missing.get(row.id).sourceSha256, `Review refreshed source before retaining missing status: ${row.id}`);
  const uncertain = !correction && row.geographyStatus === "coordinate_commune" && row.warnings.includes("source_coordinate_postcode_mismatch");
  const point = missing.has(row.id) ? null : correction?.coordinates ?? (row.nearbyEligible ? { latitude: row.latitude, longitude: row.longitude } : null);
  if (point) assert.ok(Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 && (point.latitude || point.longitude));
  // Source's explicit Mayotte zone provides timezone; no city/coordinates are guessed.
  const timezone = row.timezone ?? (row.crousId === "reunion" ? (/Mayotte/.test(row.sourceZone) ? "Indian/Mayotte" : "Indian/Reunion") : "Europe/Paris");
  return { id, sourceId: row.sourceId, displayNumber: numbers.get(id) ?? 10000 + Number(row.sourceId.slice(1)),
    name: legacy?.name ?? row.name, address: legacy?.address ?? row.address, points: point ? [point] : [], legacy: false,
    city: correction?.city ?? (uncertain ? null : row.cityName), cityCode: correction?.cityCode ?? (uncertain ? null : row.cityCode),
    region: correction?.region ?? (uncertain ? null : row.regionName), regionCode: correction?.regionCode ?? (uncertain ? null : row.regionCode),
    crous: labels[row.crousId], crousId: row.crousId, type: legacy?.type ?? row.type, timezone,
    officialUrl: legacy?.officialUrl ?? (row.id === "cnous-reunion-r1381" ? "https://www.crous-reunionmayotte.fr/restaurant/restaurant-de-dembeni/" : "https://www.lescrous.fr/votre-crous/"),
    warnings: [...row.warnings.filter(warning => !(correction?.coordinates && warning === "source_coordinate_postcode_mismatch")), ...(uncertain ? ["administrative_area_unresolved"] : []), ...(missing.has(row.id) ? ["source_record_missing"] : [])], sourceArea: row.sourceZone };
}).sort((a,b) => a.id.localeCompare(b.id));
assert.equal(new Set(venues.map(row=>row.id)).size,venues.length);
assert.equal(new Set(venues.map(row=>row.displayNumber)).size,venues.length);
for (const id of existing.keys()) assert.ok(venues.some(row=>row.id===id), `Missing existing ${id}`);
const previous = (()=>{try{return JSON.parse(readFileSync("data/national-venues.json","utf8"));}catch{return null;}})();
if(previous) for(const row of previous.venues) { const next=venues.find(item=>item.id===row.id); assert.ok(next, `Missing ${row.id}: review disappearance, do not delete automatically`); assert.equal(next.displayNumber,row.displayNumber); }
const feeds = [...new Map(records.map(row=>[row.crousId,{crousId:row.crousId,url:row.sourceUrl,sha256:row.sourceSha256,updatedAt:row.sourceUpdatedAt}])).values()];
writeFileSync("data/national-venues.json", JSON.stringify({ checkedOn: records[0].retrievedAt, venues })+"\n");
writeFileSync("data/national-sources.json", JSON.stringify({ checkedOn: records[0].retrievedAt, provider:"CNOUS", license:"Licence Ouverte", catalog:"https://www.data.gouv.fr/datasets/restaurants-brasseries-et-cafeterias-des-crous", geography:"https://geo.api.gouv.fr/", transport:"Regional feeds are HTTP only; hashes identify snapshots, not authenticated origins.", review:{checkedAt:review.checkedAt,liveRecordCount:review.liveRecordCount,retainedMissing:review.missingRecords.length,artifact:"data/national-reviews.json"}, feeds, crosswalk:mapping },null,2)+"\n");
console.log(JSON.stringify({venues:venues.length,crous:feeds.length,nearby:venues.filter(row=>row.points.length).length,preserved:existing.size}));
