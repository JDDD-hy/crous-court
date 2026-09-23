import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { matchVenue, nearbyVenues, type VenueOption } from "../lib/venue-preference.ts";
import { parseVenueScope } from "../lib/venue-scope-input.ts";
import { todayInTimezone, courtDateRanges } from "../lib/calendar.ts";

const catalog = JSON.parse(readFileSync("data/national-venues.json","utf8")) as {venues: (VenueOption & {displayNumber:number;sourceId:string})[]};
test("national catalog preserves identities and 26 feeds, quarantines suspect GPS and searches overseas", t => {
  assert.equal(catalog.venues.length,985);
  assert.equal(new Set(catalog.venues.map(v=>v.crousId)).size,26);
  for(const field of ["id","displayNumber"] as const) assert.equal(new Set(catalog.venues.map(v=>v[field])).size,985);
  const old = JSON.parse(readFileSync("data/versailles-venues.json","utf8"));
  for(const venue of old.venues) assert.equal(catalog.venues.find(v=>v.id===venue.id)?.name,venue.name);
  const eligible = catalog.venues.filter(v=>v.points.length);
  assert.equal(eligible.length,910);
  const overseas = eligible.find(v=>v.timezone === "Indian/Reunion")!;
  assert.ok(nearbyVenues(catalog.venues,overseas.points[0]!).some(v=>v.option.id===overseas.id));
  assert.ok(catalog.venues.some(v=>matchVenue(v,"Dembeni") && !v.points.length));
  assert.ok(catalog.venues.some(v=>v.type==="ru" && /Escoffier/.test(v.name)));
  assert.ok(catalog.venues.some(v=>v.type==="cafeteria" && /Escoffier/.test(v.name)));
  const times=[];
  for(let i=0;i<30;i++) { const start=performance.now();catalog.venues.filter(v=>matchVenue(v,"Cafétéria Lyon"));times.push(performance.now()-start); }
  const p95=times.sort((a,b)=>a-b)[Math.floor(times.length*.95)];
  t.diagnostic(`985 venue search p95 ${p95.toFixed(2)}ms; server/network excluded`);
  assert.ok(p95<100,"Local text matching must remain responsive");
});
test("reviewed geography and missing feeds do not silently assert disputed locations or delete identities", () => {
  const review=JSON.parse(readFileSync("data/national-reviews.json","utf8"));
  assert.equal(review.feeds.length,26);
  assert.equal(review.feeds.reduce((sum:number,row:{count:number})=>sum+row.count,0),review.liveRecordCount);
  assert.equal(review.liveRecordCount+review.missingRecords.length,catalog.venues.length);
  for(const row of review.missingRecords) {
    const venue=catalog.venues.find(venue=>venue.sourceId===row.sourceId)!;
    assert.ok(venue.warnings?.includes("source_record_missing"));
    assert.equal(venue.points.length,0);
    assert.ok(matchVenue(venue,venue.name),"Historical records remain searchable");
  }
  assert.equal(review.unresolvedGeography.length,10);
  for(const row of review.unresolvedGeography) {
    const venue=catalog.venues.find(venue=>venue.id===row.id) ?? catalog.venues.find(venue=>venue.sourceId===row.id.split('-').at(-1))!;
    assert.equal(venue.cityCode,null); assert.equal(venue.regionCode,null);
    assert.ok(venue.warnings?.includes("administrative_area_unresolved"));
  }
  const chenes=catalog.venues.find(venue=>venue.sourceId==='r43')!;
  assert.equal(chenes.id,'ru-les-chenes-2');assert.equal(chenes.cityCode,'95127');assert.equal(chenes.points.length,0);
  const dembeni=catalog.venues.find(venue=>venue.sourceId==='r1381')!;
  assert.equal(dembeni.cityCode,'97607');assert.equal(dembeni.regionCode,'06');assert.equal(dembeni.points.length,0);
  assert.equal(new Set(catalog.venues.map(venue=>venue.regionCode).filter(Boolean)).size,18);
});
test("scope input bounds amplification and rejects mixed sentinel values",()=>{
  assert.equal(parseVenueScope(undefined).pending,true);
  assert.deepEqual(parseVenueScope(["a","a"]).requested,["a"]);
  for(const values of [["all","a"],["none","a"],["x".repeat(81)],["<script>"],Array(33).fill("a")]) assert.equal(parseVenueScope(values).invalid,true);
  assert.equal(parseVenueScope(["all"]).invalid,false);
});
test("overseas dates use venue timezone across midnight",()=>{
  const now=new Date("2026-09-22T22:30:00Z");
  assert.equal(todayInTimezone("Europe/Paris",now),"2026-09-23");
  assert.equal(todayInTimezone("America/Guadeloupe",now),"2026-09-22");
  assert.equal(todayInTimezone("Indian/Mayotte",now),"2026-09-23");
  assert.deepEqual(courtDateRanges(now).find(v=>v.zone==="America/Guadeloupe"),{zone:"America/Guadeloupe",today:"2026-09-22",yesterday:"2026-09-21"});
});
