"use client";

import { useSearchParams } from "next/navigation";

// Follow URL scope, including upload's replaceState, without copying it into a stale preference.
export function useVenueQuery(fallback = "") {
  const params = useSearchParams();
  const query = new URLSearchParams();
  for (const id of params.getAll("venue")) query.append("venue", id);
  return query.size ? `?${query}` : fallback;
}
