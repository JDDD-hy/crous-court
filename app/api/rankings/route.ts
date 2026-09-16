import { localizedJson } from "@/lib/i18n/server";
import { listRankings } from "@/lib/ranking-service";
import { getVenueScope } from "@/lib/venue-scope";

export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    const category = new URL(request.url).searchParams.get("category");
    if (category !== null && category !== "main" && category !== "side") {
      return localizedJson({ data: null, error: "category must be main or side", requestId }, { status: 400 });
    }
    const requested = new URL(request.url).searchParams.getAll("venue");
    const scope = requested.length ? await getVenueScope(requested) : null;
    if (scope?.invalid) return localizedJson({ data: null, error: "Unknown venue", requestId }, { status: 400 });
    return localizedJson({ data: await listRankings(category ?? undefined, scope?.ids), error: null, requestId });
  } catch {
    return localizedJson({ data: null, error: "ranking data is unavailable", requestId }, { status: 500 });
  }
}
