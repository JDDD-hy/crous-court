/** Compact postal address for display; missing addresses stay missing. */
export function venueLocation(address: string | null, venueId: string): string | null {
  // Historical venue rows predate the directory and have no address.
  if (!address && ["venue-escoffier", "venue-experimental"].includes(venueId)) return "91120 Palaiseau";
  const location = address?.trim().match(/\b(\d{5})\s+(.+)$/);
  if (!location) return null;
  // The RU detail page has a typo. CROUS's June 2025 official list gives 91120:
  // https://www.crous-versailles.fr/wp-content/uploads/sites/17/2025/06/Liste_Site_rechargement_espece_Crous-Versailles_20250603.pdf
  const postalCode = venueId === "ru-escoffier-2" && location[1] === "31120" ? "91120" : location[1];
  return `${postalCode} ${location[2]}`;
}
