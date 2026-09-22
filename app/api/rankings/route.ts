import { localizedJson } from "@/lib/i18n/server";
import { rankingPage } from "@/lib/ranking-service";
import { parseRankingPage, rankingPageSize } from "@/lib/ranking-query";
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
    const url = new URL(request.url);
    const result = await rankingPage({ category: category ?? undefined, venueIds: scope?.ids, page: parseRankingPage(url.searchParams.has("page") ? url.searchParams.getAll("page").length === 1 ? url.searchParams.get("page")! : [] : undefined) });
    return localizedJson({ data: result.dishes, pagination: { page: result.page, pageSize: rankingPageSize, total: result.total }, error: null, requestId });
  } catch (error) {
    if (error instanceof RangeError) return localizedJson({ data: null, error: "Invalid ranking page", requestId }, { status: 400 });
    return localizedJson({ data: null, error: "ranking data is unavailable", requestId }, { status: 500 });
  }
}
