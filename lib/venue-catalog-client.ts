import type { VenueOption } from "./venue-preference";

let catalog: Promise<VenueOption[]> | undefined;
let loadedAt = 0;
// One download per five minutes, only after a chooser is opened. GPS stays local.
export function loadVenueCatalog() {
  if (!catalog || Date.now() - loadedAt > 300000) {
    loadedAt = Date.now();
    catalog = fetch("/api/venues", { credentials: "omit" }).then(async response => {
      if (!response.ok) throw new Error("Venue directory unavailable");
      return (await response.json() as { data: VenueOption[] }).data;
    }).catch(error => { catalog = undefined; throw error; });
  }
  return catalog;
}
