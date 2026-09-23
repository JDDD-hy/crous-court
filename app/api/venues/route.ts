import { getSelectableVenues } from "@/lib/venue-catalog";

export async function GET() {
  try {
    const data = await getSelectableVenues();
    return Response.json({ data }, { headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ data: null, error: "Venue directory unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
